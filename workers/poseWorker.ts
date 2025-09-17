// TypeScript Web Worker for pose detection and swing analysis
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as poseDetection from '@tensorflow-models/pose-detection';

// Types
interface Keypoint {
  name: string;
  x: number;
  y: number;
  score: number;
}

interface FrameData {
  t: number;
  keypoints: Keypoint[];
}

interface SwingEvents {
  load_start?: number;
  stride_plant?: number;
  launch?: number;
  contact?: number;
  extension?: number;
  finish?: number;
}

interface WorkerInput {
  videoBlob: Blob;
  fps?: number;
}

interface WorkerOutput {
  events: SwingEvents;
  keypointsByFrame: FrameData[];
  quality?: 'low_confidence';
  error?: string;
}

// Global variables
let model: poseDetection.PoseDetector | null = null;
let isInitialized = false;

// Initialize TensorFlow.js and load MoveNet model
async function initializePoseDetection(): Promise<void> {
  try {
    // Set WebGL backend
    await tf.setBackend('webgl');
    await tf.ready();
    
    postMessage({ type: 'progress', message: 'TensorFlow.js WebGL backend initialized' });

    // Load MoveNet SinglePose Lightning model
    const detectorConfig = {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    };
    
    model = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      detectorConfig
    );
    
    isInitialized = true;
    postMessage({ type: 'progress', message: 'MoveNet SinglePose Lightning model loaded' });
    
  } catch (error) {
    postMessage({
      type: 'error',
      message: `Failed to initialize pose detection: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

// Utility: Moving average smoothing
function smooth(series: number[], window: number = 5): number[] {
  const smoothed: number[] = [];
  const halfWindow = Math.floor(window / 2);
  
  for (let i = 0; i < series.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(series.length, i + halfWindow + 1);
    const sum = series.slice(start, end).reduce((a, b) => a + b, 0);
    smoothed.push(sum / (end - start));
  }
  
  return smoothed;
}

// Calculate angular velocity between two points
function calculateAngularVelocity(p1: Keypoint, p2: Keypoint, prevP1: Keypoint, prevP2: Keypoint, dt: number): number {
  const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const angle2 = Math.atan2(prevP2.y - prevP1.y, prevP2.x - prevP1.x);
  let angleDiff = angle1 - angle2;
  
  // Normalize angle difference to [-π, π]
  while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
  
  return angleDiff / dt;
}

// Calculate distance between two points
function distance(p1: Keypoint, p2: Keypoint): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// Get keypoint by name with fallback
function getKeypoint(keypoints: Keypoint[], name: string): Keypoint | null {
  return keypoints.find(kp => kp.name === name) || null;
}

// Calculate body height estimate from keypoints
function estimateBodyHeight(keypoints: Keypoint[]): number {
  const nose = getKeypoint(keypoints, 'nose');
  const leftAnkle = getKeypoint(keypoints, 'left_ankle');
  const rightAnkle = getKeypoint(keypoints, 'right_ankle');
  
  if (!nose || (!leftAnkle && !rightAnkle)) return 200; // Default estimate
  
  const ankle = leftAnkle && rightAnkle ? 
    { x: (leftAnkle.x + rightAnkle.x) / 2, y: (leftAnkle.y + rightAnkle.y) / 2 } :
    (leftAnkle || rightAnkle)!;
  
  return Math.abs(nose.y - ankle.y);
}

// Segment swing phases
function segmentSwing(frames: FrameData[]): SwingEvents {
  const events: SwingEvents = {};
  
  if (frames.length < 10) return events; // Need minimum frames
  
  // Calculate metrics for each frame
  const pelvisAngularVel: number[] = [];
  const leadAnkleVertVel: number[] = [];
  const handSpeeds: number[] = [];
  const elbowExtensions: number[] = [];
  
  for (let i = 1; i < frames.length; i++) {
    const curr = frames[i];
    const prev = frames[i - 1];
    const dt = (curr.t - prev.t) / 1000; // Convert to seconds
    
    // Pelvis angular velocity (using hip points)
    const currLeftHip = getKeypoint(curr.keypoints, 'left_hip');
    const currRightHip = getKeypoint(curr.keypoints, 'right_hip');
    const prevLeftHip = getKeypoint(prev.keypoints, 'left_hip');
    const prevRightHip = getKeypoint(prev.keypoints, 'right_hip');
    
    if (currLeftHip && currRightHip && prevLeftHip && prevRightHip) {
      const angVel = calculateAngularVelocity(currLeftHip, currRightHip, prevLeftHip, prevRightHip, dt);
      pelvisAngularVel.push(Math.abs(angVel));
    } else {
      pelvisAngularVel.push(0);
    }
    
    // Lead ankle vertical velocity (assuming left foot is lead)
    const currAnkle = getKeypoint(curr.keypoints, 'left_ankle');
    const prevAnkle = getKeypoint(prev.keypoints, 'left_ankle');
    
    if (currAnkle && prevAnkle && dt > 0) {
      const vertVel = (currAnkle.y - prevAnkle.y) / dt;
      leadAnkleVertVel.push(vertVel);
    } else {
      leadAnkleVertVel.push(0);
    }
    
    // Hand speed (lead wrist)
    const currWrist = getKeypoint(curr.keypoints, 'left_wrist');
    const prevWrist = getKeypoint(prev.keypoints, 'left_wrist');
    
    if (currWrist && prevWrist && dt > 0) {
      const speed = distance(currWrist, prevWrist) / dt;
      handSpeeds.push(speed);
    } else {
      handSpeeds.push(0);
    }
    
    // Elbow extension
    const shoulder = getKeypoint(curr.keypoints, 'left_shoulder');
    const elbow = getKeypoint(curr.keypoints, 'left_elbow');
    const wrist = getKeypoint(curr.keypoints, 'left_wrist');
    
    if (shoulder && elbow && wrist) {
      const upperArm = distance(shoulder, elbow);
      const forearm = distance(elbow, wrist);
      const fullArm = distance(shoulder, wrist);
      const extension = fullArm / (upperArm + forearm); // Extension ratio
      elbowExtensions.push(extension);
    } else {
      elbowExtensions.push(0);
    }
  }
  
  // Smooth the calculated metrics
  const smoothPelvisVel = smooth(pelvisAngularVel, 5);
  const smoothAnkleVel = smooth(leadAnkleVertVel, 5);
  const smoothHandSpeeds = smooth(handSpeeds, 5);
  const smoothElbowExt = smooth(elbowExtensions, 5);
  
  // Detect swing phases
  
  // 1. Load start: pelvis angular velocity rises while wrists move back
  for (let i = 5; i < smoothPelvisVel.length - 5; i++) {
    if (smoothPelvisVel[i] > smoothPelvisVel[i - 1] && smoothPelvisVel[i] > 0.1) {
      events.load_start = i + 1; // Adjust for offset
      break;
    }
  }
  
  // 2. Stride plant: lead ankle vertical velocity crosses from positive to ≤0
  for (let i = (events.load_start || 0) + 3; i < smoothAnkleVel.length; i++) {
    if (smoothAnkleVel[i - 1] > 0 && smoothAnkleVel[i] <= 0) {
      events.stride_plant = i + 1;
      break;
    }
  }
  
  // 3. Launch: peak pelvis angular velocity
  let maxPelvisVel = 0;
  let launchIdx = 0;
  for (let i = (events.stride_plant || 0); i < smoothPelvisVel.length; i++) {
    if (smoothPelvisVel[i] > maxPelvisVel) {
      maxPelvisVel = smoothPelvisVel[i];
      launchIdx = i;
    }
  }
  if (launchIdx > 0) events.launch = launchIdx + 1;
  
  // 4. Contact: peak hand-speed decel + minimal distance to contact line
  let maxHandSpeed = 0;
  let contactIdx = 0;
  for (let i = (events.launch || 0); i < smoothHandSpeeds.length - 3; i++) {
    if (smoothHandSpeeds[i] > maxHandSpeed) {
      maxHandSpeed = smoothHandSpeeds[i];
    }
    // Look for deceleration after peak
    if (smoothHandSpeeds[i] > maxHandSpeed * 0.8 && 
        smoothHandSpeeds[i] > smoothHandSpeeds[i + 1] && 
        smoothHandSpeeds[i + 1] > smoothHandSpeeds[i + 2]) {
      contactIdx = i;
      break;
    }
  }
  if (contactIdx > 0) events.contact = contactIdx + 1;
  
  // 5. Extension: max elbow extension after contact
  let maxExtension = 0;
  let extensionIdx = 0;
  for (let i = (events.contact || 0); i < smoothElbowExt.length; i++) {
    if (smoothElbowExt[i] > maxExtension) {
      maxExtension = smoothElbowExt[i];
      extensionIdx = i;
    }
  }
  if (extensionIdx > 0) events.extension = extensionIdx + 1;
  
  // 6. Finish: angular velocities settle below threshold
  const threshold = 0.05;
  let settleCount = 0;
  for (let i = (events.extension || 0); i < smoothPelvisVel.length; i++) {
    if (smoothPelvisVel[i] < threshold && smoothHandSpeeds[i] < 10) {
      settleCount++;
      if (settleCount >= 8) { // 8 frames of settling
        events.finish = i - 7; // Start of settle period
        break;
      }
    } else {
      settleCount = 0;
    }
  }
  
  return events;
}

// Assess pose quality
function assessQuality(frames: FrameData[]): 'low_confidence' | undefined {
  const keyBodyParts = ['left_hip', 'right_hip', 'left_shoulder', 'right_shoulder', 
                       'left_ankle', 'right_ankle', 'left_wrist', 'right_wrist'];
  
  let lowConfidenceFrames = 0;
  
  for (const frame of frames) {
    let lowConfidenceParts = 0;
    
    for (const partName of keyBodyParts) {
      const part = getKeypoint(frame.keypoints, partName);
      if (!part || part.score < 0.4) {
        lowConfidenceParts++;
      }
    }
    
    if (lowConfidenceParts >= keyBodyParts.length * 0.5) { // >50% of key parts low confidence
      lowConfidenceFrames++;
    }
  }
  
  const lowConfidenceRatio = lowConfidenceFrames / frames.length;
  return lowConfidenceRatio > 0.25 ? 'low_confidence' : undefined;
}

// Extract frames from video blob
async function extractFramesFromVideo(videoBlob: Blob, targetFps: number = 30): Promise<FrameData[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    video.src = URL.createObjectURL(videoBlob);
    video.muted = true;
    
    video.onloadedmetadata = async () => {
      const videoDuration = video.duration;
      const videoFps = 30; // Assume 30fps if not detectable
      const frameInterval = Math.max(1, Math.floor(videoFps / targetFps));
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const frames: FrameData[] = [];
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
            
            if (!model) throw new Error('Model not initialized');
            
            // Estimate poses
            const poses = await model.estimatePoses(tensor);
            tensor.dispose();
            
            if (poses.length > 0) {
              const pose = poses[0];
              const keypoints: Keypoint[] = pose.keypoints.map((kp: any) => ({
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

// Main processing function
async function processVideo(input: WorkerInput): Promise<WorkerOutput> {
  try {
    if (!isInitialized || !model) {
      throw new Error('Pose detection not initialized');
    }
    
    postMessage({ type: 'progress', message: 'Extracting frames from video...' });
    
    // Extract frames and run pose detection
    const keypointsByFrame = await extractFramesFromVideo(input.videoBlob, input.fps || 30);
    
    if (keypointsByFrame.length === 0) {
      throw new Error('No frames could be processed from video');
    }
    
    postMessage({ type: 'progress', message: 'Analyzing swing phases...' });
    
    // Segment swing phases
    const events = segmentSwing(keypointsByFrame);
    
    // Assess quality
    const quality = assessQuality(keypointsByFrame);
    
    postMessage({ type: 'progress', message: 'Analysis complete!' });
    
    const result: WorkerOutput = {
      events,
      keypointsByFrame
    };
    
    if (quality) {
      result.quality = quality;
    }
    
    return result;
    
  } catch (error) {
    throw new Error(`Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Handle messages from main thread
self.onmessage = async function(e) {
  const { type, data } = e.data;
  
  try {
    switch (type) {
      case 'initialize':
        await initializePoseDetection();
        postMessage({ type: 'initialized', message: 'Pose worker ready' });
        break;
        
      case 'process':
        const result = await processVideo(data);
        postMessage({ type: 'result', data: result });
        break;
        
      case 'cleanup':
        if (model) {
          model.dispose();
          model = null;
        }
        isInitialized = false;
        postMessage({ type: 'cleanup', message: 'Cleanup completed' });
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
};