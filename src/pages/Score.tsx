import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { SwingScoring } from '@/components/SwingScoring';
import { CoachingFeedback } from '@/components/CoachingFeedback';
import { SwingAnalysisResults } from '@/components/SwingAnalysisResults';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { computePhase1Metrics, metricDisplayNames, metricUnits, type MetricsResult } from '@/lib/metrics';
import { evaluateSwing } from '@/lib/swing-evaluation';
import type { CoachingCard } from '@/lib/cues';
import type { PoseAnalysisResult } from '@/lib/poseWorkerClient';

export default function Score() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [score, setScore] = useState<number>(0);
  const [coachingCards, setCoachingCards] = useState<CoachingCard[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [poseResults, setPoseResults] = useState<PoseAnalysisResult | null>(null);
  const [metricsData, setMetricsData] = useState<MetricsResult | null>(null);
  
  const swingId = searchParams.get('swingId');
  const recordedBlob = location.state?.recordedBlob;
  const poses = location.state?.poses || [];

  useEffect(() => {
    // Create video URL from blob for thumbnail/playback
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      setVideoUrl(url);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [recordedBlob]);

  const handleAnalysisComplete = async (results: PoseAnalysisResult) => {
    setPoseResults(results);
    
    try {
      // Compute Phase 1 metrics from pose analysis
      const metricsResult = computePhase1Metrics(
        results.keypointsByFrame, 
        results.events, 
        30 // Assuming 30fps
      );
      setMetricsData(metricsResult);
      
      // Convert metrics to format expected by scoring system
      const metricsForScoring: Record<string, number> = {};
      Object.entries(metricsResult.metrics).forEach(([key, value]) => {
        if (value !== null) {
          metricsForScoring[key] = value;
        }
      });
      
      // Evaluate swing using computed metrics
      if (Object.keys(metricsForScoring).length > 0) {
        const { score: swingScore, cards } = await evaluateSwing(metricsForScoring);
        setScore(swingScore);
        setCoachingCards(cards);
      }
      
      setIsAnalyzing(false);
    } catch (error) {
      console.error('Failed to compute metrics:', error);
      setIsAnalyzing(false);
    }
  };

  const handleRetake = () => {
    // Navigate back to analysis page
    window.location.href = '/analysis';
  };

  if (!recordedBlob) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-bold mb-4">No Recording Found</h2>
          <p className="text-muted-foreground mb-4">
            Please record a swing first to see your analysis.
          </p>
          <Link to="/analysis">
            <Button>Go Back to Record</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/analysis">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Swing Analysis</h1>
        </div>

        {/* Analysis Component */}
        {isAnalyzing ? (
          <SwingAnalysisResults 
            videoBlob={recordedBlob}
            onRetake={handleRetake}
            onComplete={handleAnalysisComplete}
          />
        ) : (
          <div className="space-y-6">
            {/* Coaching Feedback */}
            {score > 0 && coachingCards.length > 0 && (
              <CoachingFeedback 
                score={score}
                cards={coachingCards}
              />
            )}

            {/* Raw Metrics Display */}
            {metricsData && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Phase 1 Metrics</h3>
                
                {/* Quality Warnings */}
                {metricsData.qualityFlags.lowConfidence && (
                  <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm text-orange-800">
                      ⚠️ Low confidence detection - consider retaking for better analysis
                    </p>
                  </div>
                )}
                
                {metricsData.qualityFlags.missingEvents.length > 0 && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      Missing swing phases: {metricsData.qualityFlags.missingEvents.join(', ')}
                    </p>
                  </div>
                )}
                
                {/* Metrics Grid */}
                <div className="grid grid-cols-1 gap-3 text-sm">
                  {Object.entries(metricsData.metrics).map(([key, value]) => {
                    const displayName = metricDisplayNames()[key] || key.replace(/_/g, ' ');
                    const unit = metricUnits()[key] || '';
                    
                    return (
                      <div key={key} className="flex justify-between p-2 bg-muted/50 rounded">
                        <span className="text-muted-foreground font-medium">
                          {displayName}:
                        </span>
                        <span className="font-mono">
                          {value !== null ? `${value.toFixed(1)} ${unit}` : 'N/A'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {metricsData.pixelsPerCm && (
                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                    Scaling: {metricsData.pixelsPerCm.toFixed(2)} pixels/cm (based on estimated body height)
                  </div>
                )}
              </Card>
            )}

            {/* Pose Results */}
            {poseResults && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Pose Analysis Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Frames Analyzed:</span>
                    <span className="ml-2 font-medium">{poseResults.keypointsByFrame.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Swing Phases:</span>
                    <span className="ml-2 font-medium">{Object.keys(poseResults.events).length} / 6</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quality:</span>
                    <span className="ml-2 font-medium">
                      {poseResults.quality === 'low_confidence' ? 'Low Confidence' : 'Good'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="ml-2 font-medium">
                      {((poseResults.keypointsByFrame[poseResults.keypointsByFrame.length - 1]?.t || 0) / 1000).toFixed(2)}s
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="mt-8">
              <Link to="/analysis">
                <Button className="w-full" size="lg">
                  Record Another Swing
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}