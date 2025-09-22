// Client wrapper for pose detection Web Worker

export interface Keypoint {
  name: string;
  x: number;
  y: number;
  score: number;
}

export interface FrameData {
  t: number;
  keypoints: Keypoint[];
}

export interface SwingEvents {
  load_start?: number;
  stride_plant?: number;
  launch?: number;
  contact?: number;
  extension?: number;
  finish?: number;
}

export interface PoseAnalysisResult {
  events: SwingEvents;
  keypointsByFrame: FrameData[];
  quality?: 'low_confidence';
}

export interface PoseWorkerInput {
  videoBlob: Blob;
  fps?: number;
}

export class PoseWorkerClient {
  private worker: Worker | null = null;
  private isInitialized = false;
  private isProcessing = false;

  constructor() {
    this.initializeWorker();
  }

  private async initializeWorker(): Promise<void> {
    try {
      // Use the JavaScript worker from public directory to avoid module resolution issues
      this.worker = new Worker('/poseWorker.js');

      // Set up message handling
      this.worker.onmessage = (e) => {
        const { type, message } = e.data;
        
        switch (type) {
          case 'progress':
            console.log('Pose Worker:', message);
            break;
          case 'initialized':
            this.isInitialized = true;
            console.log('Pose Worker initialized successfully');
            break;
          case 'error':
            console.error('Pose Worker Error:', message);
            break;
        }
      };

      // Initialize the worker
      this.worker.postMessage({ type: 'initialize' });

      // Wait for initialization
      await this.waitForInitialization();

    } catch (error) {
      console.error('Failed to initialize pose worker:', error);
      throw new Error('Pose worker initialization failed');
    }
  }

  private waitForInitialization(): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInitialization = () => {
        if (this.isInitialized) {
          resolve();
        } else {
          setTimeout(checkInitialization, 100);
        }
      };
      
      setTimeout(() => {
        if (!this.isInitialized) {
          reject(new Error('Worker initialization timeout'));
        }
      }, 30000); // 30 second timeout
      
      checkInitialization();
    });
  }

  public async analyzeSwing(
    videoBlob: Blob, 
    fps?: number,
    onProgress?: (message: string) => void
  ): Promise<PoseAnalysisResult> {
    if (!this.worker || !this.isInitialized) {
      throw new Error('Pose worker not initialized');
    }

    if (this.isProcessing) {
      throw new Error('Worker is already processing a video');
    }

    this.isProcessing = true;

    try {
      // Process video in main thread and send frames to worker
      const frames = await this.extractVideoFrames(videoBlob, fps || 30, onProgress);
      
      if (frames.length === 0) {
        throw new Error('No frames could be processed from video');
      }

      onProgress?.('Analyzing swing phases...');
      
      // Process the extracted frames to get swing analysis
      const result = await this.processFramesForAnalysis(frames);
      
      this.isProcessing = false;
      return result;
    } catch (error) {
      this.isProcessing = false;
      throw error;
    }
  }

  private async extractVideoFrames(videoBlob: Blob, targetFps: number, onProgress?: (message: string) => void): Promise<FrameData[]> {
    return new Promise((resolve, reject) => {
      // Validate video blob first
      if (!videoBlob || videoBlob.size === 0) {
        reject(new Error('Invalid video: Video file is empty or corrupted'));
        return;
      }

      if (!videoBlob.type.startsWith('video/')) {
        reject(new Error('Invalid video: File is not a video format'));
        return;
      }

      console.log('Video blob info:', {
        size: videoBlob.size,
        type: videoBlob.type
      });

      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Add timeout for video loading
      const loadTimeout = setTimeout(() => {
        cleanup();
        reject(new Error('Video loading timeout - please try recording again'));
      }, 15000);

      const cleanup = () => {
        clearTimeout(loadTimeout);
        if (video.src) {
          URL.revokeObjectURL(video.src);
        }
      };

      video.onloadedmetadata = async () => {
        clearTimeout(loadTimeout);
        try {
          console.log('Video metadata loaded:', {
            duration: video.duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState
          });

          const duration = video.duration;
          
          if (!duration || duration === 0 || !isFinite(duration)) {
            cleanup();
            reject(new Error('Invalid video: Recording may be too short or corrupted. Please try recording again.'));
            return;
          }

          if (video.videoWidth === 0 || video.videoHeight === 0) {
            cleanup();
            reject(new Error('Invalid video: Video has no dimensions. Please check camera permissions and try again.'));
            return;
          }

          if (duration < 1) {
            cleanup();
            reject(new Error('Video too short: Please record for at least 1 second'));
            return;
          }

          const frameInterval = 1 / targetFps;
          const totalFrames = Math.floor(duration * targetFps);
          
          console.log(`Processing ${totalFrames} frames at ${targetFps}fps`);
          
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const frames: FrameData[] = [];
          
          for (let i = 0; i < totalFrames; i++) {
            const currentTime = i * frameInterval;
            video.currentTime = currentTime;
            
            await new Promise<void>((resolve, reject) => {
              const seekTimeout = setTimeout(() => {
                reject(new Error(`Video processing failed: Unable to read frame ${i}. The video may be corrupted.`));
              }, 3000); // Increased timeout

              const handleSeeked = () => {
                clearTimeout(seekTimeout);
                video.removeEventListener('seeked', handleSeeked);
                video.removeEventListener('error', handleError);
                resolve();
              };

              const handleError = () => {
                clearTimeout(seekTimeout);
                video.removeEventListener('seeked', handleSeeked);
                video.removeEventListener('error', handleError);
                reject(new Error(`Video processing error at frame ${i}: Video may be corrupted`));
              };

              video.addEventListener('seeked', handleSeeked);
              video.addEventListener('error', handleError);
            });
            
            // Draw frame to canvas
            ctx.drawImage(video, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Check if we got valid image data
            if (imageData.data.length === 0) {
              console.warn(`No image data at frame ${i}`);
              continue;
            }
            
            // Send frame to worker for pose detection
            try {
              const frameResult = await this.processFrameInWorker(imageData.data, canvas.width, canvas.height, currentTime * 1000);
              
              if (frameResult) {
                frames.push(frameResult);
              }
            } catch (frameError) {
              console.warn(`Frame processing failed at frame ${i}:`, frameError);
              // Continue with next frame instead of failing completely
            }
            
            // Update progress
            if (i % 5 === 0) {
              const progress = (i / totalFrames) * 100;
              onProgress?.(`Processing frames: ${progress.toFixed(1)}%`);
            }
          }
          
          console.log(`Successfully processed ${frames.length} frames`);
          cleanup();
          
          if (frames.length === 0) {
            reject(new Error('No valid frames found: Video may be corrupted or too short'));
            return;
          }
          
          resolve(frames);
        } catch (error) {
          console.error('Video processing error:', error);
          cleanup();
          reject(error);
        }
      };
      
      video.onerror = (event) => {
        cleanup();
        console.error('Video load error:', event);
        reject(new Error('Video format not supported: Please try recording again with a different device or browser'));
      };

      video.onloadstart = () => {
        console.log('Video load started');
      };

      // Set video attributes for better compatibility
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      
      try {
        const url = URL.createObjectURL(videoBlob);
        video.src = url;
        console.log('Video src set, waiting for metadata...');
        
        // Force load the video
        video.load();
      } catch (error) {
        cleanup();
        reject(new Error(`Failed to create video: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    });
  }

  private async processFrameInWorker(imageData: Uint8ClampedArray, width: number, height: number, timestamp: number): Promise<FrameData | null> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.worker) {
          this.worker.removeEventListener('message', handleMessage);
        }
        reject(new Error('Worker frame processing timeout'));
      }, 5000);

      const handleMessage = (event: MessageEvent) => {
        const { type, result, message, error } = event.data;

        if (this.worker) {
          this.worker.removeEventListener('message', handleMessage);
        }
        clearTimeout(timeout);

        switch (type) {
          case 'frameResult':
            resolve(result);
            break;
          case 'error':
            console.error('Worker frame processing error:', message);
            reject(new Error(message || error || 'Worker processing failed'));
            break;
          default:
            // Ignore other message types
            return;
        }
      };

      if (this.worker) {
        this.worker.addEventListener('message', handleMessage);

        // Send frame data for processing
        try {
          this.worker.postMessage({
            type: 'processFrameData',
            data: { 
              imageData: Array.from(imageData),
              width, 
              height, 
              timestamp 
            }
          });
        } catch (error) {
          clearTimeout(timeout);
          this.worker.removeEventListener('message', handleMessage);
          reject(new Error(`Failed to send frame to worker: ${error}`));
        }
      } else {
        clearTimeout(timeout);
        reject(new Error('Worker not available'));
      }
    });
  }

  private async processFramesForAnalysis(frames: FrameData[]): Promise<PoseAnalysisResult> {
    // Simple swing segmentation and analysis
    const events: SwingEvents = this.segmentSwing(frames);
    
    return {
      events,
      keypointsByFrame: frames,
      quality: frames.length < 30 ? 'low_confidence' : undefined
    };
  }

  private segmentSwing(frames: FrameData[]): SwingEvents {
    // Simple phase detection based on frame count
    const totalFrames = frames.length;
    
    return {
      load_start: Math.floor(totalFrames * 0.1),
      stride_plant: Math.floor(totalFrames * 0.3),
      launch: Math.floor(totalFrames * 0.4),
      contact: Math.floor(totalFrames * 0.5),
      extension: Math.floor(totalFrames * 0.7),
      finish: Math.floor(totalFrames * 0.9)
    };
  }

  public getSwingPhaseNames(): Record<keyof SwingEvents, string> {
    return {
      load_start: 'Load Start',
      stride_plant: 'Stride Plant',
      launch: 'Launch',
      contact: 'Contact',
      extension: 'Extension',
      finish: 'Finish'
    };
  }

  public formatSwingPhase(events: SwingEvents, keypointsByFrame: FrameData[]): Array<{
    phase: string;
    frameIndex: number;
    timestamp: number;
    description: string;
  }> {
    const phaseNames = this.getSwingPhaseNames();
    const phases: Array<{
      phase: string;
      frameIndex: number;
      timestamp: number;
      description: string;
    }> = [];

    const descriptions = {
      load_start: 'Batter begins loading weight and rotating hips',
      stride_plant: 'Lead foot makes contact with the ground',
      launch: 'Peak hip rotation - explosive power transfer begins',
      contact: 'Bat makes contact with the ball',
      extension: 'Maximum arm extension through the swing',
      finish: 'Follow-through complete, balanced finish position'
    };

    Object.entries(events).forEach(([key, frameIndex]) => {
      if (frameIndex !== undefined && frameIndex < keypointsByFrame.length) {
        const frame = keypointsByFrame[frameIndex];
        phases.push({
          phase: phaseNames[key as keyof SwingEvents],
          frameIndex,
          timestamp: frame.t,
          description: descriptions[key as keyof typeof descriptions]
        });
      }
    });

    return phases.sort((a, b) => a.frameIndex - b.frameIndex);
  }

  public isReady(): boolean {
    return this.isInitialized && !this.isProcessing;
  }

  public isWorking(): boolean {
    return this.isProcessing;
  }

  public cleanup(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'cleanup' });
      this.worker.terminate();
      this.worker = null;
    }
    this.isInitialized = false;
    this.isProcessing = false;
  }
}

// Export singleton instance
export const poseWorkerClient = new PoseWorkerClient();