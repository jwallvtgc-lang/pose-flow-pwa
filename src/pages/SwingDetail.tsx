import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Play, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackCapture } from '@/lib/analytics';
import { metricSpecs } from '@/config/phase1_metrics';
import { metricDisplayNames } from '@/lib/metrics';

interface SwingData {
  id: string;
  created_at: string;
  score_phase1: number | null;
  cues: string[] | null;
  drill_id: string | null;
  video_url: string | null;
}

interface SwingMetric {
  swing_id: string;
  metric: string;
  value: number;
  unit: string;
}

interface DrillInfo {
  id: string;
  name: string;
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

  useEffect(() => {
    if (id) {
      loadSwingDetail(id);
      trackCapture.swingDetailViewed(id);
    }
  }, [id]);

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
        cues: Array.isArray(swingData.cues) ? swingData.cues.filter((cue): cue is string => typeof cue === 'string') : 
              swingData.cues ? [String(swingData.cues)] : null
      };
      setSwing(processedSwing);

      // Fetch swing metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('swing_metrics')
        .select('swing_id, metric, value, unit')
        .eq('swing_id', swingId)
        .eq('phase', 1);

      if (metricsError) throw metricsError;
      setMetrics(metricsData || []);

      // Fetch drill info if drill_id exists
      if (processedSwing.drill_id) {
        const { data: drillData, error: drillError } = await supabase
          .from('drills')
          .select('id, name, how_to, equipment')
          .eq('id', processedSwing.drill_id)
          .single();

        if (!drillError && drillData) {
          setDrill(drillData);
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
    const spec = metricSpecs[metricName];
    if (!spec) return 0.5;

    const [min, max] = spec.target;
    let normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)));
    
    // Invert if smaller is better
    if (spec.invert) {
      normalizedValue = 1 - normalizedValue;
    }
    
    return normalizedValue;
  };

  const formatTargetRange = (metricName: string): string => {
    const spec = metricSpecs[metricName];
    if (!spec) return 'N/A';

    const [min, max] = spec.target;
    const suffix = spec.invert ? ' (lower is better)' : '';
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

  const swingDate = new Date(swing.created_at);

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
          {/* Score & Timestamp */}
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
              <div className="bg-muted rounded-lg p-4 text-center">
                <Play className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">Video available</p>
                <Button size="sm" variant="outline">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Video
                </Button>
              </div>
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
                {Object.entries(metricSpecs).map(([metricKey, spec]) => {
                  const metric = metrics.find(m => m.metric === metricKey);
                  const displayName = metricDisplayNames()[metricKey] || metricKey.replace(/_/g, ' ');
                  const value = metric?.value;
                  const unit = metric?.unit || '';
                  const progress = value !== undefined ? getMetricProgress(metricKey, value) : 0;
                  
                  return (
                    <div key={metricKey} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{displayName}</span>
                        <span className="text-sm font-mono">
                          {value !== undefined ? `${value.toFixed(1)} ${unit}` : '—'}
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
                            width: value !== undefined ? `${Math.max(5, progress * 100)}%` : '0%' 
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