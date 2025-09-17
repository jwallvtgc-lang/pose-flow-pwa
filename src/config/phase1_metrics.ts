export const metricSpecs = {
  hip_shoulder_sep_deg: { target: [15, 35], weight: 20 },
  attack_angle_deg: { target: [5, 20], weight: 20 },
  head_drift_cm: { target: [0, 6], weight: 15, invert: true },
  contact_timing_frames: { target: [-3, 3], weight: 10, abs_window: true },
  bat_lag_deg: { target: [50, 70], weight: 10 },
  torso_tilt_deg: { target: [20, 35], weight: 10 },
  stride_var_pct: { target: [0, 10], weight: 5, invert: true },
  finish_balance_idx: { target: [0.0, 0.3], weight: 10, invert: true }
} as const;

export type MetricSpec = {
  target: readonly [number, number];
  weight: number;
  invert?: boolean;
  abs_window?: boolean;
};

export type MetricSpecs = Record<string, MetricSpec>;