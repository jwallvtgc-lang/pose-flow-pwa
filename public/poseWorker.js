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