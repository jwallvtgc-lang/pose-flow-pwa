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
    
    // Fallback to simpler static coaching
    const fallbackCards = weakest.slice(0, 2).map(metric => ({
      metric,
      cue: getBasicCueForMetric(metric),
      why: 'Focus area that needs improvement',
      instructions: `Work on improving ${metric.replace(/_/g, ' ')}`,
      drill: {
        name: `${metric.replace(/_/g, ' ')} Drill`,
        how_to: `Practice exercises targeting ${metric.replace(/_/g, ' ')}`,
        equipment: 'Basic equipment'
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