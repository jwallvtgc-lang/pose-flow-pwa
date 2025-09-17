import '@tensorflow/tfjs-backend-webgl';
import * as tf from '@tensorflow/tfjs';
import * as posenet from '@tensorflow-models/posenet';

let model: posenet.PoseNet | null = null;

export const initTf = async () => {
  await tf.setBackend('webgl');
  await tf.ready();
  console.log('TensorFlow.js initialized with WebGL backend');
};

export const initializeTensorFlow = async () => {
  // Set WebGL backend
  await tf.setBackend('webgl');
  await tf.ready();
  
  // Load PoseNet model - simpler and fewer dependencies
  model = await posenet.load({
    architecture: 'MobileNetV1',
    outputStride: 16,
    inputResolution: { width: 640, height: 480 },
    multiplier: 0.75
  });
  
  return model;
};

export const detectPoses = async (video: HTMLVideoElement) => {
  if (!model) {
    throw new Error('TensorFlow not initialized. Call initializeTensorFlow first.');
  }
  
  const pose = await model.estimateSinglePose(video, {
    flipHorizontal: false
  });
  
  // Convert to array format to match the expected interface
  return [pose];
};

export const getDetector = () => model;

export { tf };