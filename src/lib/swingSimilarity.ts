// Calculate similarity between detected pose and ideal swing form

import { IdealKeypoints } from './idealSwingData';

export interface Keypoint {
  x: number;
  y: number;
  score?: number;
}

export interface DetectedPose {
  [key: string]: Keypoint;
}

/**
 * Calculate similarity percentage between detected pose and ideal form
 * Returns a percentage (0-100) where 100 is perfect match
 */
export function calculatePoseSimilarity(
  detectedPose: DetectedPose,
  idealPose: IdealKeypoints,
  minConfidence: number = 0.3
): number {
  const keypoints = Object.keys(idealPose);
  let totalScore = 0;
  let validKeypoints = 0;

  for (const keypointName of keypoints) {
    const detected = detectedPose[keypointName];
    const ideal = idealPose[keypointName];

    // Skip if keypoint not detected or low confidence
    if (!detected || (detected.score !== undefined && detected.score < minConfidence)) {
      continue;
    }

    // Calculate Euclidean distance (normalized to 0-1 range)
    const dx = detected.x - ideal.x;
    const dy = detected.y - ideal.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Convert distance to similarity score (closer = higher score)
    // Max reasonable distance is ~1.4 (diagonal of unit square)
    const maxDistance = 0.3; // Consider anything beyond 30% of canvas as poor match
    const similarity = Math.max(0, 1 - (distance / maxDistance));

    totalScore += similarity;
    validKeypoints++;
  }

  if (validKeypoints === 0) {
    return 0;
  }

  // Return percentage
  return Math.round((totalScore / validKeypoints) * 100);
}

/**
 * Get detailed similarity breakdown by body part
 */
export function getDetailedSimilarity(
  detectedPose: DetectedPose,
  idealPose: IdealKeypoints,
  minConfidence: number = 0.3
): Record<string, number> {
  const bodyParts = {
    head: ['nose'],
    torso: ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'],
    leftArm: ['left_shoulder', 'left_elbow', 'left_wrist'],
    rightArm: ['right_shoulder', 'right_elbow', 'right_wrist'],
    leftLeg: ['left_hip', 'left_knee', 'left_ankle'],
    rightLeg: ['right_hip', 'right_knee', 'right_ankle'],
  };

  const scores: Record<string, number> = {};

  for (const [partName, keypoints] of Object.entries(bodyParts)) {
    let partScore = 0;
    let validPoints = 0;

    for (const keypointName of keypoints) {
      const detected = detectedPose[keypointName];
      const ideal = idealPose[keypointName];

      if (!detected || !ideal || (detected.score !== undefined && detected.score < minConfidence)) {
        continue;
      }

      const dx = detected.x - ideal.x;
      const dy = detected.y - ideal.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = 0.3;
      const similarity = Math.max(0, 1 - (distance / maxDistance));

      partScore += similarity;
      validPoints++;
    }

    scores[partName] = validPoints > 0 ? Math.round((partScore / validPoints) * 100) : 0;
  }

  return scores;
}
