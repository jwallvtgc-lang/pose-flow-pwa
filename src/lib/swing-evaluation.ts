import { scorePhase1FromValues } from "@/lib/phase1-scoring";
import { metricSpecs } from "@/config/phase1_metrics";
import { supabase } from "@/integrations/supabase/client";

interface SwingMetric {
  name: string;
  value: number;
  target: [number, number];
  unit: string;
  percentileRank: number;
}

export async function evaluateSwing(values: Record<string, number>) {
  const { score, weakest } = scorePhase1FromValues(values);

  try {
    // Prepare metrics for AI analysis
    const metrics: SwingMetric[] = Object.entries(values).map(([name, value]) => {
      const spec = metricSpecs[name as keyof typeof metricSpecs];
      if (!spec) return null;
      
      const [min, max] = spec.target;
      let normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));
      
      // Invert if smaller is better
      if ('invert' in spec && spec.invert) {
        normalizedValue = 1 - normalizedValue;
      }
      
      const percentileRank = Math.round(normalizedValue * 100);
      
      return {
        name: name.replace(/_/g, ' '),
        value,
        target: spec.target,
        unit: getUnitForMetric(name),
        percentileRank
      };
    }).filter(Boolean) as SwingMetric[];

    // Call AI coaching service
    const { data: aiCoaching, error } = await supabase.functions.invoke('generate-swing-coaching', {
      body: {
        metrics,
        playerLevel: 'youth', // Could be made dynamic based on user profile
        previousScore: null, // Could track from previous swings
        sessionNumber: null // Could track session count
      }
    });

    if (error) {
      console.error('AI coaching failed, using fallback:', error);
      throw error;
    }

    // Transform AI response into coaching cards format
    const cards = aiCoaching.cues.map((cue: string, index: number) => ({
      metric: aiCoaching.focusAreas[index] || 'general',
      cue,
      why: aiCoaching.explanations[index] || 'Focus on fundamentals',
      instructions: `Practice this focus area: ${cue}`,
      drill: {
        name: `Custom Drill for ${aiCoaching.focusAreas[index] || 'General'}`,
        how_to: aiCoaching.explanations[index] || 'Work on this area during practice',
        equipment: 'Basic equipment'
      }
    }));

    return { 
      score, 
      weakest, 
      cards,
      aiCoaching: {
        encouragement: aiCoaching.encouragement,
        cues: aiCoaching.cues
      }
    };
  } catch (error) {
    console.error('AI coaching failed, falling back to static cues:', error);
    
    // Fallback to simpler static coaching with better drill details
    const fallbackCards = weakest.slice(0, 2).map(metric => ({
      metric,
      cue: getBasicCueForMetric(metric),
      why: getWhyForMetric(metric),
      instructions: getInstructionsForMetric(metric),
      drill: {
        name: getDrillNameForMetric(metric),
        how_to: getDrillInstructionsForMetric(metric),
        equipment: getEquipmentForMetric(metric)
      }
    }));

    return { 
      score, 
      weakest, 
      cards: fallbackCards,
      aiCoaching: {
        encouragement: "Keep practicing to improve your swing!",
        cues: fallbackCards.map(c => c.cue)
      }
    };
  }
}

function getUnitForMetric(metricName: string): string {
  const units: Record<string, string> = {
    'hip_shoulder_sep_deg': '°',
    'attack_angle_deg': '°', 
    'head_drift_cm': 'cm',
    'contact_timing_frames': ' frames',
    'bat_lag_deg': '°',
    'torso_tilt_deg': '°',
    'stride_var_pct': '%',
    'finish_balance_idx': ''
  };
  return units[metricName] || '';
}

function getBasicCueForMetric(metricName: string): string {
  const basicCues: Record<string, string> = {
    'hip_shoulder_sep_deg': 'Fire hips first, hands last',
    'attack_angle_deg': 'Stay through the zone longer',
    'head_drift_cm': 'Keep your head still',
    'contact_timing_frames': 'Let the ball travel',
    'bat_lag_deg': 'Knob leads to the ball',
    'torso_tilt_deg': 'Maintain athletic posture',
    'stride_var_pct': 'Repeat the same stride',
    'finish_balance_idx': 'Stick your finish'
  };
  return basicCues[metricName] || 'Focus on fundamentals';
}

function getWhyForMetric(metricName: string): string {
  const explanations: Record<string, string> = {
    'hip_shoulder_sep_deg': 'Hip-shoulder separation creates power in your swing by allowing energy transfer from your lower body',
    'attack_angle_deg': 'Proper attack angle helps you hit line drives and avoid weak ground balls',
    'head_drift_cm': 'Keeping your head stable helps maintain balance and consistent contact point',
    'contact_timing_frames': 'Good timing allows you to hit the ball in the optimal contact zone',
    'bat_lag_deg': 'Bat lag creates whip action and generates more bat speed at contact',
    'torso_tilt_deg': 'Athletic posture provides stability and power throughout the swing',
    'stride_var_pct': 'Consistent stride helps you time pitches and maintain balance',
    'finish_balance_idx': 'A balanced finish shows good weight transfer and control'
  };
  return explanations[metricName] || 'This metric is important for swing mechanics';
}

function getInstructionsForMetric(metricName: string): string {
  const instructions: Record<string, string> = {
    'hip_shoulder_sep_deg': 'Practice rotating your hips before your shoulders during dry swings',
    'attack_angle_deg': 'Work on hitting the bottom half of the ball with slightly upward swing path',
    'head_drift_cm': 'Focus on keeping your head steady by watching the ball all the way to contact',
    'contact_timing_frames': 'Practice with slower pitches first, focusing on letting the ball travel deeper',
    'bat_lag_deg': 'Feel the knob of the bat leading toward the ball before the barrel comes through',
    'torso_tilt_deg': 'Maintain slight forward lean and avoid standing too upright',
    'stride_var_pct': 'Practice with consistent, controlled stride length in your stance',
    'finish_balance_idx': 'Hold your follow-through position for 2 seconds after each swing'
  };
  return instructions[metricName] || `Focus on improving your ${metricName.replace(/_/g, ' ')}`;
}

function getDrillNameForMetric(metricName: string): string {
  const drillNames: Record<string, string> = {
    'hip_shoulder_sep_deg': 'Hip Rotation Drill',
    'attack_angle_deg': 'Tee Height Drill', 
    'head_drift_cm': 'Head Still Drill',
    'contact_timing_frames': 'Deep Contact Drill',
    'bat_lag_deg': 'Knob-to-Ball Drill',
    'torso_tilt_deg': 'Athletic Stance Drill',
    'stride_var_pct': 'Stride Consistency Drill',
    'finish_balance_idx': 'Balance Finish Drill'
  };
  return drillNames[metricName] || `${metricName.replace(/_/g, ' ')} Improvement Drill`;
}

function getDrillInstructionsForMetric(metricName: string): string {
  const drillInstructions: Record<string, string> = {
    'hip_shoulder_sep_deg': 'Stand in your stance and practice rotating your hips while keeping shoulders square. Feel the separation, then let shoulders follow. Do 10 slow reps focusing on hip-first movement.',
    'attack_angle_deg': 'Set tee at different heights (low, middle, high). Practice hitting balls with slight upward angle. Focus on hitting the bottom half of the ball consistently.',
    'head_drift_cm': 'Place a ball on your cap bill or have someone hold their hand near your head. Take practice swings without moving your head. Keep eyes focused on contact point.',
    'contact_timing_frames': 'Use front toss or slow BP. Focus on letting the ball travel deeper into the hitting zone before making contact. Start with slower speeds and gradually increase.',
    'bat_lag_deg': 'Hold bat with just your bottom hand. Practice bringing knob toward ball first, then snap wrists. Feel the lag, then add top hand and repeat full motion.',
    'torso_tilt_deg': 'Practice stance in front of mirror. Maintain slight forward lean (like sitting on a bar stool). Avoid standing too tall or leaning too far forward.',
    'stride_var_pct': 'Use a stride line or place objects to mark consistent stride length. Practice striding to the same spot every time. Focus on controlled, repeatable movement.',
    'finish_balance_idx': 'After each swing, hold your finish position for 3 full seconds. Your weight should be on your front foot with good posture. Practice until it feels natural.'
  };
  return drillInstructions[metricName] || `Practice specific exercises to improve ${metricName.replace(/_/g, ' ')}.`;
}

function getEquipmentForMetric(metricName: string): string {
  const equipment: Record<string, string> = {
    'hip_shoulder_sep_deg': 'None required - can use mirror for feedback',
    'attack_angle_deg': 'Batting tee, baseballs', 
    'head_drift_cm': 'Baseball cap, mirror or partner for feedback',
    'contact_timing_frames': 'Baseballs, front toss net or partner',
    'bat_lag_deg': 'Bat only (practice without ball first)',
    'torso_tilt_deg': 'Mirror for visual feedback',
    'stride_var_pct': 'Tape or chalk to mark stride line',
    'finish_balance_idx': 'None required - body weight exercise'
  };
  return equipment[metricName] || 'Basic baseball equipment';
}