import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertCircle, Share2, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackCapture } from '@/lib/analytics';
import { metricSpecs } from '@/config/phase1_metrics';
import { metricDisplayNames } from '@/lib/metrics';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getVideoSignedUrl } from '@/lib/storage';
import { toast } from 'sonner';
import { SwingOverlayCanvas } from '@/components/SwingOverlayCanvas';
import { cn } from '@/lib/utils';
import { Header } from '@/components/Header';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Video player state
  const [showIdealForm] = useState(true);
  const [showMyForm] = useState(true);
  const [idealOpacity] = useState(0.5);
  const [selectedPhase] = useState('all');
  
  // Share functionality state
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareName, setShareName] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

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

  const getMetricStatus = (metricName: string, value: number): { color: string; status: string; progress: number; textColor: string } => {
    const spec = metricSpecs[metricName as keyof typeof metricSpecs];
    if (!spec) return { color: 'bg-gray-500', status: 'Unknown', progress: 0, textColor: 'text-gray-500' };

    const [min, max] = spec.target;
    let isInTarget = false;
    let progress = 0;

    if ('invert' in spec && spec.invert) {
      isInTarget = value <= max;
      if (value <= max) {
        progress = Math.max(0, Math.min(1, (max - value) / (max - min)));
      } else {
        const excessRatio = (value - max) / (max - min);
        progress = Math.max(0, 1 - excessRatio);
      }
    } else {
      isInTarget = value >= min && value <= max;
      if (value < min) {
        const deficitRatio = (min - value) / (max - min);
        progress = Math.max(0, -deficitRatio);
      } else if (value > max) {
        const excessRatio = (value - max) / (max - min);
        progress = Math.max(0, 1 - excessRatio);
      } else {
        progress = (value - min) / (max - min);
      }
    }

    if (isInTarget) {
      return { color: 'bg-green-500', status: 'On track', progress: progress * 100, textColor: 'text-green-400' };
    } else if (progress > 0.3) {
      return { color: 'bg-yellow-500', status: 'Close', progress: progress * 100, textColor: 'text-yellow-400' };
    } else {
      return { color: 'bg-red-500', status: 'Needs work', progress: progress * 100, textColor: 'text-red-400' };
    }
  };

  const formatTargetRange = (metricName: string): string => {
    const spec = metricSpecs[metricName as keyof typeof metricSpecs];
    if (!spec) return 'N/A';

    const [min, max] = spec.target;
    const suffix = ('invert' in spec && spec.invert) ? ' (lower is better)' : '';
    return `${min}–${max}${suffix}`;
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-black">
        <div className="px-4 py-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-10 w-10 bg-white/10 rounded-2xl animate-pulse"></div>
            <div className="h-8 bg-white/10 rounded animate-pulse w-48"></div>
          </div>
          
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white/5 border-white/10">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-white/10 rounded w-3/4"></div>
                  <div className="h-20 bg-white/10 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !swing) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-black">
        <div className="px-4 py-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-2xl text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-white">Swing Details</h1>
          </div>

          <div className="p-6 text-center rounded-2xl bg-white/5 border-white/10">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <h3 className="text-lg font-bold mb-2 text-white">
              {error ? 'Error Loading Swing' : 'Swing Not Found'}
            </h3>
            <p className="text-white/60 mb-4">
              {error || 'The requested swing could not be found.'}
            </p>
            <Button onClick={() => navigate('/')} className="rounded-2xl">
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const swingDate = swing.created_at ? new Date(swing.created_at) : new Date();
  
  // Get the top coaching note from AI and find the corresponding metric value
  const topCoachingNote = aiCoaching?.cues?.[0] || "Keep working on your fundamentals";
  
  // Map focus area names to metric keys
  const focusAreaToMetricKey: Record<string, string> = {
    'Hip-Shoulder Separation': 'hip_shoulder_sep_deg',
    'Head Drift': 'head_drift_cm',
    'Attack Angle': 'attack_angle_deg',
    'Bat Lag': 'bat_lag_deg',
    'Torso Tilt': 'torso_tilt_deg',
    'Contact Timing': 'contact_timing_frames',
    'Finish Balance': 'finish_balance_idx'
  };
  
  const topFocusArea = aiCoaching?.focusAreas?.[0];
  const metricKey = topFocusArea ? focusAreaToMetricKey[topFocusArea] : null;
  const topMetric = metricKey ? metrics.find(m => m.metric === metricKey) : null;
  
  const topCoachingStatus = topMetric && topMetric.value !== null 
    ? getMetricStatus(metricKey!, topMetric.value)
    : { status: 'On track', textColor: 'text-green-400' };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-black">
      {/* BRANDED HEADER BAR */}
      <Header 
        leftAction={
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/')}
            className="rounded-full text-white hover:text-white bg-white/10 hover:bg-white/20"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        }
        rightAction={
          <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
              >
                <Share2 className="w-4 h-4 mr-1.5" />
                Share
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl bg-[#0F172A] border border-white/10 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-white text-xl">
                  <Share2 className="w-5 h-5 text-emerald-400" />
                  Share Swing Analysis
                </DialogTitle>
                <DialogDescription className="text-white/60">
                  Send this analysis to a coach, parent, or friend.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="shareEmail" className="text-white font-medium">
                    Email Address *
                  </Label>
                  <Input
                    id="shareEmail"
                    type="email"
                    placeholder="coach@example.com"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    className="rounded-xl mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>
                
                <div>
                  <Label htmlFor="shareName" className="text-white font-medium">
                    Your Name (optional)
                  </Label>
                  <Input
                    id="shareName"
                    type="text"
                    placeholder="Your name"
                    value={shareName}
                    onChange={(e) => setShareName(e.target.value)}
                    className="rounded-xl mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                </div>
                
                <div>
                  <Label htmlFor="shareMessage" className="text-white font-medium">
                    Personal Message (optional)
                  </Label>
                  <Textarea
                    id="shareMessage"
                    placeholder="Hey coach, check out my latest swing..."
                    value={shareMessage}
                    onChange={(e) => setShareMessage(e.target.value)}
                    rows={3}
                    className="rounded-xl mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-emerald-500 focus:ring-emerald-500/20 resize-none"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button 
                  variant="ghost" 
                  onClick={() => setIsShareDialogOpen(false)}
                  disabled={isSending}
                  className="rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleShareSwing} 
                  disabled={isSending} 
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                >
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
        }
      />

      <div className="px-4 py-6 pb-32 max-w-2xl mx-auto space-y-4">
        {/* Date/Time info */}
        <div className="text-center mb-4">
          <div className="text-white/60 text-xs uppercase tracking-wide mb-1">Swing from</div>
          <div className="text-white text-sm font-medium">
            {swingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
            {swingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        {/* VIDEO PLAYER SECTION */}
        {swing.video_url && (
          <div className="rounded-2xl overflow-hidden border border-white/10 shadow-xl relative">
            {/* Swingscore Badge */}
            {swing.score_phase1 !== null && (
              <div className="absolute top-3 left-3 z-20 flex flex-col gap-1">
                <div className="bg-green-500/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-lg">
                  <div className="text-black font-bold text-base leading-none">
                    {swing.score_phase1}/100
                  </div>
                </div>
                <div className="bg-black/40 backdrop-blur-sm border border-green-500/40 rounded-lg px-2 py-1 shadow-md">
                  <div className="text-green-300 font-medium text-[10px] uppercase tracking-wide leading-none">
                    Swingscore
                  </div>
                </div>
              </div>
            )}
            
            {videoUrl ? (
              <div className="relative">
                <div className="relative bg-black">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-auto"
                    controls
                    preload="metadata"
                    playsInline
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
                    hideControls={true}
                  />
                )}
              </div>
            ) : isVideoLoading ? (
              <div className="p-12 text-center bg-black/50">
                <Loader2 className="w-12 h-12 mx-auto mb-3 text-white/60 animate-spin" />
                <p className="text-white/60">Loading video...</p>
              </div>
            ) : videoError ? (
              <div className="p-12 text-center bg-black/50">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
                <p className="text-red-400 font-medium mb-4">{videoError}</p>
                <Button 
                  variant="outline"
                  onClick={() => loadVideoUrl(swing.video_url!)}
                  className="rounded-2xl"
                >
                  Try Again
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {/* COACH NOTE AND DRILL CARDS (Side by Side) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Coach Note Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm shadow-lg">
            <div className="text-xs text-white/60 uppercase tracking-wide mb-2">Coach Note</div>
            {isLoadingCoaching ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="w-4 h-4 text-white/60 animate-spin" />
                <span className="text-white/60 text-sm">Loading...</span>
              </div>
            ) : (
              <>
                <p className="text-white text-sm leading-relaxed mb-3">
                  {topCoachingNote}
                </p>
                <div className={cn("text-xs font-medium", topCoachingStatus.textColor)}>
                  {topCoachingStatus.status}
                </div>
              </>
            )}
          </div>

          {/* Do this drill today Card */}
          {drill && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm shadow-lg">
              <div className="text-xs text-white/60 uppercase tracking-wide mb-2">Do this drill today</div>
              <div className="text-green-400 font-bold text-base mb-1">{drill.name}</div>
              <p className="text-white/70 text-xs mb-3 line-clamp-2">
                {drill.how_to || "Work on your fundamentals"}
              </p>
              <Button 
                size="sm" 
                className="w-full rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
                onClick={() => {
                  if (drill.id) {
                    navigate(`/drills/${drill.id}`);
                  } else {
                    toast.info('Drill details not available');
                  }
                }}
              >
                Start Drill
              </Button>
            </div>
          )}
        </div>

        {/* STAT TILES GRID (2 columns) */}
        <div className="grid grid-cols-2 gap-3">
          {(() => {
            // Map of database metric keys to coach-friendly display names
            const coachMetrics = [
              { key: 'hip_shoulder_sep_deg', label: 'HIP / SHOULDER SEP', unit: '°' },
              { key: 'attack_angle_deg', label: 'ATTACK ANGLE', unit: '°' },
              { key: 'head_drift_cm', label: 'HEAD DRIFT', unit: 'cm' },
              { key: 'bat_lag_deg', label: 'BAT LAG', unit: '°' },
              { key: 'torso_tilt_deg', label: 'TORSO TILT', unit: '°' },
              { key: 'contact_timing_frames', label: 'CONTACT TIMING', unit: '' }, // No unit shown
              { key: 'finish_balance_idx', label: 'FINISH BALANCE', unit: '' }
            ];

            const tilesToRender = coachMetrics
              .map(({ key, label, unit }) => {
                const metric = metrics.find(m => m.metric === key);
                if (!metric || metric.value === null) return null;
                
                const value = metric.value;
                const status = getMetricStatus(key, value);
                
                // Get target range from metricSpecs
                const spec = metricSpecs[key as keyof typeof metricSpecs];
                const targetRange = spec ? `${spec.target[0]}-${spec.target[1]}${unit}` : null;
                
                return (
                  <div 
                    key={key}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm flex flex-col gap-1"
                  >
                    <div className="text-[11px] text-white/40 uppercase tracking-wide">{label}</div>
                    <div className="text-white text-lg font-semibold">
                      {value.toFixed(1)}{unit}
                    </div>
                    {targetRange && (
                      <div className="text-[10px] text-white/30">
                        Target: {targetRange}
                      </div>
                    )}
                    <div className={cn("text-xs font-medium", status.textColor)}>
                      {status.status}
                    </div>
                  </div>
                );
              })
              .filter(Boolean);

            // Add bat speed tile if available from swing data
            if (swing.bat_speed_peak) {
              tilesToRender.push(
                <div 
                  key="bat_speed"
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-sm flex flex-col gap-1"
                >
                  <div className="text-[11px] text-white/40 uppercase tracking-wide">BAT SPEED</div>
                  <div className="text-white text-lg font-semibold">
                    {swing.bat_speed_peak.toFixed(1)} mph
                  </div>
                  <div className="text-xs font-medium text-green-400">
                    Peak speed
                  </div>
                </div>
              );
            }

            if (tilesToRender.length === 0) {
              return (
                <div className="col-span-2 text-center py-8 text-white/60">
                  No metrics available
                </div>
              );
            }

            return tilesToRender;
          })()}
        </div>

      </div>

      {/* FIXED FOOTER BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-lg border-t border-white/10 safe-area-bottom">
        <div className="px-4 py-4 max-w-2xl mx-auto flex flex-col gap-2">
          <Button
            onClick={() => navigate('/analysis')}
            className="w-full rounded-xl bg-white hover:bg-white/90 text-black font-bold py-4 h-auto text-base"
          >
            Record new swing after drill
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-white/60 hover:text-white hover:bg-transparent text-xs"
            onClick={() => toast.info('Comparison feature coming soon!')}
          >
            Compare to yesterday
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes glowpulse {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.3));
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(16, 185, 129, 0.6));
          }
        }

        @keyframes logoentrance {
          0% {
            opacity: 0;
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
