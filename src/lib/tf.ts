import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';

let detector: poseDetection.PoseDetector | null = null;

export const initTf = async () => {
  await tf.setBackend('webgl');
  await tf.ready();
  console.log('TensorFlow.js initialized with WebGL backend');
};

export const initializeTensorFlow = async () => {
  // Set WebGL backend
  await tf.setBackend('webgl');
  await tf.ready();
  
  // Initialize pose detector with BlazePose (doesn't require MediaPipe)
  const model = poseDetection.SupportedModels.BlazePose;
  detector = await poseDetection.createDetector(model, {
    runtime: 'tfjs',
    modelType: 'lite'
  });
  
  return detector;
};

export const detectPoses = async (video: HTMLVideoElement) => {
  if (!detector) {
    throw new Error('TensorFlow not initialized. Call initializeTensorFlow first.');
  }
  
  const poses = await detector.estimatePoses(video);
  return poses;
};

export const getDetector = () => detector;

export { tf };