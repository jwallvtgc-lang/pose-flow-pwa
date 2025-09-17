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
      // Create worker from TypeScript file (Vite will handle compilation in dev)
      this.worker = new Worker(
        new URL('/workers/poseWorker.ts', import.meta.url),
        { type: 'module' }
      );

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
      return new Promise((resolve, reject) => {
        if (!this.worker) {
          reject(new Error('Worker not available'));
          return;
        }

        // Set up message handler for this analysis
        const messageHandler = (e: MessageEvent) => {
          const { type, data, message } = e.data;

          switch (type) {
            case 'progress':
              onProgress?.(message);
              break;

            case 'result':
              // Analysis complete
              this.worker!.removeEventListener('message', messageHandler);
              this.isProcessing = false;
              resolve(data);
              break;

            case 'error':
              this.worker!.removeEventListener('message', messageHandler);
              this.isProcessing = false;
              reject(new Error(message));
              break;
          }
        };

        this.worker.addEventListener('message', messageHandler);

        // Start processing
        this.worker.postMessage({
          type: 'process',
          data: { videoBlob, fps }
        });
      });

    } catch (error) {
      this.isProcessing = false;
      throw error;
    }
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