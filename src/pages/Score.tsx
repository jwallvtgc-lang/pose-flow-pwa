import { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, AlertTriangle, Loader2, RotateCcw, Save, TrendingUp, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SwingOverlayCanvas } from '@/components/SwingOverlayCanvas';

// Analytics
import { trackCapture } from '@/lib/analytics';

// Pose and metrics
import { poseWorkerClient } from '@/lib/poseWorkerClient';
import { computePhase1Metrics } from '@/lib/metrics';

// Scoring and coaching
import { scorePhase1FromValues } from '@/lib/phase1-scoring';
import { buildCoachingCards } from '@/lib/cues';
import { fetchDrillByNames } from '@/lib/drills';
import type { CoachingCard } from '@/lib/cues';

// Persistence and storage
import { ensureSession, saveSwing } from '@/lib/persistence';
import { uploadVideo } from '@/lib/storage';

// Config
import { metricSpecs } from '@/config/phase1_metrics';

interface ScoreState {
  videoBlob?: Blob;
  fps?: number;
  session_id?: string;
}

interface HistoricalSwing {
  id: string;
  created_at: string | null;
  score_phase1: number | null;
  cues: string[] | null;
}

interface SwingMetric {
  swing_id: string | null;
  metric: string | null;
  value: number | null;
  unit: string | null;
}

interface ChartPoint {
  t: number;
  value: number;
}

export default function Score() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State from navigation
  const state = location.state as ScoreState;
  const fps = state?.fps || 30;
  const sessionIdFromState = state?.session_id;
  
  // Generate client request ID on mount for idempotency
  const [clientRequestId] = useState(() => crypto.randomUUID());
  
  // Component state
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('Starting analysis...');
  const [error, setError] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  
  // Results state
  const [score, setScore] = useState<number>(0);
  const [coachingCards, setCoachingCards] = useState<CoachingCard[]>([]);
  const [shouldRetake, setShouldRetake] = useState(false);
  const [poseData, setPoseData] = useState<any>(null);
  
  // Video refs for overlay
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Database IDs
  const [sessionId, setSessionId] = useState<string | null>(sessionIdFromState || null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Progress data
  const [historicalSwings, setHistoricalSwings] = useState<HistoricalSwing[]>([]);
  const [historicalMetrics, setHistoricalMetrics] = useState<SwingMetric[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);

  useEffect(() => {
    const videoBlob = state?.videoBlob;
    if (!videoBlob) {
      navigate('/analysis');
      return;
    }

    // Create video URL for playback
    const url = URL.createObjectURL(videoBlob);
    setVideoUrl(url);

    // Start analysis
    analyzeSwing();
    
    // Load historical data for progress section
    loadHistoricalData();

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [navigate]); // Fixed dependency - only depend on navigate function

  // Separate effect for video blob changes to prevent unnecessary re-runs
  useEffect(() => {
    if (state?.videoBlob && videoUrl) {
      // Analysis already started, don't restart
      return;
    }
  }, [state?.videoBlob, videoUrl]);

  const loadHistoricalData = async () => {
    try {
      setProgressLoading(true);

      // Fetch recent swings
      const { data: swingsData, error: swingsError } = await supabase
        .from('swings')
        .select('id, created_at, score_phase1, cues')
        .order('created_at', { ascending: false })
        .limit(10);

      if (swingsError) {
        console.error('Error loading historical swings:', swingsError);
        return; // Fail silently for progress data
      }
      
      const processedSwings = (swingsData || []).map(swing => ({
        ...swing,
        created_at: swing.created_at || '',
        cues: Array.isArray(swing.cues) ? swing.cues.filter((cue): cue is string => typeof cue === 'string') : 
              swing.cues ? [String(swing.cues)] : null
      })) as HistoricalSwing[];
      setHistoricalSwings(processedSwings);

      if (swingsData && swingsData.length > 0) {
        // Fetch metrics for those swings
        const swingIds = swingsData.map(s => s.id);
        const { data: metricsData, error: metricsError } = await supabase
          .from('swing_metrics')
          .select('swing_id, metric, value, unit')
          .in('swing_id', swingIds)
          .eq('phase', 1);

        if (metricsError) {
          console.error('Error loading historical metrics:', metricsError);
          return; // Fail silently for progress data
        }
        
        const processedMetrics = (metricsData || []).map(metric => ({
          swing_id: metric.swing_id || '',
          metric: metric.metric || '',
          value: metric.value || 0,
          unit: metric.unit || ''
        })) as SwingMetric[];
        setHistoricalMetrics(processedMetrics);
      }
    } catch (err) {
      console.error('Failed to load historical data:', err);
    } finally {
      setProgressLoading(false);
    }
  };

  const analyzeSwing = async () => {
    try {
      setIsAnalyzing(true);
      setProgress(0);
      setError('');
      setShouldRetake(false);

      // Step 1: Pose analysis
      setProgressMessage('Analyzing pose data...');
      const poseAnalysisResult = await poseWorkerClient.analyzeSwing(
        state?.videoBlob!,
        fps,
        (message) => {
          setProgressMessage(message);
          const progressMatch = message.match(/(\d+\.?\d*)%/);
          if (progressMatch) {
            setProgress(Math.min(50, parseFloat(progressMatch[1]) * 0.5));
          }
        }
      );

      
      setProgress(50);
      
      // Store pose data for overlay visualization
      setPoseData(poseAnalysisResult);

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

      trackCapture.scoreReady();

      // Step 4: Build coaching cards
      setProgressMessage('Generating coaching recommendations...');
      setProgress(80);

      const cards = await buildCoachingCards(weakest, fetchDrillByNames);
      setCoachingCards(cards);

      trackCapture.drillShown();

      setProgress(100);
      setProgressMessage('Analysis complete!');
      setIsAnalyzing(false);

    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setIsAnalyzing(false);
    }
  };

  const handleRetake = () => {
    navigate('/analysis');
  };

  const handleSaveSwing = async () => {
    if (isSaved || isSaving || !score || !coachingCards.length) return;

    try {
      setIsSaving(true);
      
      // Ensure session exists
      const currentSessionId = await ensureSession({ 
        session_id: sessionId, 
        athlete_id: undefined,
        fps,
        view: 'side'
      });
      
      if (!sessionId) setSessionId(currentSessionId);

      // Upload video if available
      let videoUrl: string | null = null;
      const videoBlob = state?.videoBlob;
      if (videoBlob) {
        try {
          const { urlOrPath } = await uploadVideo({
            blob: videoBlob,
            client_request_id: clientRequestId
          });
          videoUrl = urlOrPath;
          trackCapture.videoUploaded(videoBlob.size);
        } catch (uploadError) {
          console.warn('Video upload failed, continuing without video:', uploadError);
        }
      }

      // Save swing data
      await saveSwing({
        session_id: currentSessionId,
        score,
        cards: coachingCards,
        videoUrl,
        client_request_id: clientRequestId
      });

      // Note: Metrics saving would use the actual swing ID returned from saveSwing

      trackCapture.swingSaved(score);
      setIsSaved(true);
      
      // Refresh historical data
      loadHistoricalData();
      
      toast({ title: "Swing saved successfully!" });
    } catch (error) {
      console.error('Failed to save swing:', error);
      toast({
        title: "Save failed, will retry",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Work';
  };

  // Memoized chart data for progress section
  const chartData = useMemo(() => {
    if (!historicalSwings.length) return { scoreSeries: [], attackSeries: [], headDriftSeries: [], sepSeries: [] };

    const chronologicalSwings = [...historicalSwings].reverse();
    
    const scoreSeries: ChartPoint[] = chronologicalSwings
      .map((swing, index) => ({
        t: index,
        value: swing.score_phase1 || 0
      }))
      .filter(point => point.value > 0);

    const getMetricSeries = (metricName: string): ChartPoint[] => {
      return chronologicalSwings
        .map((swing, index) => {
          const metric = historicalMetrics.find(m => m.swing_id === swing.id && m.metric === metricName);
          return metric ? { t: index, value: metric.value } : null;
        })
        .filter(point => point !== null) as ChartPoint[];
    };

    return {
      scoreSeries,
      attackSeries: getMetricSeries('attack_angle_deg'),
      headDriftSeries: getMetricSeries('head_drift_cm'),
      sepSeries: getMetricSeries('hip_shoulder_sep_deg')
    };
  }, [historicalSwings, historicalMetrics]);

  const getLatestMetricValue = (metricName: string) => {
    const latestSwingMetric = historicalMetrics.find(m => 
      m.swing_id === historicalSwings[0]?.id && m.metric === metricName
    );
    return latestSwingMetric?.value;
  };

  if (!state?.videoBlob) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-bold mb-4">No Recording Found</h2>
          <p className="text-muted-foreground mb-4">
            Please record a swing first to see your analysis.
          </p>
          <Button onClick={() => navigate('/analysis')}>Go Back to Record</Button>
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
                <span className="text-sm">Take a complete swing through finish</span>
              </div>
            </div>

            <Button onClick={handleRetake} className="w-full">
              <RotateCcw className="w-4 h-4 mr-2" />
              Record Another Swing
            </Button>
          </Card>

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

  // Show consolidated results with tabs
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleRetake}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold">Results</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRetake}>
            Retake
          </Button>
        </div>

        <Tabs defaultValue="score" className="space-y-6" key={`tabs-${clientRequestId}`}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="score">This Swing</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
          </TabsList>

          <TabsContent value="score" className="space-y-6">
            {/* Score Display */}
            <Card className="p-8 text-center">
              <div className="relative inline-block">
                <div className={`w-32 h-32 rounded-full flex items-center justify-center text-white text-4xl font-bold ${getScoreColor(score)}`}>
                  {score}
                </div>
                <Badge 
                  variant="secondary" 
                  className="absolute -bottom-2 left-1/2 transform -translate-x-1/2"
                >
                  {getScoreLabel(score)}
                </Badge>
              </div>
            </Card>

            {/* Coaching Cues */}
            {coachingCards.length >= 2 && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Focus Areas</h3>
                <div className="flex flex-wrap gap-3 justify-center">
                  {coachingCards.slice(0, 2).map((card, index) => (
                    <Badge key={index} variant="outline" className="text-sm py-2 px-4">
                      {card.cue}
                    </Badge>
                  ))}
                </div>
              </Card>
            )}

            {/* Primary Drill */}
            {coachingCards.length > 0 && (
              <Card className="p-6">
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">{coachingCards[0].drill.name}</h3>
                  
                  <div className="bg-muted rounded-lg aspect-video flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <div className="text-4xl mb-2">🎬</div>
                      <div className="text-sm">Video demonstration coming soon</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Steps:</h4>
                    <p className="text-sm text-muted-foreground">
                      {coachingCards[0].drill.how_to || "Practice this drill to improve your swing mechanics"}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Equipment:</h4>
                    <p className="text-sm text-muted-foreground">
                      {coachingCards[0].drill.equipment || "No special equipment needed"}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Video Playback with Overlay */}
            <Card className="p-4">
              <h3 className="text-lg font-semibold mb-3">Your Swing</h3>
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full h-auto"
                  muted
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={(e) => {
                    if (canvasRef.current) {
                      canvasRef.current.width = e.currentTarget.videoWidth;
                      canvasRef.current.height = e.currentTarget.videoHeight;
                    }
                  }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  style={{ zIndex: 10 }}
                />
              </div>
              
              {poseData?.keypointsByFrame && videoRef.current && (
                <SwingOverlayCanvas
                  videoElement={videoRef.current}
                  keypointsByFrame={poseData.keypointsByFrame}
                  canvasRef={canvasRef}
                  showIdealPose={true}
                  showDetectedPose={true}
                  idealOpacity={0.5}
                  autoProgress={true}
                  cameraView="front"
                  handedness="right"
                  hideControls={true}
                />
              )}
            </Card>

            {/* Save Button */}
            <Card className="p-4">
              <Button 
                onClick={handleSaveSwing}
                disabled={isSaved || isSaving}
                className="w-full"
                size="lg"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : isSaved ? (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Swing Saved
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save This Swing
                  </>
                )}
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="progress" className="space-y-6">
            {progressLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="p-4">
                    <div className="animate-pulse">
                      <div className="h-4 bg-muted rounded mb-2"></div>
                      <div className="h-24 bg-muted rounded"></div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : historicalSwings.length === 0 ? (
              <Card className="p-8 text-center">
                <TrendingUp className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Historical Data</h3>
                <p className="text-muted-foreground mb-4">
                  Save this swing to start tracking your progress over time.
                </p>
              </Card>
            ) : (
              <>
                {/* Score Trend */}
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">Score Trend</h3>
                      <p className="text-sm text-muted-foreground">Last {historicalSwings.length} swings</p>
                    </div>
                    {historicalSwings[0]?.score_phase1 && (
                      <Badge 
                        className={`text-white ${getScoreColor(historicalSwings[0].score_phase1)}`}
                      >
                        {historicalSwings[0].score_phase1}
                      </Badge>
                    )}
                  </div>
                  <LineChart data={chartData.scoreSeries} height={80} />
                </Card>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">Attack Angle</h4>
                      <span className="text-xs text-muted-foreground">
                        {getLatestMetricValue('attack_angle_deg')?.toFixed(1) || '—'}°
                      </span>
                    </div>
                    <Sparkline data={chartData.attackSeries} height={40} />
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">Head Drift</h4>
                      <span className="text-xs text-muted-foreground">
                        {getLatestMetricValue('head_drift_cm')?.toFixed(1) || '—'}cm
                      </span>
                    </div>
                    <Sparkline data={chartData.headDriftSeries} height={40} />
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">Hip–Shoulder Sep</h4>
                      <span className="text-xs text-muted-foreground">
                        {getLatestMetricValue('hip_shoulder_sep_deg')?.toFixed(1) || '—'}°
                      </span>
                    </div>
                    <Sparkline data={chartData.sepSeries} height={40} />
                  </Card>
                </div>

                {/* Recent Swings */}
                <Card className="p-4">
                  <h3 className="text-lg font-semibold mb-4">Recent Swings</h3>
                  <div className="space-y-2">
                    {historicalSwings.map((swing) => {
                      const date = swing.created_at ? new Date(swing.created_at) : new Date();
                      const topCue = swing.cues?.[0];
                      
                      return (
                        <div
                          key={swing.id}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => navigate(`/swing/${swing.id}`)}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div>
                              <div className="text-sm font-medium">
                                {date.toLocaleDateString()} {date.toLocaleTimeString([], { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </div>
                              {topCue && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {topCue}
                                </div>
                              )}
                            </div>
                            
                            <div className="ml-auto flex items-center gap-2">
                              {swing.score_phase1 && (
                                <Badge 
                                  variant="secondary"
                                  className={`text-xs text-white ${getScoreColor(swing.score_phase1)}`}
                                >
                                  {swing.score_phase1}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground ml-2" />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Simple SVG Line Chart Component
function LineChart({ data, height = 80 }: { data: ChartPoint[], height?: number }) {
  if (!data.length) {
    return (
      <div 
        className="w-full bg-muted/20 rounded flex items-center justify-center text-xs text-muted-foreground"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const width = 300;
  const padding = 10;
  
  const minValue = Math.min(...data.map(d => d.value));
  const maxValue = Math.max(...data.map(d => d.value));
  const valueRange = maxValue - minValue || 1;
  
  const minTime = Math.min(...data.map(d => d.t));
  const maxTime = Math.max(...data.map(d => d.t));
  const timeRange = maxTime - minTime || 1;

  const points = data.map(point => {
    const x = padding + ((point.t - minTime) / timeRange) * (width - 2 * padding);
    const y = padding + (1 - (point.value - minValue) / valueRange) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        className="opacity-80"
      />
      {data.map((point, index) => {
        const x = padding + ((point.t - minTime) / timeRange) * (width - 2 * padding);
        const y = padding + (1 - (point.value - minValue) / valueRange) * (height - 2 * padding);
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="3"
            fill="hsl(var(--primary))"
          />
        );
      })}
    </svg>
  );
}

// Simple SVG Sparkline Component  
function Sparkline({ data, height = 40 }: { data: ChartPoint[], height?: number }) {
  if (!data.length) {
    return (
      <div 
        className="w-full bg-muted/20 rounded flex items-center justify-center text-xs text-muted-foreground"
        style={{ height }}
      >
        —
      </div>
    );
  }

  const width = 120;
  const padding = 4;
  
  const minValue = Math.min(...data.map(d => d.value));
  const maxValue = Math.max(...data.map(d => d.value));
  const valueRange = maxValue - minValue || 1;
  
  const minTime = Math.min(...data.map(d => d.t));
  const maxTime = Math.max(...data.map(d => d.t));
  const timeRange = maxTime - minTime || 1;

  const points = data.map(point => {
    const x = padding + ((point.t - minTime) / timeRange) * (width - 2 * padding);
    const y = padding + (1 - (point.value - minValue) / valueRange) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        className="opacity-70"
      />
    </svg>
  );
}