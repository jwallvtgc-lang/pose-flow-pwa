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
  const dy = p2.y - p1.y; // Note: y increases downward in screen coords
  
  // Calculate angle from vertical axis
  // Since y increases downward, negate dy to get proper vertical reference
  // atan2(dx, -dy) gives angle from vertical where 0° = straight up
  const angle = Math.atan2(dx, -dy) * (180 / Math.PI);
  
  // Normalize to [0, 90] range - we only care about magnitude of tilt
  // If angle > 90, the body is leaning more than 90° which means we measured the wrong direction
  // In that case, take 180 - angle to get the actual tilt
  const normalizedAngle = Math.abs(angle);
  
  if (normalizedAngle > 90) {
    // We're measuring the angle on the wrong side, flip it
    return 180 - normalizedAngle;
  }
  
  return normalizedAngle;
}

// Calculate trajectory angle over a window of frames
function calculateTrajectoryAngle(frames: FrameData[], centerIdx: number, windowSize: number, keypointName: string): number {
  // Use a larger window for more stable measurement
  const actualWindowSize = Math.max(windowSize, 3);
  const startIdx = Math.max(0, centerIdx - actualWindowSize);
  const endIdx = Math.min(frames.length - 1, centerIdx + actualWindowSize);
  
  const startFrame = frames[startIdx];
  const endFrame = frames[endIdx];
  
  const startPoint = getKeypoint(startFrame.keypoints, keypointName);
  const endPoint = getKeypoint(endFrame.keypoints, keypointName);
  
  if (!startPoint || !endPoint) return 0;
  
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  
  // Attack angle: measure angle from horizontal
  // Positive = upward swing, Negative = downward swing
  // Note: y increases downward in screen coords, so negate dy to get proper vertical direction
  let angle = Math.atan2(-dy, dx) * (180 / Math.PI);
  
  // Clamp to reasonable range for baseball swing: -45° to 45°
  // Values outside this range likely indicate measurement error
  if (angle > 45) angle = 45;
  if (angle < -45) angle = -45;
  
  return angle;
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
  if (contactIdx && contactIdx >= 5 && contactIdx < keypointsByFrame.length) {
    // Measure the attack angle from frames BEFORE contact (approach angle)
    // Use frames 5-2 frames before contact to avoid the deceleration at contact
    const measureIdx = contactIdx - 3;
    
    // Use right wrist for more accurate bat path (typically bottom hand on bat)
    // Try both wrists and use the one with higher confidence
    const leftWristAngle = calculateTrajectoryAngle(keypointsByFrame, measureIdx, 2, 'left_wrist');
    const rightWristAngle = calculateTrajectoryAngle(keypointsByFrame, measureIdx, 2, 'right_wrist');
    
    const leftWrist = getKeypoint(keypointsByFrame[measureIdx].keypoints, 'left_wrist');
    const rightWrist = getKeypoint(keypointsByFrame[measureIdx].keypoints, 'right_wrist');
    
    const leftScore = leftWrist?.score || 0;
    const rightScore = rightWrist?.score || 0;
    
    // Use the wrist with higher confidence, or average if both are good
    let attackAngle;
    if (leftScore > 0.5 && rightScore > 0.5) {
      attackAngle = (leftWristAngle + rightWristAngle) / 2;
    } else if (leftScore >= rightScore) {
      attackAngle = leftWristAngle;
    } else {
      attackAngle = rightWristAngle;
    }
    
    // Ensure attack angle is positive (upward swing path typical in baseball)
    // If negative, it likely means we're measuring the wrong direction
    if (attackAngle < 0) {
      attackAngle = Math.abs(attackAngle);
    }
    
    // Log for debugging
    console.log('📐 Attack angle calculated:', attackAngle.toFixed(1), '° (target: 5-20°)', 
                'L:', leftWristAngle.toFixed(1), 'R:', rightWristAngle.toFixed(1),
                'measured at frame', measureIdx, '(contact at', contactIdx, ')');
    
    // Only set if we got a valid measurement
    metrics.attack_angle_deg = !isNaN(attackAngle) ? attackAngle : null;
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
      
      const tiltAngle = angleFromVertical(hipCenter, shoulderCenter);
      
      // Log for debugging
      console.log('📐 Torso tilt calculated:', tiltAngle.toFixed(1), '° (target: 20-35°)');
      
      metrics.torso_tilt_deg = tiltAngle;
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