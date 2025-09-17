import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, TrendingUp, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackCapture } from '@/lib/analytics';

interface Swing {
  id: string;
  created_at: string;
  score_phase1: number | null;
  cues: string[] | null;
  drill_id: string | null;
}

interface SwingMetric {
  swing_id: string;
  metric: string;
  value: number;
  unit: string;
}

interface ChartPoint {
  t: number;
  value: number;
}

export default function Progress() {
  const navigate = useNavigate();
  const [swings, setSwings] = useState<Swing[]>([]);
  const [metrics, setMetrics] = useState<SwingMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadProgressData();
  }, []);

  const loadProgressData = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Fetch recent swings
      const { data: swingsData, error: swingsError } = await supabase
        .from('swings')
        .select('id, created_at, score_phase1, cues, drill_id')
        .order('created_at', { ascending: false })
        .limit(10);

      if (swingsError) throw swingsError;
      const processedSwings = (swingsData || []).map(swing => ({
        ...swing,
        cues: Array.isArray(swing.cues) ? swing.cues.filter((cue): cue is string => typeof cue === 'string') : 
              swing.cues ? [String(swing.cues)] : null
      }));
      setSwings(processedSwings);

      if (swingsData && swingsData.length > 0) {
        // Fetch metrics for those swings
        const swingIds = swingsData.map(s => s.id);
        const { data: metricsData, error: metricsError } = await supabase
          .from('swing_metrics')
          .select('swing_id, metric, value, unit')
          .in('swing_id', swingIds)
          .eq('phase', 1);

        if (metricsError) throw metricsError;
        setMetrics(metricsData || []);

        // Analytics
        trackCapture.progressViewed(processedSwings.length);
      }

    } catch (err) {
      console.error('Failed to load progress data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  // Memoized chart data (oldest to newest for trends)
  const chartData = useMemo(() => {
    if (!swings.length) return { scoreSeries: [], attackSeries: [], headDriftSeries: [], sepSeries: [] };

    // Reverse for chronological order (oldest → newest)
    const chronologicalSwings = [...swings].reverse();
    
    const scoreSeries: ChartPoint[] = chronologicalSwings
      .map((swing, index) => ({
        t: index,
        value: swing.score_phase1 || 0
      }))
      .filter(point => point.value > 0);

    const getMetricSeries = (metricName: string): ChartPoint[] => {
      return chronologicalSwings
        .map((swing, index) => {
          const metric = metrics.find(m => m.swing_id === swing.id && m.metric === metricName);
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
  }, [swings, metrics]);

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

  const handleSwingTap = (swingId: string) => {
    navigate(`/swing/${swingId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <h1 className="text-2xl font-bold mb-6">Progress</h1>
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
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-6 text-center max-w-md">
          <h3 className="text-lg font-semibold mb-2">Error Loading Progress</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadProgressData}>Try Again</Button>
        </Card>
      </div>
    );
  }

  if (!swings.length) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <h1 className="text-2xl font-bold mb-6">Progress</h1>
          <Card className="p-8 text-center">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Swings Yet</h3>
            <p className="text-muted-foreground mb-4">
              Record your first swing to start tracking your progress and see improvement over time.
            </p>
            <Button onClick={() => navigate('/analysis')}>
              Record Your First Swing
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const latestScore = swings[0]?.score_phase1;
  const getLatestMetricValue = (metricName: string) => {
    const latestSwingMetric = metrics.find(m => 
      m.swing_id === swings[0]?.id && m.metric === metricName
    );
    return latestSwingMetric?.value;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Progress</h1>

        <div className="space-y-6">
          {/* Score Trend Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Score Trend</h3>
                <p className="text-sm text-muted-foreground">Last {swings.length} swings</p>
              </div>
              {latestScore && (
                <Badge 
                  className={`text-white ${getScoreColor(latestScore)}`}
                >
                  {latestScore}
                </Badge>
              )}
            </div>
            <LineChart data={chartData.scoreSeries} height={80} />
          </Card>

          {/* Sparklines Row */}
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

          {/* Recent Swings List */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Recent Swings</h3>
            <div className="space-y-2">
              {swings.map((swing) => {
                const date = new Date(swing.created_at);
                const topCue = swing.cues?.[0];
                
                return (
                  <div
                    key={swing.id}
                    onClick={() => handleSwingTap(swing.id)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
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

          {/* Action Button */}
          <Button 
            onClick={() => navigate('/analysis')} 
            className="w-full" 
            size="lg"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Record Another Swing
          </Button>
        </div>
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
  const valueRange = maxValue - minValue || 1; // Prevent division by zero
  
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