import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { evaluateSwing } from '@/lib/swing-evaluation';
import { trackCapture } from '@/lib/analytics';
import type { CoachingCard } from '@/lib/cues';

interface SwingScoringProps {
  poses: any[];
  onScoreComplete: (score: number, cards: CoachingCard[]) => void;
}

// Mock function to extract metrics from poses
const extractMetricsFromPoses = (poses: any[]): Record<string, number> => {
  // This would contain real pose analysis logic
  // For now, returning mock data based on pose detection
  if (poses.length === 0) return {};
  
  return {
    head_drift_cm: Math.random() * 10,
    attack_angle_deg: 10 + Math.random() * 15,
    hip_shoulder_sep_deg: 20 + Math.random() * 20,
    bat_lag_deg: 55 + Math.random() * 10,
    torso_tilt_deg: 25 + Math.random() * 10,
    stride_var_pct: Math.random() * 8,
    finish_balance_idx: Math.random() * 0.4,
    contact_timing_frames: (Math.random() - 0.5) * 6,
  };
};

export function SwingScoring({ poses, onScoreComplete }: SwingScoringProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [metrics, setMetrics] = useState<Record<string, number>>({});

  useEffect(() => {
    if (poses.length > 0) {
      analyzeSwing();
    }
  }, [poses]);

  const analyzeSwing = async () => {
    setIsAnalyzing(true);
    setProgress(0);

    // Simulate analysis progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + 10;
        if (newProgress >= 100) {
          clearInterval(progressInterval);
        }
        return Math.min(newProgress, 100);
      });
    }, 200);

    try {
      // Extract metrics from poses
      const extractedMetrics = extractMetricsFromPoses(poses);
      setMetrics(extractedMetrics);

      // Wait for progress to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Evaluate swing
      const { score, cards } = await evaluateSwing(extractedMetrics);
      
      trackCapture.scoreReady();
      onScoreComplete(score, cards);
    } catch (error) {
      console.error('Swing analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
      clearInterval(progressInterval);
    }
  };

  if (!isAnalyzing && Object.keys(metrics).length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">Record a swing to see analysis</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Swing Analysis</h3>
      
      {isAnalyzing ? (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Analyzing your swing...
            </p>
            <Progress value={progress} className="w-full" />
            <p className="text-xs text-muted-foreground mt-1">
              {progress}% complete
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            <Badge variant="secondary" className="text-lg px-3 py-1">
              Analysis Complete
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(metrics).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-muted-foreground">
                  {key.replace(/_/g, ' ')}:
                </span>
                <span className="font-medium">
                  {typeof value === 'number' ? value.toFixed(1) : value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}