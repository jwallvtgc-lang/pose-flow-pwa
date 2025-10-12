// Updated metric specifications based on MLB biomechanics research (2024-2025)
// Reference: Driveline Baseball, Rockland Peak Performance, professional swing analysis
export const metricSpecs = {
  // Hip-shoulder separation: Critical for power generation via kinematic sequence
  // Pros achieve 45-60° separation at contact (was 15-35° - too low)
  hip_shoulder_sep_deg: { target: [40, 60], weight: 25 },
  
  // Attack angle: Upward bat path through contact zone
  // MLB data shows 5-20° is optimal for hard contact and launch angle
  attack_angle_deg: { target: [5, 20], weight: 20 },
  
  // Head drift: Stability from launch to contact is critical for vision/timing
  // Pros maintain <5cm drift (tightened from 0-6cm)
  head_drift_cm: { target: [0, 5], weight: 15, invert: true },
  
  // Contact timing: Consistency in timing from launch to contact
  // Within ±3 frames (~50ms) of ideal 100ms delay
  contact_timing_frames: { target: [-3, 3], weight: 12, abs_window: true },
  
  // Bat lag: Angle between forearm and bat at launch (creates whip effect)
  // 50-70° shows proper sequencing and bat speed potential
  bat_lag_deg: { target: [50, 70], weight: 10 },
  
  // Torso tilt: Forward lean at contact for optimal power transfer
  // Pros show 10-20° forward lean (was 20-35° - too upright)
  torso_tilt_deg: { target: [10, 25], weight: 15 },
  
  // Stride variance: Consistency in stride length swing-to-swing
  // Lower weight as it's less critical than rotational mechanics
  stride_var_pct: { target: [0, 10], weight: 3, invert: true },
  
  // Finish balance: Weight transfer and balance on front leg at finish
  // 0.0-0.3 index shows proper weight transfer (85-90% on front leg)
  finish_balance_idx: { target: [0.0, 0.3], weight: 10, invert: true }
} as const;

export type MetricSpec = {
  target: readonly [number, number];
  weight: number;
  invert?: boolean;
  abs_window?: boolean;
};

export type MetricSpecs = Record<string, MetricSpec>;