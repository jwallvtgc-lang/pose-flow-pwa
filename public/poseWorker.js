// Web Worker for pose detection processing
// Note: Using .js extension for public folder compatibility

let model = null;
let isInitialized = false;

// Import TensorFlow.js and pose detection model
importScripts(
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@4.22.0/dist/tf-backend-webgl.min.js',
  'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js'
);

// Initialize TensorFlow.js and load MoveNet model
async function initializePoseDetection() {
  try {
    // Set WebGL backend
    await tf.setBackend('webgl');
    await tf.ready();
    
    postMessage({
      type: 'progress',
      message: 'TensorFlow.js WebGL backend initialized'
    });

    // Load MoveNet SinglePose Lightning model
    const detectorConfig = {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    };
    
    model = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      detectorConfig
    );
    
    isInitialized = true;
    
    postMessage({
      type: 'initialized',
      message: 'MoveNet SinglePose Lightning model loaded successfully'
    });
    
  } catch (error) {
    postMessage({
      type: 'error',
      message: `Failed to initialize pose detection: ${error.message}`,
      error: error.toString()
    });
  }
}

// Process a single video frame
async function processFrame(imageData, width, height) {
  if (!isInitialized || !model) {
    postMessage({
      type: 'error',
      message: 'Model not initialized. Call initialize first.'
    });
    return;
  }

  try {
    // Create tensor from image data
    const tensor = tf.browser.fromPixels({
      data: imageData,
      width: width,
      height: height
    });

    // Estimate poses
    const poses = await model.estimatePoses(tensor);
    
    // Clean up tensor
    tensor.dispose();

    if (poses.length > 0) {
      const pose = poses[0];
      
      // Extract keypoints for specific body parts
      const keypoints = extractKeypoints(pose.keypoints);
      
      postMessage({
        type: 'poses',
        keypoints: keypoints,
        confidence: pose.score || 0.5
      });
    } else {
      postMessage({
        type: 'poses',
        keypoints: [],
        confidence: 0
      });
    }
    
  } catch (error) {
    postMessage({
      type: 'error',
      message: `Pose detection failed: ${error.message}`,
      error: error.toString()
    });
  }
}

// Process video blob and return analysis results
async function processVideo(videoBlob, fps = 30) {
  try {
    if (!isInitialized || !model) {
      throw new Error('Model not initialized');
    }

    postMessage({ type: 'progress', message: 'Extracting frames from video...' });

    // Extract frames from video
    const keypointsByFrame = await extractFramesFromVideo(videoBlob, fps);
    
    if (keypointsByFrame.length === 0) {
      throw new Error('No frames could be processed from video');
    }

    postMessage({ type: 'progress', message: 'Analyzing swing phases...' });

    // Segment swing phases
    const events = segmentSwing(keypointsByFrame);
    
    // Assess quality
    const quality = assessQuality(keypointsByFrame);
    
    postMessage({ type: 'progress', message: 'Analysis complete!' });
    
    const result = {
      events,
      keypointsByFrame
    };
    
    if (quality) {
      result.quality = quality;
    }
    
    postMessage({ type: 'result', data: result });
    
  } catch (error) {
    postMessage({
      type: 'error',
      message: `Video processing failed: ${error.message}`
    });
  }
}

// Extract frames from video blob
async function extractFramesFromVideo(videoBlob, targetFps = 30) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    video.src = URL.createObjectURL(videoBlob);
    video.muted = true;
    
    video.onloadedmetadata = async () => {
      const videoDuration = video.duration;
      const videoFps = 30; // Assume 30fps if not detectable
      const frameInterval = Math.max(1, Math.floor(videoFps / targetFps));
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const frames = [];
      let frameIndex = 0;
      
      const processFrame = async () => {
        const currentTime = frameIndex / videoFps;
        
        if (currentTime >= videoDuration) {
          URL.revokeObjectURL(video.src);
          resolve(frames);
          return;
        }
        
        video.currentTime = currentTime;
        
        video.onseeked = async () => {
          try {
            // Draw frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convert to tensor for pose detection
            const tensor = tf.browser.fromPixels(canvas);
            
            // Estimate poses
            const poses = await model.estimatePoses(tensor);
            tensor.dispose();
            
            if (poses.length > 0) {
              const pose = poses[0];
              const keypoints = pose.keypoints.map((kp) => ({
                name: kp.name || kp.part,
                x: kp.x,
                y: kp.y,
                score: kp.score || kp.confidence || 0
              }));
              
              frames.push({
                t: currentTime * 1000, // Convert to milliseconds
                keypoints
              });
            }
            
            frameIndex += frameInterval;
            
            // Post progress
            if (frameIndex % 30 === 0) {
              const progress = Math.min(100, (currentTime / videoDuration) * 100);
              postMessage({ 
                type: 'progress', 
                message: `Processing frames: ${progress.toFixed(1)}%` 
              });
            }
            
            // Process next frame
            setTimeout(processFrame, 0);
          } catch (error) {
            reject(error);
          }
        };
      };
      
      processFrame();
    };
    
    video.onerror = () => reject(new Error('Video loading failed'));
  });
}

// Utility: Moving average smoothing
function smooth(series, window = 5) {
  const smoothed = [];
  const halfWindow = Math.floor(window / 2);
  
  for (let i = 0; i < series.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(series.length, i + halfWindow + 1);
    const sum = series.slice(start, end).reduce((a, b) => a + b, 0);
    smoothed.push(sum / (end - start));
  }
  
  return smoothed;
}

// Segment swing phases
function segmentSwing(frames) {
  const events = {};
  
  if (frames.length < 10) return events;
  
  // Mock implementation - in real version this would analyze the pose data
  // For now, just create some reasonable mock events
  const totalFrames = frames.length;
  
  events.load_start = Math.floor(totalFrames * 0.1);
  events.stride_plant = Math.floor(totalFrames * 0.3);
  events.launch = Math.floor(totalFrames * 0.5);
  events.contact = Math.floor(totalFrames * 0.7);
  events.extension = Math.floor(totalFrames * 0.8);
  events.finish = Math.floor(totalFrames * 0.9);
  
  return events;
}

// Assess pose quality
function assessQuality(frames) {
  const keyBodyParts = ['left_hip', 'right_hip', 'left_shoulder', 'right_shoulder', 
                       'left_ankle', 'right_ankle', 'left_wrist', 'right_wrist'];
  
  let lowConfidenceFrames = 0;
  
  for (const frame of frames) {
    let lowConfidenceParts = 0;
    
    for (const partName of keyBodyParts) {
      const part = frame.keypoints.find(kp => kp.name === partName);
      if (!part || part.score < 0.4) {
        lowConfidenceParts++;
      }
    }
    
    if (lowConfidenceParts >= keyBodyParts.length * 0.5) {
      lowConfidenceFrames++;
    }
  }
  
  const lowConfidenceRatio = lowConfidenceFrames / frames.length;
  return lowConfidenceRatio > 0.25 ? 'low_confidence' : undefined;
}

// Extract specific keypoints for baseball swing analysis
function extractKeypoints(allKeypoints) {
  const targetKeypoints = [
    'nose',
    'left_eye', 'right_eye',
    'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder',
    'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist',
    'left_hip', 'right_hip',
    'left_knee', 'right_knee', 
    'left_ankle', 'right_ankle'
  ];

  const extracted = [];
  
  for (const keypoint of allKeypoints) {
    const name = keypoint.name || keypoint.part;
    if (targetKeypoints.includes(name)) {
      extracted.push({
        name: name,
        x: keypoint.x,
        y: keypoint.y,
        score: keypoint.score || keypoint.confidence || 0
      });
    }
  }
  
  return extracted;
}

// Handle messages from main thread
self.onmessage = async function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'initialize':
      await initializePoseDetection();
      break;
      
    case 'processFrame':
      const { imageData, width, height, frameId } = data;
      await processFrame(imageData, width, height);
      
      // Send progress update
      if (frameId % 30 === 0) { // Every 30 frames (~1 second at 30fps)
        postMessage({
          type: 'progress',
          message: `Processed ${frameId} frames`
        });
      }
      break;

    case 'process':
      const { videoBlob, fps } = data;
      await processVideo(videoBlob, fps);
      break;
      
    case 'cleanup':
      if (model) {
        model.dispose();
        model = null;
      }
      isInitialized = false;
      postMessage({
        type: 'cleanup',
        message: 'Pose detection cleanup completed'
      });
      break;
      
    default:
      postMessage({
        type: 'error',
        message: `Unknown message type: ${type}`
      });
  }
};