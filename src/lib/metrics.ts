// Phase 1 swing metrics computation from pose detection data
import type { FrameData, SwingEvents } from './poseWorkerClient';

// Constants
const IDEAL_CONTACT_DELAY_MS = 100; // 100ms from launch to ideal contact timing

// Types
export interface MetricsResult {
  metrics: Record<string, number | null>;
  pixelsPerCm: number | null;
  qualityFlags: {
    lowConfidence: boolean;
    missingEvents: string[];
  };
}

// Helper function to get keypoint by name
function getKeypoint(keypoints: any[], name: string) {
  return keypoints.find((kp: any) => kp.name === name) || null;
}

// Calculate distance between two points
function distance(p1: any, p2: any): number {
  if (!p1 || !p2) return 0;
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

// Calculate angle between two vectors in degrees
function angleBetweenVectors(v1: {x: number, y: number}, v2: {x: number, y: number}): number {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  
  if (mag1 === 0 || mag2 === 0) return 0;
  
  const cosAngle = dot / (mag1 * mag2);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  return Math.abs(Math.acos(clampedCos) * (180 / Math.PI));
}

// Calculate angle of a line relative to vertical (positive = tilted right)
function angleFromVertical(p1: any, p2: any): number {
  if (!p1 || !p2) return 0;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.atan2(dx, dy) * (180 / Math.PI);
}

// Calculate trajectory angle over a window of frames
function calculateTrajectoryAngle(frames: FrameData[], centerIdx: number, windowSize: number, keypointName: string): number {
  const startIdx = Math.max(0, centerIdx - windowSize);
  const endIdx = Math.min(frames.length - 1, centerIdx + windowSize);
  
  const startFrame = frames[startIdx];
  const endFrame = frames[endIdx];
  
  const startPoint = getKeypoint(startFrame.keypoints, keypointName);
  const endPoint = getKeypoint(endFrame.keypoints, keypointName);
  
  if (!startPoint || !endPoint) return 0;
  
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  
  // Return angle in degrees (negative = downward trajectory)
  return Math.atan2(-dy, dx) * (180 / Math.PI);
}

// Estimate pixels per cm using hip-to-ankle distance as body height proxy
function estimatePixelsPerCm(frame: FrameData): number | null {
  const leftHip = getKeypoint(frame.keypoints, 'left_hip');
  const rightHip = getKeypoint(frame.keypoints, 'right_hip');
  const leftAnkle = getKeypoint(frame.keypoints, 'left_ankle');
  const rightAnkle = getKeypoint(frame.keypoints, 'right_ankle');
  
  if (!leftHip || !rightHip || !leftAnkle || !rightAnkle) return null;
  
  // Average hip position
  const hipCenter = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };
  
  // Average ankle position
  const ankleCenter = {
    x: (leftAnkle.x + rightAnkle.x) / 2,
    y: (leftAnkle.y + rightAnkle.y) / 2
  };
  
  const hipToAnklePixels = distance(hipCenter, ankleCenter);
  
  // Assumption: hip-to-ankle distance is approximately 60% of body height
  // Average adult body height is ~170cm, so hip-to-ankle ≈ 102cm
  const assumedHipToAnkleCm = 102;
  
  return hipToAnklePixels > 0 ? hipToAnklePixels / assumedHipToAnkleCm : null;
}

// Calculate head center from eyes and nose
function getHeadCenter(keypoints: any[]) {
  const nose = getKeypoint(keypoints, 'nose');
  const leftEye = getKeypoint(keypoints, 'left_eye');
  const rightEye = getKeypoint(keypoints, 'right_eye');
  
  const validPoints = [nose, leftEye, rightEye].filter(p => p && p.score > 0.3);
  
  if (validPoints.length === 0) return null;
  
  const avgX = validPoints.reduce((sum, p) => sum + p.x, 0) / validPoints.length;
  const avgY = validPoints.reduce((sum, p) => sum + p.y, 0) / validPoints.length;
  
  return { x: avgX, y: avgY };
}

// Calculate center of mass (approximate using hips)
function getCenterOfMass(keypoints: any[]) {
  const leftHip = getKeypoint(keypoints, 'left_hip');
  const rightHip = getKeypoint(keypoints, 'right_hip');
  
  if (!leftHip || !rightHip) return null;
  
  return {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2
  };
}

// Main metrics computation function
export function computePhase1Metrics(
  keypointsByFrame: FrameData[], 
  events: SwingEvents, 
  fps: number,
  recentStrideLengths: number[] = []
): MetricsResult {
  const metrics: Record<string, number | null> = {};
  let pixelsPerCm: number | null = null;
  const qualityFlags = {
    lowConfidence: false,
    missingEvents: [] as string[]
  };
  
  // Check for missing critical events
  const requiredEvents = ['launch', 'contact', 'finish'];
  const missingEvents = requiredEvents.filter(event => !events[event as keyof SwingEvents]);
  qualityFlags.missingEvents = missingEvents;
  
  // Get event frame indices
  const launchIdx = events.launch;
  const contactIdx = events.contact;
  const finishIdx = events.finish;
  const strideIdx = events.stride_plant;
  
  // Estimate pixel-to-cm scaling from launch frame
  if (launchIdx && launchIdx < keypointsByFrame.length) {
    pixelsPerCm = estimatePixelsPerCm(keypointsByFrame[launchIdx]);
  }
  
  // 1. Hip-shoulder separation angle at launch
  if (launchIdx && launchIdx < keypointsByFrame.length) {
    const frame = keypointsByFrame[launchIdx];
    const leftShoulder = getKeypoint(frame.keypoints, 'left_shoulder');
    const rightShoulder = getKeypoint(frame.keypoints, 'right_shoulder');
    const leftHip = getKeypoint(frame.keypoints, 'left_hip');
    const rightHip = getKeypoint(frame.keypoints, 'right_hip');
    
    if (leftShoulder && rightShoulder && leftHip && rightHip) {
      const shoulderVector = {
        x: rightShoulder.x - leftShoulder.x,
        y: rightShoulder.y - leftShoulder.y
      };
      const hipVector = {
        x: rightHip.x - leftHip.x,
        y: rightHip.y - leftHip.y
      };
      
      metrics.hip_shoulder_sep_deg = angleBetweenVectors(shoulderVector, hipVector);
    } else {
      metrics.hip_shoulder_sep_deg = null;
    }
  } else {
    metrics.hip_shoulder_sep_deg = null;
  }
  
  // 2. Attack angle at contact
  if (contactIdx && contactIdx < keypointsByFrame.length) {
    const attackAngle = calculateTrajectoryAngle(keypointsByFrame, contactIdx, 3, 'left_wrist');
    metrics.attack_angle_deg = attackAngle !== 0 ? attackAngle : null;
  } else {
    metrics.attack_angle_deg = null;
  }
  
  // 3. Head drift from launch to contact
  if (launchIdx && contactIdx && launchIdx < keypointsByFrame.length && contactIdx < keypointsByFrame.length && pixelsPerCm) {
    const launchHead = getHeadCenter(keypointsByFrame[launchIdx].keypoints);
    const contactHead = getHeadCenter(keypointsByFrame[contactIdx].keypoints);
    
    if (launchHead && contactHead) {
      const headDriftPixels = distance(launchHead, contactHead);
      metrics.head_drift_cm = headDriftPixels / pixelsPerCm;
    } else {
      metrics.head_drift_cm = null;
    }
  } else {
    metrics.head_drift_cm = null;
  }
  
  // 4. Contact timing relative to ideal
  if (launchIdx && contactIdx) {
    const idealFrames = Math.round((IDEAL_CONTACT_DELAY_MS / 1000) * fps);
    metrics.contact_timing_frames = contactIdx - (launchIdx + idealFrames);
  } else {
    metrics.contact_timing_frames = null;
  }
  
  // 5. Bat lag angle at launch
  if (launchIdx && launchIdx < keypointsByFrame.length) {
    const frame = keypointsByFrame[launchIdx];
    const leftElbow = getKeypoint(frame.keypoints, 'left_elbow');
    const rightElbow = getKeypoint(frame.keypoints, 'right_elbow');
    const leftWrist = getKeypoint(frame.keypoints, 'left_wrist');
    const rightWrist = getKeypoint(frame.keypoints, 'right_wrist');
    
    if (leftElbow && leftWrist && rightElbow && rightWrist) {
      // Lead forearm vector (assuming left is lead)
      const forearmVector = {
        x: leftWrist.x - leftElbow.x,
        y: leftWrist.y - leftElbow.y
      };
      
      // Barrel proxy: mid-elbows to mid-wrists
      const midElbows = {
        x: (leftElbow.x + rightElbow.x) / 2,
        y: (leftElbow.y + rightElbow.y) / 2
      };
      const midWrists = {
        x: (leftWrist.x + rightWrist.x) / 2,
        y: (leftWrist.y + rightWrist.y) / 2
      };
      const barrelVector = {
        x: midWrists.x - midElbows.x,
        y: midWrists.y - midElbows.y
      };
      
      metrics.bat_lag_deg = angleBetweenVectors(forearmVector, barrelVector);
    } else {
      metrics.bat_lag_deg = null;
    }
  } else {
    metrics.bat_lag_deg = null;
  }
  
  // 6. Torso tilt at launch
  if (launchIdx && launchIdx < keypointsByFrame.length) {
    const frame = keypointsByFrame[launchIdx];
    const leftShoulder = getKeypoint(frame.keypoints, 'left_shoulder');
    const rightShoulder = getKeypoint(frame.keypoints, 'right_shoulder');
    const leftHip = getKeypoint(frame.keypoints, 'left_hip');
    const rightHip = getKeypoint(frame.keypoints, 'right_hip');
    
    if (leftShoulder && rightShoulder && leftHip && rightHip) {
      const shoulderCenter = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2
      };
      const hipCenter = {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2
      };
      
      metrics.torso_tilt_deg = Math.abs(angleFromVertical(hipCenter, shoulderCenter));
    } else {
      metrics.torso_tilt_deg = null;
    }
  } else {
    metrics.torso_tilt_deg = null;
  }
  
  // 7. Stride length variance
  if (strideIdx && launchIdx && strideIdx < keypointsByFrame.length && launchIdx < keypointsByFrame.length) {
    const strideFrame = keypointsByFrame[strideIdx];
    const launchFrame = keypointsByFrame[launchIdx];
    
    const strideAnkle = getKeypoint(strideFrame.keypoints, 'left_ankle');
    const launchAnkle = getKeypoint(launchFrame.keypoints, 'left_ankle');
    
    if (strideAnkle && launchAnkle && recentStrideLengths.length >= 3) {
      const currentStride = distance(strideAnkle, launchAnkle);
      const recentMean = recentStrideLengths.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const variance = Math.abs(currentStride - recentMean) / recentMean;
      metrics.stride_var_pct = variance * 100;
    } else {
      metrics.stride_var_pct = 0; // Return 0 if no recent data as specified
    }
  } else {
    metrics.stride_var_pct = 0;
  }
  
  // 8. Finish balance index
  if (finishIdx && finishIdx < keypointsByFrame.length) {
    const frame = keypointsByFrame[finishIdx];
    const com = getCenterOfMass(frame.keypoints);
    const leftFoot = getKeypoint(frame.keypoints, 'left_ankle');
    const rightFoot = getKeypoint(frame.keypoints, 'right_ankle');
    
    if (com && leftFoot && rightFoot) {
      const footSpan = Math.abs(rightFoot.x - leftFoot.x);
      const footCenter = (leftFoot.x + rightFoot.x) / 2;
      const comOffset = Math.abs(com.x - footCenter);
      
      if (footSpan > 0) {
        // Normalize to [0, 1] where 0 is perfect balance, 1 is maximum offset
        metrics.finish_balance_idx = Math.min(1, comOffset / (footSpan / 2));
      } else {
        metrics.finish_balance_idx = null;
      }
    } else {
      metrics.finish_balance_idx = null;
    }
  } else {
    metrics.finish_balance_idx = null;
  }
  
  // Check for low confidence indicators
  const nullMetrics = Object.values(metrics).filter(v => v === null).length;
  const totalMetrics = Object.keys(metrics).length;
  qualityFlags.lowConfidence = (nullMetrics / totalMetrics) > 0.4 || missingEvents.length > 1;
  
  return {
    metrics,
    pixelsPerCm,
    qualityFlags
  };
}

// Units for each metric
export function metricUnits(): Record<string, string> {
  return {
    hip_shoulder_sep_deg: 'deg',
    attack_angle_deg: 'deg',
    head_drift_cm: 'cm',
    contact_timing_frames: 'frames',
    bat_lag_deg: 'deg',
    torso_tilt_deg: 'deg',
    stride_var_pct: '%',
    finish_balance_idx: 'index'
  };
}

// Get metric display names
export function metricDisplayNames(): Record<string, string> {
  return {
    hip_shoulder_sep_deg: 'Hip-Shoulder Separation',
    attack_angle_deg: 'Attack Angle',
    head_drift_cm: 'Head Drift',
    contact_timing_frames: 'Contact Timing',
    bat_lag_deg: 'Bat Lag',
    torso_tilt_deg: 'Torso Tilt',
    stride_var_pct: 'Stride Variance',
    finish_balance_idx: 'Finish Balance'
  };
}

// Constants for tuning
export const METRIC_CONSTANTS = {
  IDEAL_CONTACT_DELAY_MS,
  TRAJECTORY_WINDOW_FRAMES: 3,
  ASSUMED_HIP_TO_ANKLE_CM: 102,
  LOW_CONFIDENCE_THRESHOLD: 0.4
};