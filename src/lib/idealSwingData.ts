// Ideal swing skeleton data for each phase
// Normalized keypoint positions (0-1 range) for display on canvas
// Based on professional baseball swing biomechanics

export type IdealKeypoints = {
  [key: string]: { x: number; y: number };
};

export type SwingPhase = 'setup' | 'load' | 'stride' | 'contact' | 'extension' | 'finish';

// MoveNet keypoint indices mapping
export const KEYPOINT_NAMES = {
  nose: 0,
  left_eye: 1,
  right_eye: 2,
  left_ear: 3,
  right_ear: 4,
  left_shoulder: 5,
  right_shoulder: 6,
  left_elbow: 7,
  right_elbow: 8,
  left_wrist: 9,
  right_wrist: 10,
  left_hip: 11,
  right_hip: 12,
  left_knee: 13,
  right_knee: 14,
  left_ankle: 15,
  right_ankle: 16,
};

// Ideal swing keypoints for each phase (right-handed batter, side view)
export const IDEAL_SWING_KEYPOINTS: Record<SwingPhase, IdealKeypoints> = {
  setup: {
    nose: { x: 0.5, y: 0.25 },
    left_shoulder: { x: 0.48, y: 0.35 },
    right_shoulder: { x: 0.52, y: 0.35 },
    left_elbow: { x: 0.42, y: 0.45 },
    right_elbow: { x: 0.58, y: 0.45 },
    left_wrist: { x: 0.40, y: 0.50 },
    right_wrist: { x: 0.60, y: 0.50 },
    left_hip: { x: 0.48, y: 0.55 },
    right_hip: { x: 0.52, y: 0.55 },
    left_knee: { x: 0.46, y: 0.72 },
    right_knee: { x: 0.54, y: 0.72 },
    left_ankle: { x: 0.45, y: 0.90 },
    right_ankle: { x: 0.55, y: 0.90 },
  },
  
  load: {
    nose: { x: 0.52, y: 0.25 },
    left_shoulder: { x: 0.50, y: 0.35 },
    right_shoulder: { x: 0.54, y: 0.36 },
    left_elbow: { x: 0.44, y: 0.46 },
    right_elbow: { x: 0.62, y: 0.44 },
    left_wrist: { x: 0.42, y: 0.52 },
    right_wrist: { x: 0.66, y: 0.48 },
    left_hip: { x: 0.50, y: 0.56 },
    right_hip: { x: 0.54, y: 0.55 },
    left_knee: { x: 0.48, y: 0.73 },
    right_knee: { x: 0.56, y: 0.72 },
    left_ankle: { x: 0.47, y: 0.90 },
    right_ankle: { x: 0.57, y: 0.90 },
  },
  
  stride: {
    nose: { x: 0.50, y: 0.24 },
    left_shoulder: { x: 0.48, y: 0.34 },
    right_shoulder: { x: 0.52, y: 0.35 },
    left_elbow: { x: 0.40, y: 0.44 },
    right_elbow: { x: 0.60, y: 0.42 },
    left_wrist: { x: 0.36, y: 0.50 },
    right_wrist: { x: 0.64, y: 0.46 },
    left_hip: { x: 0.48, y: 0.54 },
    right_hip: { x: 0.52, y: 0.54 },
    left_knee: { x: 0.42, y: 0.72 },
    right_knee: { x: 0.54, y: 0.71 },
    left_ankle: { x: 0.38, y: 0.90 },
    right_ankle: { x: 0.56, y: 0.90 },
  },
  
  contact: {
    nose: { x: 0.48, y: 0.24 },
    left_shoulder: { x: 0.45, y: 0.34 },
    right_shoulder: { x: 0.51, y: 0.35 },
    left_elbow: { x: 0.36, y: 0.42 },
    right_elbow: { x: 0.58, y: 0.40 },
    left_wrist: { x: 0.30, y: 0.46 },
    right_wrist: { x: 0.62, y: 0.44 },
    left_hip: { x: 0.46, y: 0.54 },
    right_hip: { x: 0.50, y: 0.53 },
    left_knee: { x: 0.40, y: 0.72 },
    right_knee: { x: 0.52, y: 0.70 },
    left_ankle: { x: 0.38, y: 0.90 },
    right_ankle: { x: 0.54, y: 0.90 },
  },
  
  extension: {
    nose: { x: 0.46, y: 0.26 },
    left_shoulder: { x: 0.42, y: 0.36 },
    right_shoulder: { x: 0.48, y: 0.36 },
    left_elbow: { x: 0.32, y: 0.38 },
    right_elbow: { x: 0.54, y: 0.38 },
    left_wrist: { x: 0.26, y: 0.40 },
    right_wrist: { x: 0.58, y: 0.40 },
    left_hip: { x: 0.44, y: 0.55 },
    right_hip: { x: 0.48, y: 0.54 },
    left_knee: { x: 0.38, y: 0.72 },
    right_knee: { x: 0.50, y: 0.70 },
    left_ankle: { x: 0.36, y: 0.90 },
    right_ankle: { x: 0.52, y: 0.90 },
  },
  
  finish: {
    nose: { x: 0.42, y: 0.28 },
    left_shoulder: { x: 0.38, y: 0.38 },
    right_shoulder: { x: 0.44, y: 0.38 },
    left_elbow: { x: 0.28, y: 0.42 },
    right_elbow: { x: 0.48, y: 0.36 },
    left_wrist: { x: 0.24, y: 0.46 },
    right_wrist: { x: 0.52, y: 0.32 },
    left_hip: { x: 0.40, y: 0.56 },
    right_hip: { x: 0.44, y: 0.55 },
    left_knee: { x: 0.36, y: 0.73 },
    right_knee: { x: 0.46, y: 0.71 },
    left_ankle: { x: 0.34, y: 0.90 },
    right_ankle: { x: 0.48, y: 0.90 },
  },
};

// Skeleton connections for drawing
export const POSE_CONNECTIONS = [
  // Head to shoulders
  ['nose', 'left_shoulder'],
  ['nose', 'right_shoulder'],
  
  // Torso
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  
  // Left arm
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  
  // Right arm
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  
  // Left leg
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  
  // Right leg
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
];

export const PHASE_DESCRIPTIONS: Record<SwingPhase, string> = {
  setup: 'Athletic stance with weight balanced',
  load: 'Weight shifts back, hands load',
  stride: 'Front foot strides forward',
  contact: 'Bat meets ball at contact point',
  extension: 'Arms extend through contact zone',
  finish: 'Follow through with full rotation',
};
