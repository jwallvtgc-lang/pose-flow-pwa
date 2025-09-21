import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Play, Loader2, Share2, Mail, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackCapture } from '@/lib/analytics';
import { metricSpecs } from '@/config/phase1_metrics';
import { metricDisplayNames } from '@/lib/metrics';
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
  id: string;
  name: string | null;
  how_to: string | null;
  equipment: string | null;
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
      setVideoError('Failed to load video');
    } finally {
      setIsVideoLoading(false);
    }
  };

  const handleShareSwing = async () => {
    if (!shareEmail.trim()) {
      toast.error('Please enter an email address');
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
        cues: swing.cues || [],
        drill: drill ? {
          name: drill.name || '',
          instructions: drill.how_to || ''
        } : undefined
      };

      // Call the edge function
      const { error } = await supabase.functions.invoke('send-swing-details', {
        body: {
          toEmail: shareEmail.trim(),
          fromName: shareName.trim() || undefined,
          swingData,
          message: shareMessage.trim() || undefined
        }
      });

      if (error) throw error;

      toast.success('Swing details sent successfully!');
      setIsShareDialogOpen(false);
      setShareEmail('');
      setShareName('');
      setShareMessage('');
      
    } catch (err) {
      console.error('Failed to share swing:', err);
      toast.error('Failed to send swing details. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const loadSwingDetail = async (swingId: string) => {
    try {
      setIsLoading(true);
      setError('');

      // Fetch swing data
      const { data: swingData, error: swingError } = await supabase
        .from('swings')
        .select('id, created_at, score_phase1, cues, drill_id, video_url')
        .eq('id', swingId)
        .single();

      if (swingError) throw swingError;
      const processedSwing = {
        ...swingData,
        created_at: swingData.created_at || '',
        cues: Array.isArray(swingData.cues) ? swingData.cues.filter((cue): cue is string => typeof cue === 'string') : 
              swingData.cues ? [String(swingData.cues)] : null
      } as SwingData;
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

      // Fetch drill info if drill_id exists
      if (processedSwing.drill_id) {
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
      }

    } catch (err) {
      console.error('Failed to load swing detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to load swing details');
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return 'bg-muted';
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (score: number | null) => {
    if (!score) return 'N/A';
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Work';
  };

  const getMetricProgress = (metricName: string, value: number): number => {
    const spec = metricSpecs[metricName as keyof typeof metricSpecs];
    if (!spec) return 0.5;

    const [min, max] = spec.target;
    let normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));
    
    // Invert if smaller is better
    if ('invert' in spec && spec.invert) {
      normalizedValue = 1 - normalizedValue;
    }
    
    return normalizedValue;
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
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/progress')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="h-6 bg-muted rounded animate-pulse w-32"></div>
          </div>
          
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="p-6">
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/progress')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-bold">Swing Details</h1>
          </div>

          <Card className="p-6 text-center">
            <h3 className="text-lg font-semibold mb-2">
              {error ? 'Error Loading Swing' : 'Swing Not Found'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {error || 'The requested swing could not be found.'}
            </p>
            <Button onClick={() => navigate('/progress')}>
              Back to Progress
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const swingDate = swing.created_at ? new Date(swing.created_at) : new Date();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/progress')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold">Swing Details</h1>
        </div>

        <div className="space-y-6">
          {/* Score & Timestamp - Updated with Share Button */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm text-muted-foreground">
                  {swingDate.toLocaleDateString('en-US', { 
                    weekday: 'long',
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
                <div className="text-sm text-muted-foreground">
                  {swingDate.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {swing.score_phase1 && (
                  <div className="text-center">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full text-white text-2xl font-bold ${getScoreColor(swing.score_phase1)}`}>
                      {swing.score_phase1}
                    </div>
                    <Badge variant="secondary" className="mt-2">
                      {getScoreLabel(swing.score_phase1)}
                    </Badge>
                  </div>
                )}
                
                <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5" />
                        Share Swing Analysis
                      </DialogTitle>
                      <DialogDescription>
                        Send this swing analysis to a coach or friend via email.
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
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="shareMessage">Personal Message (optional)</Label>
                        <Textarea
                          id="shareMessage"
                          placeholder="Hey coach, here's my latest swing analysis..."
                          value={shareMessage}
                          onChange={(e) => setShareMessage(e.target.value)}
                          rows={3}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button 
                        variant="outline" 
                        onClick={() => setIsShareDialogOpen(false)}
                        disabled={isSending}
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleShareSwing} disabled={isSending}>
                        {isSending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Email
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </Card>

          {/* Cues */}
          {swing.cues && swing.cues.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-3">Focus Areas</h3>
              <div className="flex flex-wrap gap-2">
                {swing.cues.slice(0, 2).map((cue, index) => (
                  <Badge key={index} variant="outline" className="text-sm py-2 px-3">
                    {cue}
                  </Badge>
                ))}
              </div>
            </Card>
          )}

          {/* Drill Info */}
          {drill && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-3">Recommended Drill</h3>
              <div className="space-y-2">
                <h4 className="font-medium">{drill.name}</h4>
                {drill.how_to && (
                  <p className="text-sm text-muted-foreground">{drill.how_to}</p>
                )}
                {drill.equipment && (
                  <p className="text-xs text-muted-foreground">
                    Equipment: {drill.equipment}
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Video Playback */}
          {swing.video_url && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-3">Swing Video</h3>
              
              {!videoUrl && !isVideoLoading && !videoError && (
                <div className="bg-muted rounded-lg p-4 text-center">
                  <Play className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-3">Video available</p>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => loadVideoUrl(swing.video_url!)}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Load Video
                  </Button>
                </div>
              )}

              {isVideoLoading && (
                <div className="bg-muted rounded-lg p-8 text-center">
                  <Loader2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading video...</p>
                </div>
              )}

              {videoError && (
                <div className="bg-muted rounded-lg p-4 text-center">
                  <p className="text-sm text-red-600 mb-3">{videoError}</p>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => loadVideoUrl(swing.video_url!)}
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {videoUrl && (
                <div className="bg-black rounded-lg overflow-hidden">
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

          {/* Metrics Table */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Swing Metrics</h3>
            
            {metrics.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No metrics available for this swing
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(metricSpecs).map(([metricKey]) => {
                  const metric = metrics.find(m => m.metric === metricKey);
                  const displayName = metricDisplayNames()[metricKey] || metricKey.replace(/_/g, ' ');
                  const value = metric?.value;
                  const unit = metric?.unit || '';
                  const progress = (value !== null && value !== undefined) ? getMetricProgress(metricKey, value) : 0;
                  
                  return (
                    <div key={metricKey} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{displayName}</span>
                        <span className="text-sm font-mono">
                          {value !== null && value !== undefined ? `${value.toFixed(1)} ${unit}` : '—'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Target: {formatTargetRange(metricKey)}</span>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-300 ease-out"
                          style={{ 
                            width: (value !== null && value !== undefined) ? `${Math.max(5, progress * 100)}%` : '0%' 
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Actions */}
          <div className="space-y-3">
            <Button onClick={() => navigate('/progress')} variant="outline" className="w-full">
              Back to Progress
            </Button>
            <Button onClick={() => navigate('/analysis')} className="w-full">
              Record Another Swing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}