import { useEffect, useState } from 'react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';

// Analytics
import { trackCapture } from '@/lib/analytics';

// Pose and metrics
import { poseWorkerClient, type PoseAnalysisResult } from '@/lib/poseWorkerClient';
import { computePhase1Metrics, metricDisplayNames, metricUnits, type MetricsResult } from '@/lib/metrics';

// Scoring and coaching
import { scorePhase1FromValues } from '@/lib/phase1-scoring';
import { buildCoachingCards } from '@/lib/cues';
import { fetchDrillByNames } from '@/lib/drills';
import type { CoachingCard } from '@/lib/cues';

// Supabase
import { supabase } from '@/integrations/supabase/client';

// Config
import metricSpecsJson from '../../config/phase1_metrics.json';
import { metricSpecs } from '@/config/phase1_metrics';

interface ScoreState {
  videoBlob?: Blob;
  fps?: number;
  poses?: any[];
}

export default function Score() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // State from navigation
  const state = location.state as ScoreState;
  const videoBlob = state?.videoBlob;
  const fps = state?.fps || 30;
  
  // Component state
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('Starting analysis...');
  const [error, setError] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  
  // Results state
  const [poseResults, setPoseResults] = useState<PoseAnalysisResult | null>(null);
  const [metricsData, setMetricsData] = useState<MetricsResult | null>(null);
  const [score, setScore] = useState<number>(0);
  const [weakestMetrics, setWeakestMetrics] = useState<string[]>([]);
  const [coachingCards, setCoachingCards] = useState<CoachingCard[]>([]);
  const [shouldRetake, setShouldRetake] = useState(false);
  
  // Database IDs
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [swingId, setSwingId] = useState<string | null>(null);

  useEffect(() => {
    if (!videoBlob) {
      navigate('/analysis');
      return;
    }

    // Create video URL for playback
    const url = URL.createObjectURL(videoBlob);
    setVideoUrl(url);

    // Start analysis
    analyzeSwing();

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [videoBlob]);

  const analyzeSwing = async () => {
    try {
      setIsAnalyzing(true);
      setProgress(0);
      setError('');
      setShouldRetake(false);

      // Step 1: Pose analysis
      setProgressMessage('Analyzing pose data...');
      const poseAnalysisResult = await poseWorkerClient.analyzeSwing(
        videoBlob!,
        fps,
        (message) => {
          setProgressMessage(message);
          const progressMatch = message.match(/(\d+\.?\d*)%/);
          if (progressMatch) {
            setProgress(Math.min(50, parseFloat(progressMatch[1]) * 0.5)); // First 50% for pose analysis
          }
        }
      );

      setPoseResults(poseAnalysisResult);
      setProgress(50);

      // Check for low confidence or missing events
      const missingEvents = ['launch', 'contact', 'finish'].filter(
        event => !poseAnalysisResult.events[event as keyof typeof poseAnalysisResult.events]
      );

      if (poseAnalysisResult.quality === 'low_confidence' || missingEvents.length > 1) {
        setShouldRetake(true);
        setIsAnalyzing(false);
        return;
      }

      trackCapture.poseOk();

      // Step 2: Compute metrics
      setProgressMessage('Computing swing metrics...');
      setProgress(60);
      
      const metricsResult = computePhase1Metrics(
        poseAnalysisResult.keypointsByFrame,
        poseAnalysisResult.events,
        fps
      );
      setMetricsData(metricsResult);

      // Step 3: Score the swing
      setProgressMessage('Scoring your swing...');
      setProgress(70);

      const metricsForScoring: Record<string, number> = {};
      Object.entries(metricsResult.metrics).forEach(([key, value]) => {
        if (value !== null) {
          metricsForScoring[key] = value;
        }
      });

      const { score: swingScore, weakest } = scorePhase1FromValues(metricsForScoring, metricSpecs);
      setScore(swingScore);
      setWeakestMetrics(weakest);

      trackCapture.scoreReady();

      // Step 4: Build coaching cards
      setProgressMessage('Generating coaching recommendations...');
      setProgress(80);

      const cards = await buildCoachingCards(weakest, fetchDrillByNames);
      setCoachingCards(cards);

      trackCapture.drillShown();

      // Step 5: Persist to database
      setProgressMessage('Saving your swing data...');
      setProgress(90);

      await persistSwingData(swingScore, cards, metricsResult);

      setProgress(100);
      setProgressMessage('Analysis complete!');
      setIsAnalyzing(false);

    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setIsAnalyzing(false);
    }
  };

  const persistSwingData = async (swingScore: number, cards: CoachingCard[], metricsResult: MetricsResult) => {
    try {
      // Create or get session
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .insert({
            camera_fps: fps,
            notes: `Swing analysis session ${new Date().toISOString()}`
          })
          .select()
          .single();

        if (sessionError) throw sessionError;
        currentSessionId = sessionData.id;
        setSessionId(currentSessionId);
      }

      // Create swing record
      const { data: swingData, error: swingError } = await supabase
        .from('swings')
        .insert({
          session_id: currentSessionId,
          score_phase1: swingScore,
          cues: cards.map(c => c.cue),
          drill_id: (cards[0]?.drill && 'id' in cards[0].drill) ? cards[0].drill.id : null,
          // video_url: null, // Would upload to storage in production
        })
        .select()
        .single();

      if (swingError) throw swingError;
      setSwingId(swingData.id);

      // Insert metrics
      const units = metricUnits();
      const metricsToInsert = Object.entries(metricsResult.metrics)
        .filter(([_, value]) => value !== null)
        .map(([metric, value]) => ({
          swing_id: swingData.id,
          metric,
          value: value!,
          unit: units[metric] || '',
          phase: 1
        }));

      if (metricsToInsert.length > 0) {
        const { error: metricsError } = await supabase
          .from('swing_metrics')
          .insert(metricsToInsert);

        if (metricsError) throw metricsError;
      }

    } catch (error) {
      console.error('Failed to persist swing data:', error);
      // Don't fail the entire analysis for persistence errors
    }
  };

  const handleRetake = () => {
    navigate('/analysis');
  };

  if (!videoBlob) {
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

  // Show retake screen for low confidence/missing events
  if (shouldRetake) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={handleRetake}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold">Analysis Results</h1>
          </div>

          <Card className="p-6 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-orange-500" />
            <h2 className="text-xl font-bold mb-4">Better Recording Needed</h2>
            <p className="text-muted-foreground mb-6">
              We couldn't get a clear view of your swing. For the best analysis, please:
            </p>
            
            <div className="text-left mb-6 space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span className="text-sm">Stand sideways to the camera (profile view)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span className="text-sm">Ensure good lighting on your body</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span className="text-sm">Frame your full body from head to feet</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span className="text-sm">Avoid busy backgrounds that might interfere</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span className="text-sm">Take a complete swing through finish</span>
              </div>
            </div>

            <div className="space-y-3">
              <Button onClick={handleRetake} className="w-full">
                <RotateCcw className="w-4 h-4 mr-2" />
                Record Another Swing
              </Button>
            </div>
          </Card>

          {/* Show video preview */}
          <Card className="p-4 mt-6">
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg"
              muted
            />
          </Card>
        </div>
      </div>
    );
  }

  // Show analysis progress
  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" disabled>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold">Analyzing Your Swing</h1>
          </div>

          <Card className="p-6">
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground">{progressMessage}</p>
                <p className="text-xs text-muted-foreground">{progress.toFixed(0)}% complete</p>
              </div>
            </div>
          </Card>

          {/* Video preview while analyzing */}
          <Card className="p-4 mt-6">
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg"
              muted
            />
          </Card>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={handleRetake}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold">Analysis Error</h1>
          </div>

          <Card className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-semibold mb-2">Analysis Failed</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={analyzeSwing} variant="outline">
                <RotateCcw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={handleRetake}>
                Record New Swing
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Show results
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={handleRetake}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold">Swing Results</h1>
        </div>

        <div className="space-y-6">
          {/* Score Display */}
          <Card className="p-6 text-center">
            <h2 className="text-xl font-bold mb-4">Your Swing Score</h2>
            <div className="relative inline-block">
              <div className={`w-32 h-32 rounded-full flex items-center justify-center text-white text-3xl font-bold ${
                score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
              }`}>
                {score}
              </div>
              <Badge 
                variant="secondary" 
                className="absolute -bottom-2 left-1/2 transform -translate-x-1/2"
              >
                {score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Work'}
              </Badge>
            </div>
          </Card>

          {/* Cue Chips */}
          {coachingCards.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Focus Areas</h3>
              <div className="flex flex-wrap gap-2">
                {coachingCards.slice(0, 2).map((card, index) => (
                  <Badge key={index} variant="outline" className="text-sm py-2 px-3">
                    {card.cue}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {/* Primary Drill Card */}
          {coachingCards.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Recommended Drill</h3>
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-medium text-lg mb-2">{coachingCards[0].drill.name}</h4>
                <p className="text-sm text-muted-foreground mb-3">{coachingCards[0].why}</p>
                {coachingCards[0].drill.how_to && (
                  <div className="text-sm">
                    <strong>How to:</strong> {coachingCards[0].drill.how_to}
                  </div>
                )}
                {coachingCards[0].drill.equipment && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Equipment: {coachingCards[0].drill.equipment}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Metrics Summary */}
          {metricsData && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Swing Metrics</h3>
              <div className="grid grid-cols-1 gap-2 text-sm">
                {Object.entries(metricsData.metrics).map(([key, value]) => {
                  const displayName = metricDisplayNames()[key] || key.replace(/_/g, ' ');
                  const unit = metricUnits()[key] || '';
                  const isWeakest = weakestMetrics.includes(key);
                  
                  return (
                    <div key={key} className={`flex justify-between p-2 rounded ${
                      isWeakest ? 'bg-orange-50 border border-orange-200' : 'bg-muted/50'
                    }`}>
                      <span className="font-medium">
                        {displayName}:
                        {isWeakest && <span className="text-orange-600 ml-1">⚠</span>}
                      </span>
                      <span className="font-mono">
                        {value !== null ? `${value.toFixed(1)} ${unit}` : 'N/A'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Video Playback */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-3">Your Swing</h3>
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg"
              muted
            />
          </Card>

          {/* Actions */}
          <div className="space-y-3">
            <Button onClick={handleRetake} className="w-full" size="lg">
              Record Another Swing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}