import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Play, Loader2, Target, TrendingUp, AlertCircle, Zap, Award, Share2, Send } from 'lucide-react';
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

interface SwingData {
  id: string;
  created_at: string | null;
  score_phase1: number | null;
  cues: string[] | null;
  drill_id: string | null;
  video_url: string | null;
}

interface SwingMetric {
  swing_id: string | null;
  metric: string | null;
  value: number | null;
  unit: string | null;
}

interface DrillInfo {
  id: string | null; // Allow null for embedded drills
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
  
  // Share functionality state
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [sharePhoneNumber, setSharePhoneNumber] = useState('');
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
      setVideoError('Failed to load video');
    } finally {
      setIsVideoLoading(false);
    }
  };

  const handleShareSwing = async () => {
    if (!sharePhoneNumber.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    if (!swing) return;

    setIsSending(true);
    try {
      // Prepare swing data for sharing
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

      // Call the edge function
      const { error } = await supabase.functions.invoke('send-swing-details', {
        body: {
          toPhoneNumber: sharePhoneNumber.trim(),
          fromName: shareName.trim() || undefined,
          swingData,
          message: shareMessage.trim() || undefined
        }
      });

      if (error) throw error;

      toast.success('Swing analysis sent via SMS!');
      setIsShareDialogOpen(false);
      setSharePhoneNumber('');
      setShareName('');
      setShareMessage('');
      
    } catch (err) {
      console.error('Failed to share swing:', err);
      toast.error('Failed to send SMS. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const generateAICoaching = async (metricsData: SwingMetric[]) => {
    if (metricsData.length === 0) return;
    
    try {
      setIsLoadingCoaching(true);
      
      // Transform metrics for AI coaching
      const aiMetrics = metricsData.map(metric => {
        const metricName = metric.metric || '';
        const spec = metricSpecs[metricName as keyof typeof metricSpecs];
        const value = metric.value || 0;
        
        if (!spec) return null;
        
        // Calculate percentile rank based on target range
        const [min, max] = spec.target;
        let percentileRank = 50; // Default to average
        
        if ('invert' in spec && spec.invert) {
          // Lower is better (like head drift)
          percentileRank = value <= min ? 90 : (value >= max ? 10 : 90 - ((value - min) / (max - min)) * 80);
        } else {
          // Higher is better (like hip-shoulder separation)
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

      const { data, error } = await supabase.functions.invoke('generate-swing-coaching', {
        body: {
          metrics: aiMetrics,
          playerLevel: 'high_school', // 12-18 year olds
          previousScore: swing?.score_phase1
        }
      });

      if (error) throw error;
      setAiCoaching(data);
    } catch (err) {
      console.error('Failed to generate AI coaching:', err);
      // Set fallback coaching
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

      // Fetch swing data
      const { data: swingData, error: swingError } = await supabase
        .from('swings')
        .select('id, created_at, score_phase1, cues, drill_id, drill_data, video_url')
        .eq('id', swingId)
        .single();

      if (swingError) throw swingError;
      const processedSwing = {
        ...swingData,
        created_at: swingData.created_at || '',
        cues: Array.isArray(swingData.cues) ? swingData.cues.filter((cue): cue is string => typeof cue === 'string') : 
              swingData.cues ? [String(swingData.cues)] : null
      } as SwingData & { drill_data?: any };
      setSwing(processedSwing);

      // Fetch swing metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('swing_metrics')
        .select('swing_id, metric, value, unit')
        .eq('swing_id', swingId)
        .eq('phase', 1);

      if (metricsError) throw metricsError;
      const processedMetrics = (metricsData || []).map(metric => ({
        swing_id: metric.swing_id || '',
        metric: metric.metric || '',
        value: metric.value || 0,
        unit: metric.unit || ''
      })) as SwingMetric[];
      setMetrics(processedMetrics);

      // Generate AI coaching
      await generateAICoaching(processedMetrics);

      // Handle drill information - check both drill_id and embedded drill_data
      if (processedSwing.drill_id) {
        // Fetch drill from drills table
        const { data: drillData, error: drillError } = await supabase
          .from('drills')
          .select('id, name, how_to, equipment')
          .eq('id', processedSwing.drill_id)
          .single();

        if (!drillError && drillData) {
          const processedDrill = {
            ...drillData,
            name: drillData.name || ''
          } as DrillInfo;
          setDrill(processedDrill);
        }
      } else if (processedSwing.drill_data) {
        // Use embedded drill data from fallback coaching
        const drillData = processedSwing.drill_data;
        if (drillData && drillData.name) {
          const processedDrill = {
            id: null, // No ID for embedded drills
            name: drillData.name || '',
            how_to: drillData.how_to || '',
            equipment: drillData.equipment || ''
          } as DrillInfo;
          setDrill(processedDrill);
        }
      }

    } catch (err) {
      console.error('Failed to load swing detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to load swing details');
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

  const getMetricStatus = (metricName: string, value: number): { color: string; status: string; progress: number } => {
    const spec = metricSpecs[metricName as keyof typeof metricSpecs];
    if (!spec) return { color: 'bg-muted', status: 'Unknown', progress: 0 };

    const [min, max] = spec.target;
    let isInTarget = false;
    let progress = 0;

    if ('invert' in spec && spec.invert) {
      // Lower is better
      isInTarget = value <= max;
      progress = Math.max(0, Math.min(1, (max - value) / (max - min)));
    } else {
      // Higher is better or within range
      isInTarget = value >= min && value <= max;
      progress = Math.max(0, Math.min(1, (value - min) / (max - min)));
    }

    if (isInTarget) {
      return { color: 'text-green-600', status: 'Great!', progress: progress * 100 };
    } else {
      return { color: 'text-red-600', status: 'Needs Work', progress: progress * 100 };
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
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6 max-w-lg">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="h-6 bg-muted rounded animate-pulse w-32"></div>
          </div>
          
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-6 rounded-3xl">
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
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6 max-w-lg">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-anton font-black">Swing Details</h1>
          </div>

          <Card className="p-6 text-center rounded-3xl">
            <h3 className="text-lg font-anton font-black mb-2">
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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="h-10 w-10 p-0 rounded-2xl">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-anton font-black text-gray-900">Swing Analysis</h1>
        </div>

        <div className="space-y-6">
          {/* Score & Date Card */}
          <Card className="p-6 bg-gradient-to-br from-blue-600 to-purple-700 rounded-3xl text-white relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-blue-100 text-sm font-medium mb-1">
                  {swingDate.toLocaleDateString('en-US', { 
                    weekday: 'long',
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
                <div className="text-blue-200 text-xs">
                  {swingDate.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {swing.score_phase1 && (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-2">
                      <span className="text-3xl font-anton font-black">{swing.score_phase1}</span>
                    </div>
                    <Badge variant="secondary" className="bg-white/20 text-white border-0 rounded-full text-xs">
                      {getScoreLabel(swing.score_phase1)}
                    </Badge>
                  </div>
                )}
                
                <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="bg-white/20 hover:bg-white/30 text-white border-white/30 rounded-2xl">
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-3xl">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 font-anton font-black">
                        <Share2 className="w-5 h-5" />
                        Share Swing Analysis
                      </DialogTitle>
                      <DialogDescription>
                        Send this detailed swing analysis to a coach, parent, or friend via text message.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="sharePhoneNumber" className="font-medium">Phone Number *</Label>
                        <Input
                          id="sharePhoneNumber"
                          type="tel"
                          placeholder="+1 (555) 123-4567"
                          value={sharePhoneNumber}
                          onChange={(e) => setSharePhoneNumber(e.target.value)}
                          className="rounded-2xl mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="shareName" className="font-medium">Your Name (optional)</Label>
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
                        <Label htmlFor="shareMessage" className="font-medium">Personal Message (optional)</Label>
                        <Textarea
                          id="shareMessage"
                          placeholder="Hey coach, here's my latest swing analysis..."
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
                            <Send className="w-4 h-4 mr-2" />
                            Send SMS
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </Card>

          {/* Video Playback - Move to top */}
          {swing.video_url && (
            <Card className="p-6 rounded-3xl">
              <h3 className="text-lg font-anton font-black text-gray-900 mb-4">Your Swing Video</h3>
              
              {!videoUrl && !isVideoLoading && !videoError && (
                <div className="bg-gray-100 rounded-2xl p-6 text-center">
                  <Play className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-600 font-medium mb-4">Ready to watch your swing</p>
                  <Button 
                    onClick={() => loadVideoUrl(swing.video_url!)}
                    className="rounded-2xl"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Load Video
                  </Button>
                </div>
              )}

              {isVideoLoading && (
                <div className="bg-gray-100 rounded-2xl p-8 text-center">
                  <Loader2 className="w-12 h-12 mx-auto mb-3 text-primary animate-spin" />
                  <p className="text-gray-600">Loading your video...</p>
                </div>
              )}

              {videoError && (
                <div className="bg-red-50 rounded-2xl p-6 text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
                  <p className="text-red-700 font-medium mb-4">{videoError}</p>
                  <Button 
                    variant="outline"
                    onClick={() => loadVideoUrl(swing.video_url!)}
                    className="rounded-2xl"
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {videoUrl && (
                <div className="bg-black rounded-2xl overflow-hidden">
                  <video
                    src={videoUrl}
                    controls
                    className="w-full h-auto"
                    preload="metadata"
                    onError={() => setVideoError('Failed to load video')}
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              )}
            </Card>
          )}

          {/* AI Coach Feedback - Shortened */}
          {isLoadingCoaching ? (
            <Card className="p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <h3 className="text-lg font-anton font-black">Getting your coach feedback...</h3>
              </div>
            </Card>
          ) : aiCoaching && (
            <Card className="p-6 rounded-3xl border-l-4 border-primary">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-anton font-black text-gray-900">Your Coach Says</h3>
                  <p className="text-sm text-gray-600">AI-powered feedback just for you</p>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-2xl p-4 mb-4">
                <p className="text-blue-800 font-medium text-xs leading-relaxed">
                  {aiCoaching.encouragement}
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-anton font-black text-gray-900 mb-2">Focus Areas:</h4>
                {aiCoaching.cues.map((cue, index) => (
                  <div key={index} className="bg-white rounded-2xl p-3 border border-gray-200">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs font-bold">{index + 1}</span>
                      </div>
                      <div>
                        <h5 className="font-bold text-gray-900 mb-1">{cue}</h5>
                        <p className="text-gray-600 text-xs leading-relaxed">
                          {aiCoaching.explanations[index]}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Recommended Drill */}
          {drill && (
            <Card className="p-6 rounded-3xl border-l-4 border-green-500">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-500 rounded-2xl flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-anton font-black text-gray-900">Practice Drill</h3>
                  <p className="text-sm text-gray-600">Recommended for you</p>
                </div>
              </div>
              
              <div className="bg-green-50 rounded-2xl p-4">
                <h4 className="font-bold text-green-900 mb-2">{drill.name}</h4>
                {drill.how_to && (
                  <p className="text-green-800 text-sm leading-relaxed mb-2">{drill.how_to}</p>
                )}
                {drill.equipment && (
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-green-600" />
                    <span className="text-green-700 text-xs font-medium">
                      Equipment: {drill.equipment}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}


          {/* Swing Metrics - Compact Version */}
          <Card className="p-4 rounded-3xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-purple-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <h3 className="text-base font-anton font-black text-gray-900">Your Numbers</h3>
            </div>
            
            {metrics.length === 0 ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-gray-200 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-600 text-sm">No metrics available for this swing</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(metricSpecs).map(([metricKey]) => {
                  const metric = metrics.find(m => m.metric === metricKey);
                  const displayName = metricDisplayNames()[metricKey] || metricKey.replace(/_/g, ' ');
                  const value = metric?.value;
                  const unit = metric?.unit || '';
                  
                  if (value === null || value === undefined) return null;
                  
                  const status = getMetricStatus(metricKey, value);
                  
                  return (
                    <div key={metricKey} className="bg-white rounded-xl p-3 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 text-sm">{displayName}</h4>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-lg font-anton font-black text-gray-900">
                              {value.toFixed(1)}{unit}
                            </span>
                            <span className="text-xs text-gray-500">
                              Target: {formatTargetRange(metricKey)}
                            </span>
                          </div>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`${status.color} border-current rounded-full text-xs ml-2`}
                        >
                          {status.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3 pb-6">
            <Button 
              onClick={() => navigate('/analysis')} 
              className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg"
            >
              Record Another Swing
            </Button>
            <Button 
              onClick={() => navigate('/')} 
              variant="outline" 
              className="w-full h-12 rounded-2xl border-2"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}