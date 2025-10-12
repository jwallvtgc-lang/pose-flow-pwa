import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Play, Pause, Loader2, Target, TrendingUp, AlertCircle, Zap, Share2, Mail, ChevronDown, ChevronUp, Bot, Activity, Trophy, CheckCircle2, XCircle, Camera, Download, TrendingDown, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackCapture } from '@/lib/analytics';
import { metricSpecs } from '@/config/phase1_metrics';
import { metricDisplayNames } from '@/lib/metrics';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { getVideoSignedUrl } from '@/lib/storage';
import { toast } from 'sonner';
import { SwingOverlayCanvas } from '@/components/SwingOverlayCanvas';
import { cn } from '@/lib/utils';

interface SwingData {
  id: string;
  created_at: string | null;
  score_phase1: number | null;
  cues: string[] | null;
  drill_id: string | null;
  video_url: string | null;
  pose_data?: any;
  bat_speed_peak?: number | null;
}

interface SwingMetric {
  swing_id: string | null;
  metric: string | null;
  value: number | null;
  unit: string | null;
}

interface DrillInfo {
  id: string | null;
  name: string | null;
  how_to: string | null;
  equipment: string | null;
}

interface AICoaching {
  cues: string[];
  explanations: string[];
  encouragement: string;
  focusAreas: string[];
}

export default function SwingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [swing, setSwing] = useState<SwingData | null>(null);
  const [metrics, setMetrics] = useState<SwingMetric[]>([]);
  const [drill, setDrill] = useState<DrillInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string>('');
  const [aiCoaching, setAiCoaching] = useState<AICoaching | null>(null);
  const [isLoadingCoaching, setIsLoadingCoaching] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Video player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [showIdealForm, setShowIdealForm] = useState(true);
  const [showMyForm, setShowMyForm] = useState(true);
  const [idealOpacity, setIdealOpacity] = useState(0.5);
  const [selectedPhase, setSelectedPhase] = useState('all');
  
  // UI state
  const [expandedFocusArea, setExpandedFocusArea] = useState<number | null>(null);
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  
  // Share functionality state
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareName, setShareName] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Animated score counter
  useEffect(() => {
    if (swing?.score_phase1) {
      const targetScore = swing.score_phase1;
      const duration = 1500;
      const steps = 60;
      const increment = targetScore / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= targetScore) {
          setAnimatedScore(targetScore);
          clearInterval(timer);
        } else {
          setAnimatedScore(Math.floor(current));
        }
      }, duration / steps);
      
      return () => clearInterval(timer);
    }
  }, [swing?.score_phase1]);

  useEffect(() => {
    if (id) {
      loadSwingDetail(id);
      trackCapture.swingDetailViewed(id);
    }
  }, [id]);

  const loadVideoUrl = async (videoPath: string) => {
    try {
      setIsVideoLoading(true);
      setVideoError('');
      const signedUrl = await getVideoSignedUrl(videoPath);
      setVideoUrl(signedUrl);
    } catch (err) {
      console.error('Failed to load video URL:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to load video';
      setVideoError(errorMsg);
    } finally {
      setIsVideoLoading(false);
    }
  };

  const handleShareSwing = async () => {
    if (!shareEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(shareEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!swing) return;

    setIsSending(true);
    try {
      const swingData = {
        id: swing.id,
        score: swing.score_phase1 || 0,
        date: swing.created_at ? new Date(swing.created_at).toLocaleDateString('en-US', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        }) : 'Unknown',
        metrics: metrics.map(metric => ({
          name: metricDisplayNames()[metric.metric || ''] || (metric.metric || '').replace(/_/g, ' '),
          value: metric.value || 0,
          unit: metric.unit || '',
          target: formatTargetRange(metric.metric || '')
        })),
        coachingFeedback: aiCoaching,
        drill: drill ? {
          name: drill.name || '',
          instructions: drill.how_to || ''
        } : undefined
      };

      const { error } = await supabase.functions.invoke('send-swing-email', {
        body: {
          toEmail: shareEmail.trim(),
          fromName: shareName.trim() || undefined,
          swingData,
          message: shareMessage.trim() || undefined
        }
      });

      if (error) throw error;

      toast.success('Swing analysis sent via email!');
      setIsShareDialogOpen(false);
      setShareEmail('');
      setShareName('');
      setShareMessage('');
      
    } catch (err) {
      console.error('Failed to share swing:', err);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const generateAICoaching = async (metricsData: SwingMetric[]) => {
    if (metricsData.length === 0) return;
    
    try {
      setIsLoadingCoaching(true);
      
      const aiMetrics = metricsData.map(metric => {
        const metricName = metric.metric || '';
        const spec = metricSpecs[metricName as keyof typeof metricSpecs];
        const value = metric.value || 0;
        
        if (!spec) return null;
        
        const [min, max] = spec.target;
        let percentileRank = 50;
        
        if ('invert' in spec && spec.invert) {
          percentileRank = value <= min ? 90 : (value >= max ? 10 : 90 - ((value - min) / (max - min)) * 80);
        } else {
          percentileRank = value >= max ? 90 : (value <= min ? 10 : 10 + ((value - min) / (max - min)) * 80);
        }
        
        return {
          name: metricDisplayNames()[metricName] || metricName.replace(/_/g, ' '),
          value: value,
          target: spec.target,
          unit: metric.unit || '',
          percentileRank: Math.round(percentileRank)
        };
      }).filter(Boolean);

      const response = await supabase.functions.invoke('generate-swing-coaching', {
        body: {
          metrics: aiMetrics,
          playerLevel: 'high_school',
          previousScore: swing?.score_phase1
        }
      });
      
      const { data, error } = response;

      if (error) throw error;
      
      setAiCoaching(data);
    } catch (err) {
      console.error('Failed to generate AI coaching:', err);
      setAiCoaching({
        cues: ["Stay balanced through contact", "Keep your eye on the ball"],
        explanations: [
          "Balance helps you make solid contact every time.",
          "Tracking the ball improves your timing and accuracy."
        ],
        encouragement: "Great work on tracking your swing progress! Keep practicing these fundamentals.",
        focusAreas: ["balance", "tracking"]
      });
    } finally {
      setIsLoadingCoaching(false);
    }
  };

  const loadSwingDetail = async (swingId: string) => {
    try {
      setIsLoading(true);
      setError('');

      const { data: swingData, error: swingError } = await supabase
        .from('swings')
        .select('id, created_at, score_phase1, cues, drill_id, drill_data, video_url, pose_data, bat_speed_peak')
        .eq('id', swingId)
        .maybeSingle();

      if (swingError) {
        if (swingError.message?.includes('401') || swingError.code === '401') {
          navigate('/auth');
          return;
        } else {
          setError('Failed to load swing data');
        }
        return;
      }
      
      if (!swingData) {
        throw new Error('Swing not found');
      }
      
      const processedSwing = {
        ...swingData,
        created_at: swingData.created_at || '',
        cues: Array.isArray(swingData.cues) ? swingData.cues.filter((cue): cue is string => typeof cue === 'string') : 
              swingData.cues ? [String(swingData.cues)] : null
      } as SwingData & { drill_data?: any };
      setSwing(processedSwing);

      // Load video automatically
      if (processedSwing.video_url) {
        loadVideoUrl(processedSwing.video_url);
      }

      const { data: metricsData, error: metricsError } = await supabase
        .from('swing_metrics')
        .select('swing_id, metric, value, unit')
        .eq('swing_id', swingId)
        .eq('phase', 1);

      if (metricsError) {
        if (metricsError.message?.includes('401') || metricsError.code === '401') {
          navigate('/auth');
          return;
        } else {
          setError('Failed to load swing metrics');
        }
        return;
      }
      const processedMetrics = (metricsData || []).map(metric => ({
        swing_id: metric.swing_id || '',
        metric: metric.metric || '',
        value: metric.value || 0,
        unit: metric.unit || ''
      })) as SwingMetric[];
      setMetrics(processedMetrics);

      await generateAICoaching(processedMetrics);

      if (processedSwing.drill_id) {
        const { data: drillData, error: drillError } = await supabase
          .from('drills')
          .select('id, name, how_to, equipment')
          .eq('id', processedSwing.drill_id)
          .single();

        if (!drillError && drillData) {
          setDrill(drillData as DrillInfo);
        }
      } else if (processedSwing.drill_data) {
        const drillData = processedSwing.drill_data;
        if (drillData && drillData.name) {
          setDrill({
            id: null,
            name: drillData.name || '',
            how_to: drillData.how_to || '',
            equipment: drillData.equipment || ''
          });
        }
      }

    } catch (err) {
      console.error('Failed to load swing detail:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load swing details';
      setError(errorMessage);
      toast.error(`Failed to load swing: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreLabel = (score: number | null) => {
    if (!score) return 'N/A';
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Work';
  };

  const getScoreIcon = (score: number | null) => {
    if (!score) return null;
    if (score >= 80) return <Trophy className="w-6 h-6" />;
    if (score >= 60) return <Target className="w-6 h-6" />;
    return <TrendingUp className="w-6 h-6" />;
  };

  const getMetricStatus = (metricName: string, value: number): { color: string; status: string; progress: number; borderColor: string; bgColor: string } => {
    const spec = metricSpecs[metricName as keyof typeof metricSpecs];
    if (!spec) return { color: 'text-muted-foreground', status: 'Unknown', progress: 0, borderColor: 'border-l-gray-300', bgColor: 'bg-gray-50' };

    const [min, max] = spec.target;
    let isInTarget = false;
    let progress = 0;

    if ('invert' in spec && spec.invert) {
      // For inverted metrics (lower is better)
      isInTarget = value <= max;
      if (value <= max) {
        // Within or below target - calculate progress
        progress = Math.max(0, Math.min(1, (max - value) / (max - min)));
      } else {
        // Above max (bad) - penalize with negative progress
        const excessRatio = (value - max) / (max - min);
        progress = Math.max(0, 1 - excessRatio); // Decreases as value exceeds max
      }
    } else {
      // For normal metrics (higher/within range is better)
      isInTarget = value >= min && value <= max;
      if (value < min) {
        // Below min (bad) - calculate how far below
        const deficitRatio = (min - value) / (max - min);
        progress = Math.max(0, -deficitRatio); // Negative progress
      } else if (value > max) {
        // Above max (bad) - penalize with reduced progress
        const excessRatio = (value - max) / (max - min);
        progress = Math.max(0, 1 - excessRatio); // Decreases as value exceeds max
      } else {
        // Within range - normal calculation
        progress = (value - min) / (max - min);
      }
    }

    if (isInTarget) {
      return { color: 'text-green-600', status: 'Great!', progress: progress * 100, borderColor: 'border-l-green-500', bgColor: 'bg-green-50' };
    } else if (progress > 0.3 && progress < 0.7) {
      return { color: 'text-orange-600', status: 'Good', progress: progress * 100, borderColor: 'border-l-orange-500', bgColor: 'bg-orange-50' };
    } else {
      return { color: 'text-red-600', status: 'Needs Work', progress: progress * 100, borderColor: 'border-l-red-500', bgColor: 'bg-red-50' };
    }
  };

  const formatTargetRange = (metricName: string): string => {
    const spec = metricSpecs[metricName as keyof typeof metricSpecs];
    if (!spec) return 'N/A';

    const [min, max] = spec.target;
    const suffix = ('invert' in spec && spec.invert) ? ' (lower is better)' : '';
    return `${min}–${max}${suffix}`;
  };

  const scrollToMetric = (metricKey: string) => {
    setExpandedMetric(metricKey);
    const element = document.getElementById(`metric-${metricKey}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleVideoPlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Calculate quick stats
  const calculateQuickStats = () => {
    if (metrics.length === 0) return null;
    
    let bestMetric = { name: '', value: 0, score: 0 };
    let worstMetric = { name: '', value: 0, score: 100 };
    
    metrics.forEach(metric => {
      if (!metric.metric || metric.value === null) return;
      const status = getMetricStatus(metric.metric, metric.value);
      const normalizedScore = status.progress;
      
      if (normalizedScore > bestMetric.score) {
        bestMetric = {
          name: metricDisplayNames()[metric.metric] || metric.metric,
          value: metric.value,
          score: normalizedScore
        };
      }
      
      if (normalizedScore < worstMetric.score) {
        worstMetric = {
          name: metricDisplayNames()[metric.metric] || metric.metric,
          value: metric.value,
          score: normalizedScore
        };
      }
    });
    
    return { bestMetric, worstMetric };
  };

  const quickStats = calculateQuickStats();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-10 w-10 bg-muted rounded-2xl animate-pulse"></div>
            <div className="h-8 bg-muted rounded animate-pulse w-48"></div>
          </div>
          
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="p-6 rounded-2xl">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-20 bg-muted rounded"></div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !swing) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-2xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">Swing Details</h1>
          </div>

          <Card className="p-6 text-center rounded-2xl">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h3 className="text-lg font-bold mb-2">
              {error ? 'Error Loading Swing' : 'Swing Not Found'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {error || 'The requested swing could not be found.'}
            </p>
            <Button onClick={() => navigate('/')} className="rounded-2xl">
              Back to Home
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const swingDate = swing.created_at ? new Date(swing.created_at) : new Date();

  return (
    <div className="min-h-screen bg-background">
      {/* STICKY HEADER */}
      <div className="sticky top-0 z-50 backdrop-blur-lg bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 border-b border-white/10">
        <div className="container mx-auto px-4 py-4 max-w-2xl">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/')}
              className="rounded-2xl text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            
            <div className="flex-1 text-center">
              <h1 className="text-lg font-bold text-white">Swing Analysis</h1>
              <p className="text-xs text-white/80">
                {swingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
                {swingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            
            <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="rounded-2xl text-white hover:bg-white/20"
                >
                  <Share2 className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Share2 className="w-5 h-5" />
                    Share Swing Analysis
                  </DialogTitle>
                  <DialogDescription>
                    Send this analysis to a coach, parent, or friend.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="shareEmail">Email Address *</Label>
                    <Input
                      id="shareEmail"
                      type="email"
                      placeholder="coach@example.com"
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      className="rounded-2xl mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="shareName">Your Name (optional)</Label>
                    <Input
                      id="shareName"
                      type="text"
                      placeholder="Your name"
                      value={shareName}
                      onChange={(e) => setShareName(e.target.value)}
                      className="rounded-2xl mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="shareMessage">Personal Message (optional)</Label>
                    <Textarea
                      id="shareMessage"
                      placeholder="Hey coach, check out my latest swing..."
                      value={shareMessage}
                      onChange={(e) => setShareMessage(e.target.value)}
                      rows={3}
                      className="rounded-2xl mt-1"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsShareDialogOpen(false)}
                    disabled={isSending}
                    className="rounded-2xl"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleShareSwing} disabled={isSending} className="rounded-2xl">
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Send Email
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
        {/* HERO SCORE CARD */}
        <Card className="p-6 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-2xl text-white border-0 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white/90 text-sm font-medium mb-1">
                {swingDate.toLocaleDateString('en-US', { 
                  weekday: 'long',
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
              <div className="text-white/70 text-xs">
                {swingDate.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                {getScoreIcon(swing.score_phase1)}
                <div className="text-6xl font-bold">
                  {animatedScore}
                </div>
              </div>
              <Badge className="bg-white/20 text-white border-0 rounded-full backdrop-blur-sm">
                {getScoreLabel(swing.score_phase1)}
              </Badge>
            </div>
          </div>
        </Card>

        {/* VIDEO PLAYER SECTION */}
        {swing.video_url && (
          <Card className="p-0 rounded-2xl overflow-hidden shadow-sm">
            {videoUrl ? (
              <div className="relative">
                <div className="relative bg-black">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-auto"
                    preload="metadata"
                    playsInline
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onLoadedMetadata={(e) => {
                      if (canvasRef.current) {
                        canvasRef.current.width = e.currentTarget.videoWidth;
                        canvasRef.current.height = e.currentTarget.videoHeight;
                      }
                    }}
                    onError={() => setVideoError('Failed to play video')}
                  >
                    Your browser does not support video playback.
                  </video>
                  <canvas
                    ref={canvasRef}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none"
                    style={{ zIndex: 10 }}
                  />
                  
                  {/* Video Overlay Controls */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Play/Pause Button */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Button
                        size="icon"
                        onClick={handleVideoPlayPause}
                        className="pointer-events-auto w-16 h-16 rounded-full bg-white/90 hover:bg-white text-black"
                      >
                        {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                      </Button>
                    </div>
                    
                    {/* Top Right Controls */}
                    <div className="absolute top-4 right-4 space-y-2 pointer-events-auto">
                      <div className="bg-black/70 backdrop-blur-sm rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-white text-xs font-medium">Ideal Form</span>
                          <Switch
                            checked={showIdealForm}
                            onCheckedChange={setShowIdealForm}
                            className="data-[state=checked]:bg-green-500"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-white text-xs font-medium">My Form</span>
                          <Switch
                            checked={showMyForm}
                            onCheckedChange={setShowMyForm}
                            className="data-[state=checked]:bg-blue-500"
                          />
                        </div>
                        {showIdealForm && (
                          <div className="pt-2 border-t border-white/20">
                            <span className="text-white text-xs">Opacity</span>
                            <Slider
                              value={[idealOpacity * 100]}
                              onValueChange={(value) => setIdealOpacity(value[0] / 100)}
                              max={100}
                              step={10}
                              className="mt-2"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Match Badge */}
                    {showIdealForm && showMyForm && (
                      <div className="absolute top-4 left-4 pointer-events-none">
                        <Badge className="bg-white/90 text-black border-0 text-sm font-bold">
                          57% Match
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
                
                {swing?.pose_data?.keypointsByFrame && videoRef.current && (
                  <SwingOverlayCanvas
                    videoElement={videoRef.current}
                    keypointsByFrame={swing.pose_data.keypointsByFrame}
                    canvasRef={canvasRef}
                    showIdealPose={showIdealForm}
                    showDetectedPose={showMyForm}
                    idealOpacity={idealOpacity}
                    selectedPhase={selectedPhase as any}
                    autoProgress={true}
                    cameraView="front"
                    handedness="right"
                  />
                )}
                
                {/* Video Controls Bar */}
                <div className="p-4 bg-card border-t">
                  <div className="flex items-center gap-2 justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleVideoPlayPause}
                      className="rounded-xl"
                    >
                      {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                      {isPlaying ? 'Pause' : 'Play'}
                    </Button>
                    
                    <select
                      value={selectedPhase}
                      onChange={(e) => setSelectedPhase(e.target.value)}
                      className="text-sm border rounded-xl px-3 py-2 bg-background"
                    >
                      <option value="all">All Phases</option>
                      <option value="setup">Setup</option>
                      <option value="load">Load</option>
                      <option value="stride">Stride</option>
                      <option value="contact">Contact</option>
                      <option value="extension">Extension</option>
                      <option value="finish">Finish</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : isVideoLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-12 h-12 mx-auto mb-3 text-primary animate-spin" />
                <p className="text-muted-foreground">Loading video...</p>
              </div>
            ) : videoError ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive" />
                <p className="text-destructive font-medium mb-4">{videoError}</p>
                <Button 
                  variant="outline"
                  onClick={() => loadVideoUrl(swing.video_url!)}
                  className="rounded-2xl"
                >
                  Try Again
                </Button>
              </div>
            ) : null}
          </Card>
        )}

        {/* QUICK STATS ROW */}
        {quickStats && swing.score_phase1 && (
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex gap-3 min-w-max pb-2">
              <Card className="p-4 rounded-2xl min-w-[150px] cursor-pointer hover:shadow-md transition-shadow">
                <div className="text-center">
                  <Activity className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">{swing.score_phase1}%</div>
                  <div className="text-xs text-muted-foreground">Overall Score</div>
                </div>
              </Card>
              
              <Card 
                className="p-4 rounded-2xl min-w-[150px] cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => scrollToMetric(quickStats.bestMetric.name)}
              >
                <div className="text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <div className="text-sm font-bold text-green-600">Best Metric</div>
                  <div className="text-xs text-muted-foreground truncate">{quickStats.bestMetric.name}</div>
                </div>
              </Card>
              
              <Card 
                className="p-4 rounded-2xl min-w-[150px] cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => scrollToMetric(quickStats.worstMetric.name)}
              >
                <div className="text-center">
                  <XCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
                  <div className="text-sm font-bold text-red-600">Needs Work</div>
                  <div className="text-xs text-muted-foreground truncate">{quickStats.worstMetric.name}</div>
                </div>
              </Card>
              
              <Card className="p-4 rounded-2xl min-w-[150px]">
                <div className="text-center">
                  <Zap className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                  <div className="text-2xl font-bold">
                    {swing.bat_speed_peak ? `${swing.bat_speed_peak.toFixed(1)}` : 'N/A'}
                  </div>
                  <div className="text-xs text-muted-foreground">Bat Speed (MPH)</div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* AI COACHING SECTION */}
        {isLoadingCoaching ? (
          <Card className="p-6 rounded-2xl">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating AI coaching...</p>
            </div>
          </Card>
        ) : aiCoaching ? (
          <Card className="p-0 rounded-2xl overflow-hidden border-2 border-primary/20">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-6 border-b">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center">
                  <Bot className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Your AI Coach</h3>
                  <p className="text-sm text-muted-foreground">Personalized feedback</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              {aiCoaching.encouragement && (
                <div className="bg-primary/10 rounded-2xl p-4">
                  <p className="text-sm font-medium leading-relaxed">
                    {aiCoaching.encouragement}
                  </p>
                </div>
              )}

              {aiCoaching.cues && aiCoaching.cues.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-sm">Focus Areas:</h4>
                  {aiCoaching.cues.map((cue, index) => (
                    <Card 
                      key={index}
                      className={cn(
                        "p-4 rounded-2xl cursor-pointer transition-all",
                        expandedFocusArea === index ? "ring-2 ring-primary" : ""
                      )}
                      onClick={() => setExpandedFocusArea(expandedFocusArea === index ? null : index)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Zap className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h5 className="font-bold text-sm">Work on your {aiCoaching.focusAreas[index] || 'technique'}!</h5>
                            {expandedFocusArea === index ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {cue}
                          </p>
                          {expandedFocusArea === index && aiCoaching.explanations && aiCoaching.explanations[index] && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs leading-relaxed">
                                {aiCoaching.explanations[index]}
                              </p>
                              {drill && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="mt-3 rounded-xl"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    document.getElementById('drill-section')?.scrollIntoView({ behavior: 'smooth' });
                                  }}
                                >
                                  View Drill
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ) : null}

        {/* PRACTICE DRILL SECTION */}
        {drill && (
          <Card id="drill-section" className="p-6 rounded-2xl border-2 border-green-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Recommended Drill</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Activity className="w-3 h-3" />
                  <span>Personalized for you</span>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-lg">{drill.name}</h4>
              {drill.how_to && (
                <p className="text-sm leading-relaxed">{drill.how_to}</p>
              )}
              {drill.equipment && (
                <div className="flex items-center gap-2 pt-2 border-t border-green-200/50">
                  <Target className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-medium">Equipment: {drill.equipment}</span>
                </div>
              )}
              <Button className="w-full mt-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
                Start Drill
              </Button>
            </div>
          </Card>
        )}

        {/* METRICS BREAKDOWN */}
        <Card className="p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-500 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold">Detailed Metrics</h3>
          </div>
          
          {metrics.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground text-sm">No metrics available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(metricSpecs)
                .map(([metricKey]) => {
                  const metric = metrics.find(m => m.metric === metricKey);
                  if (!metric || metric.value === null || metric.value === undefined) return null;
                  
                  const displayName = metricDisplayNames()[metricKey] || metricKey.replace(/_/g, ' ');
                  const value = metric.value;
                  const unit = metric.unit || '';
                  const status = getMetricStatus(metricKey, value);
                  const isExpanded = expandedMetric === metricKey;
                  
                  return {
                    metricKey,
                    displayName,
                    value,
                    unit,
                    status,
                    isExpanded,
                    priority: status.status === 'Needs Work' ? 0 : status.status === 'Good' ? 1 : 2
                  };
                })
                .filter(Boolean)
                .sort((a, b) => a!.priority - b!.priority)
                .map((item) => {
                  if (!item) return null;
                  const { metricKey, displayName, value, unit, status, isExpanded } = item;
                  
                  return (
                    <Card
                      key={metricKey}
                      id={`metric-${metricKey}`}
                      className={cn(
                        "p-4 rounded-2xl border-l-4 cursor-pointer transition-all",
                        status.borderColor,
                        isExpanded ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md"
                      )}
                      onClick={() => setExpandedMetric(isExpanded ? null : metricKey)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", status.bgColor)}>
                          <Activity className={cn("w-5 h-5", status.color)} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <h4 className="font-bold text-sm">{displayName}</h4>
                              <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-2xl font-bold">
                                  {value.toFixed(1)}{unit}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge className={cn("rounded-full text-xs", status.color, "bg-transparent border border-current")}>
                                {status.status}
                              </Badge>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                          
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <Target className="w-3 h-3" />
                            <span>Target: {formatTargetRange(metricKey)}</span>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="mt-3">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={cn("h-full transition-all", status.color.replace('text-', 'bg-'))}
                                style={{ width: `${Math.min(100, Math.max(0, status.progress))}%` }}
                              />
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t space-y-3">
                              <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                <div className="text-xs leading-relaxed">
                                  <p className="font-medium mb-1">What this means:</p>
                                  <p className="text-muted-foreground">
                                    {status.status === 'Great!' 
                                      ? `Your ${displayName.toLowerCase()} is in the optimal range. Keep up the great work!`
                                      : status.status === 'Good'
                                      ? `Your ${displayName.toLowerCase()} is decent but has room for improvement.`
                                      : `Your ${displayName.toLowerCase()} needs attention. Focus on the recommended drills.`
                                    }
                                  </p>
                                </div>
                              </div>
                              
                              {status.status !== 'Great!' && (
                                <div className="flex items-center gap-2">
                                  {status.progress > 50 ? (
                                    <TrendingUp className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <TrendingDown className="w-4 h-4 text-red-500" />
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {status.progress > 50 ? 'Improving' : 'Work on this'}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
            </div>
          )}
        </Card>

        {/* ACTION BUTTONS */}
        <div className="space-y-3 pb-8">
          <Button 
            className="w-full rounded-2xl h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
            onClick={() => drill && document.getElementById('drill-section')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Target className="w-5 h-5 mr-2" />
            Practice Recommended Drills
          </Button>
          
          <div className="grid grid-cols-2 gap-3">
            <Button 
              variant="outline" 
              className="rounded-2xl h-11"
              onClick={() => {
                if (videoUrl) {
                  const a = document.createElement('a');
                  a.href = videoUrl;
                  a.download = `swing-${swing.id}.mp4`;
                  a.click();
                }
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Save Video
            </Button>
            <Button 
              variant="outline" 
              className="rounded-2xl h-11"
              onClick={() => setIsShareDialogOpen(true)}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Results
            </Button>
          </div>
          
          <Button 
            className="w-full rounded-2xl h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            onClick={() => navigate('/swing-analysis')}
          >
            <Camera className="w-5 h-5 mr-2" />
            Record Another Swing
          </Button>
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          size="icon"
          className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg"
          onClick={() => navigate('/swing-analysis')}
        >
          <Camera className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}
