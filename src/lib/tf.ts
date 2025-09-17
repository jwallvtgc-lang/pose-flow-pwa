import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

export const initTf = async () => {
  await tf.setBackend('webgl');
  await tf.ready();
  console.log('TensorFlow.js initialized with WebGL backend');
};

export { tf };