// Ideal swing skeleton data for each phase
// Normalized keypoint positions (0-1 range) for display on canvas
// Based on MLB biomechanics research and professional swing analysis
// Reference: Driveline Baseball, Rockland Peak Performance, MLB swing studies (2024-2025)

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

// Ideal swing keypoints for each phase (right-handed batter, first base side view)
// Based on professional MLB biomechanics: kinematic sequencing, hip-shoulder separation,
// torso angles, weight transfer, and attack angle principles
// View: Looking from first base side (right side of field)
export const IDEAL_SWING_KEYPOINTS: Record<SwingPhase, IdealKeypoints> = {
  // SETUP: Athletic stance, balanced weight (50/50), vertical torso
  setup: {
    nose: { x: 0.50, y: 0.22 },
    left_shoulder: { x: 0.53, y: 0.33 },
    right_shoulder: { x: 0.47, y: 0.33 },
    left_elbow: { x: 0.58, y: 0.43 },
    right_elbow: { x: 0.42, y: 0.43 },
    left_wrist: { x: 0.60, y: 0.48 },
    right_wrist: { x: 0.40, y: 0.48 },
    left_hip: { x: 0.52, y: 0.54 },
    right_hip: { x: 0.48, y: 0.54 },
    left_knee: { x: 0.54, y: 0.72 },
    right_knee: { x: 0.46, y: 0.72 },
    left_ankle: { x: 0.55, y: 0.90 },
    right_ankle: { x: 0.45, y: 0.90 },
  },
  
  // LOAD: Weight shift to back leg (60-70%), hands back, hip coil, slight shoulder rotation
  // Back knee flexed, head stays centered, creating pre-torque
  load: {
    nose: { x: 0.49, y: 0.23 },
    left_shoulder: { x: 0.52, y: 0.34 },
    right_shoulder: { x: 0.44, y: 0.35 },  // Shoulders start rotating back
    left_elbow: { x: 0.57, y: 0.45 },
    right_elbow: { x: 0.36, y: 0.42 },  // Back elbow up and back
    left_wrist: { x: 0.59, y: 0.51 },
    right_wrist: { x: 0.32, y: 0.46 },  // Hands loaded back
    left_hip: { x: 0.51, y: 0.55 },
    right_hip: { x: 0.44, y: 0.54 },  // Back hip loaded, slightly rotated
    left_knee: { x: 0.53, y: 0.73 },
    right_knee: { x: 0.43, y: 0.71 },  // Back knee flexed over ankle
    left_ankle: { x: 0.54, y: 0.90 },
    right_ankle: { x: 0.42, y: 0.90 },
  },
  
  // STRIDE: Front foot strides forward, weight still back (55-65%), hips begin opening
  // Peak hip-shoulder separation starting to build, hands stay back (independent)
  stride: {
    nose: { x: 0.50, y: 0.23 },
    left_shoulder: { x: 0.54, y: 0.34 },
    right_shoulder: { x: 0.46, y: 0.35 },
    left_elbow: { x: 0.62, y: 0.44 },
    right_elbow: { x: 0.38, y: 0.41 },
    left_wrist: { x: 0.66, y: 0.50 },  // Hands still back despite body moving forward
    right_wrist: { x: 0.34, y: 0.45 },
    left_hip: { x: 0.53, y: 0.54 },  // Hips start opening
    right_hip: { x: 0.47, y: 0.53 },
    left_knee: { x: 0.62, y: 0.71 },  // Front knee flexed, ready to block
    right_knee: { x: 0.45, y: 0.70 },  // Back knee driving forward
    left_ankle: { x: 0.66, y: 0.90 },  // Front foot planted
    right_ankle: { x: 0.43, y: 0.90 },
  },
  
  // CONTACT: Maximum hip-shoulder separation (45-60°), front leg firm block
  // Torso slight forward tilt (10-15°), hands ahead of barrel, attack angle 5-20°
  // Weight transfer to front (70-80%), back heel starting to lift
  contact: {
    nose: { x: 0.53, y: 0.24 },
    left_shoulder: { x: 0.58, y: 0.35 },  // Shoulders square to pitch
    right_shoulder: { x: 0.50, y: 0.36 },
    left_elbow: { x: 0.68, y: 0.41 },  // Front arm extended
    right_elbow: { x: 0.44, y: 0.38 },  // Back elbow "slotted"
    left_wrist: { x: 0.74, y: 0.44 },  // Hands through zone, slight upward path
    right_wrist: { x: 0.40, y: 0.42 },
    left_hip: { x: 0.56, y: 0.54 },  // Hips fully open/rotated
    right_hip: { x: 0.50, y: 0.53 },
    left_knee: { x: 0.64, y: 0.71 },  // Front leg firm (blocking)
    right_knee: { x: 0.48, y: 0.68 },  // Back knee driving through
    left_ankle: { x: 0.66, y: 0.90 },
    right_ankle: { x: 0.44, y: 0.88 },  // Back heel lifting
  },
  
  // EXTENSION: Arms extend through contact zone, full hip rotation
  // Torso rotating forward, maintaining posture, back foot pivoting on toe
  extension: {
    nose: { x: 0.56, y: 0.26 },
    left_shoulder: { x: 0.62, y: 0.37 },
    right_shoulder: { x: 0.54, y: 0.37 },
    left_elbow: { x: 0.72, y: 0.39 },  // Full extension
    right_elbow: { x: 0.48, y: 0.37 },
    left_wrist: { x: 0.78, y: 0.40 },  // Arms extended through ball
    right_wrist: { x: 0.44, y: 0.38 },
    left_hip: { x: 0.58, y: 0.56 },  // Full rotation
    right_hip: { x: 0.53, y: 0.55 },
    left_knee: { x: 0.66, y: 0.72 },
    right_knee: { x: 0.52, y: 0.67 },  // Back leg continues through
    left_ankle: { x: 0.68, y: 0.90 },
    right_ankle: { x: 0.48, y: 0.85 },  // On toe
  },
  
  // FINISH: Complete rotation, weight fully on front leg (85-90%)
  // High finish, back foot rotated on toe, balanced follow-through
  finish: {
    nose: { x: 0.60, y: 0.28 },
    left_shoulder: { x: 0.66, y: 0.39 },  // Full body rotation
    right_shoulder: { x: 0.58, y: 0.39 },
    left_elbow: { x: 0.76, y: 0.43 },
    right_elbow: { x: 0.54, y: 0.34 },  // High finish
    left_wrist: { x: 0.80, y: 0.47 },
    right_wrist: { x: 0.50, y: 0.30 },  // Hands high
    left_hip: { x: 0.62, y: 0.57 },
    right_hip: { x: 0.57, y: 0.56 },
    left_knee: { x: 0.68, y: 0.73 },  // Front leg stable
    right_knee: { x: 0.56, y: 0.68 },  // Back knee through
    left_ankle: { x: 0.70, y: 0.90 },
    right_ankle: { x: 0.52, y: 0.82 },  // Back foot fully rotated
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
  setup: 'Athletic stance, balanced 50/50 weight, hands at shoulder height',
  load: 'Weight shifts back (60-70%), hands load, hip coil creates pre-torque',
  stride: 'Front foot strides forward, hips begin opening, hands stay back',
  contact: 'Hips fully open, front leg blocks, 45-60° hip-shoulder separation',
  extension: 'Arms extend through ball, full hip rotation, back heel up',
  finish: 'High finish, weight on front leg (85-90%), balanced follow-through',
};
