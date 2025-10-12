import { FrameData } from './poseWorkerClient';

export interface BatSpeedResult {
  peakSpeedMph: number;
  avgSpeedMph: number;
  peakWristSpeedMph: number;
  avgWristSpeedMph: number;
  swingDurationMs: number;
  accelerationPhaseMs: number;
  level: 'Youth' | 'Developing' | 'High School' | 'College' | 'Professional';
  levelDescription: string;
  pixelsPerFoot: number;
  wristVelocities: { frame: number; mph: number; timestamp: number }[];
}

export class BatSpeedEstimator {
  private readonly BAT_TIP_MULTIPLIER = 1.4; // Bat tip moves 1.4x faster than wrist
  private readonly MPH_CONVERSION = 0.681818; // Feet per second to MPH
  
  /**
   * Calculate bat speed from pose keypoints across frames
   */
  calculateBatSpeed(frames: FrameData[], fps: number): BatSpeedResult | null {
    if (frames.length < 2) {
      console.warn('Not enough frames to calculate bat speed');
      return null;
    }

    // Auto-calibrate using body height
    const pixelsPerFoot = this.calibrateScale(frames);
    if (!pixelsPerFoot) {
      console.warn('Could not calibrate scale from body height');
      return null;
    }

    // Extract wrist positions and calculate velocities
    const wristVelocities = this.calculateWristVelocities(frames, fps, pixelsPerFoot);
    
    if (wristVelocities.length === 0) {
      console.warn('No valid wrist velocities calculated');
      return null;
    }

    // Find peak and average speeds
    const peakWristSpeedMph = Math.max(...wristVelocities.map(v => v.mph));
    const avgWristSpeedMph = wristVelocities.reduce((sum, v) => sum + v.mph, 0) / wristVelocities.length;

    // Apply bat tip multiplier
    const peakSpeedMph = peakWristSpeedMph * this.BAT_TIP_MULTIPLIER;
    const avgSpeedMph = avgWristSpeedMph * this.BAT_TIP_MULTIPLIER;

    // Calculate swing duration
    const swingDurationMs = ((frames.length - 1) / fps) * 1000;

    // Find acceleration phase (time to reach 80% of peak speed)
    const accelerationThreshold = peakWristSpeedMph * 0.8;
    let accelerationFrames = 0;
    for (let i = 0; i < wristVelocities.length; i++) {
      if (wristVelocities[i].mph >= accelerationThreshold) {
        accelerationFrames = i;
        break;
      }
    }
    const accelerationPhaseMs = (accelerationFrames / fps) * 1000;

    // Categorize level
    const { level, levelDescription } = this.categorizeLevel(peakSpeedMph);

    return {
      peakSpeedMph,
      avgSpeedMph,
      peakWristSpeedMph,
      avgWristSpeedMph,
      swingDurationMs,
      accelerationPhaseMs,
      level,
      levelDescription,
      pixelsPerFoot,
      wristVelocities
    };
  }

  /**
   * Auto-calibrate scale using body height (nose to ankle)
   * Assumes average body height of 5.5 feet (66 inches)
   */
  private calibrateScale(frames: FrameData[]): number | null {
    const heights: number[] = [];

    for (const frame of frames) {
      const nose = this.getKeypoint(frame.keypoints, 'nose');
      const leftAnkle = this.getKeypoint(frame.keypoints, 'left_ankle');
      const rightAnkle = this.getKeypoint(frame.keypoints, 'right_ankle');

      if (!nose || nose.score < 0.4) continue;
      
      // Use the ankle with higher confidence
      const ankle = (leftAnkle?.score || 0) > (rightAnkle?.score || 0) ? leftAnkle : rightAnkle;
      if (!ankle || ankle.score < 0.4) continue;

      // Calculate pixel distance from nose to ankle
      const pixelHeight = Math.sqrt(
        Math.pow(nose.x - ankle.x, 2) + Math.pow(nose.y - ankle.y, 2)
      );

      // Nose to ankle is approximately 85% of total body height
      const estimatedBodyHeightPixels = pixelHeight / 0.85;
      heights.push(estimatedBodyHeightPixels);
    }

    if (heights.length === 0) return null;

    // Use median to avoid outliers
    heights.sort((a, b) => a - b);
    const medianHeightPixels = heights[Math.floor(heights.length / 2)];

    // Assume average body height of 5.5 feet
    const AVERAGE_BODY_HEIGHT_FEET = 5.5;
    const pixelsPerFoot = medianHeightPixels / AVERAGE_BODY_HEIGHT_FEET;

    console.log(`📏 Calibrated: ${pixelsPerFoot.toFixed(2)} pixels per foot (${medianHeightPixels.toFixed(0)}px body height)`);
    
    return pixelsPerFoot;
  }

  /**
   * Calculate wrist velocities across frames
   */
  private calculateWristVelocities(
    frames: FrameData[], 
    fps: number, 
    pixelsPerFoot: number
  ): { frame: number; mph: number; timestamp: number }[] {
    const velocities: { frame: number; mph: number; timestamp: number }[] = [];
    const timePerFrame = 1 / fps; // seconds

    for (let i = 1; i < frames.length; i++) {
      const prevFrame = frames[i - 1];
      const currFrame = frames[i];

      // Try right wrist first (more common for right-handed batters)
      let prevWrist = this.getKeypoint(prevFrame.keypoints, 'right_wrist');
      let currWrist = this.getKeypoint(currFrame.keypoints, 'right_wrist');

      // Fall back to left wrist if right is not available
      if (!prevWrist || prevWrist.score < 0.3 || !currWrist || currWrist.score < 0.3) {
        prevWrist = this.getKeypoint(prevFrame.keypoints, 'left_wrist');
        currWrist = this.getKeypoint(currFrame.keypoints, 'left_wrist');
      }

      if (!prevWrist || prevWrist.score < 0.3 || !currWrist || currWrist.score < 0.3) {
        continue;
      }

      // Calculate pixel distance
      const pixelDistance = Math.sqrt(
        Math.pow(currWrist.x - prevWrist.x, 2) + 
        Math.pow(currWrist.y - prevWrist.y, 2)
      );

      // Convert to feet per second, then to MPH
      const feetPerSecond = (pixelDistance / pixelsPerFoot) / timePerFrame;
      const mph = feetPerSecond * this.MPH_CONVERSION;

      velocities.push({
        frame: i,
        mph,
        timestamp: currFrame.t
      });
    }

    return velocities;
  }

  /**
   * Categorize swing speed into level
   */
  private categorizeLevel(speedMph: number): { 
    level: BatSpeedResult['level']; 
    levelDescription: string;
  } {
    if (speedMph < 40) {
      return {
        level: 'Youth',
        levelDescription: 'Youth level (8-12 years)'
      };
    } else if (speedMph < 55) {
      return {
        level: 'Developing',
        levelDescription: 'Developing player (13-15 years)'
      };
    } else if (speedMph < 70) {
      return {
        level: 'High School',
        levelDescription: 'High school varsity level'
      };
    } else if (speedMph < 80) {
      return {
        level: 'College',
        levelDescription: 'College/elite amateur level'
      };
    } else {
      return {
        level: 'Professional',
        levelDescription: 'Professional/elite level'
      };
    }
  }

  /**
   * Get a specific keypoint by name
   */
  private getKeypoint(keypoints: any[], name: string) {
    return keypoints.find((kp: any) => kp.name === name);
  }

  /**
   * Get tips to improve bat speed based on current level
   */
  static getImprovementTips(level: BatSpeedResult['level']): string[] {
    const tips: Record<BatSpeedResult['level'], string[]> = {
      'Youth': [
        'Focus on proper swing mechanics before worrying about speed',
        'Build core strength with age-appropriate exercises',
        'Practice dry swings with a lighter bat to develop muscle memory',
        'Work on hip rotation and weight transfer'
      ],
      'Developing': [
        'Incorporate resistance training with bands or weighted bats',
        'Focus on explosive hip rotation drills',
        'Practice bat speed drills 3-4 times per week',
        'Work on lower body strength and flexibility'
      ],
      'High School': [
        'Add plyometric exercises to build explosive power',
        'Use overload/underload training (heavier and lighter bats)',
        'Focus on bat path efficiency and minimizing wasted movement',
        'Strengthen your core and rotational power'
      ],
      'College': [
        'Fine-tune your swing path for maximum efficiency',
        'Incorporate advanced strength training with Olympic lifts',
        'Work on bat speed maintenance throughout the season',
        'Study video to eliminate any unnecessary movements'
      ],
      'Professional': [
        'Continue optimizing swing mechanics for consistency',
        'Maintain peak physical condition year-round',
        'Focus on bat-to-ball skills while preserving speed',
        'Use technology to track and maintain your metrics'
      ]
    };

    return tips[level];
  }
}
