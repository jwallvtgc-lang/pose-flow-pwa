// TensorFlow utilities for pose detection
// Create this file at: src/utils/tensorflow.ts

export const loadPoseDetection = async () => {
  try {
    // Initialize TensorFlow backend first
    await import('@tensorflow/tfjs-backend-webgl');
    
    // Then import pose detection
    const poseDetection = await import('@tensorflow-models/pose-detection');
    const tf = await import('@tensorflow/tfjs');
    
    // Set backend
    await tf.setBackend('webgl');
    await tf.ready();
    
    return poseDetection;
  } catch (error) {
    console.error('Failed to load pose detection:', error);
    throw error;
  }
};

// Usage example for your components
export const initializePoseDetection = async () => {
  const poseDetection = await loadPoseDetection();
  
  // Create detector with MoveNet (lightweight and fast)
  const detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
    }
  );
  
  return detector;
};

// Alternative: BlazePose detector (more accurate but slower)
export const initializeBlazePoseDetection = async () => {
  const poseDetection = await loadPoseDetection();
  
  const detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.BlazePose,
    {
      runtime: 'tfjs',
      modelType: 'lite'
    }
  );
  
  return detector;
};

// Utility to estimate poses from an image or video
export const estimatePoses = async (
  detector: any, 
  imageElement: HTMLImageElement | HTMLVideoElement
) => {
  try {
    const poses = await detector.estimatePoses(imageElement);
    return poses;
  } catch (error) {
    console.error('Failed to estimate poses:', error);
    return [];
  }
};
