import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackCapture } from '@/lib/analytics';

interface Swing {
  id: string;
  created_at: string | null;
  score_phase1: number | null;
  cues: string[] | null;
  drill_id: string | null;
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
        created_at: swing.created_at || '',
        cues: Array.isArray(swing.cues) ? swing.cues.filter((cue): cue is string => typeof cue === 'string') : 
              swing.cues ? [String(swing.cues)] : null
      })) as Swing[];
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
        const processedMetrics = (metricsData || []).map(metric => ({
          swing_id: metric.swing_id || '',
          metric: metric.metric || '',
          value: metric.value || 0,
          unit: metric.unit || ''
        })) as SwingMetric[];
        setMetrics(processedMetrics);

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

  // Memoized chart data and averages (oldest to newest for trends)
  const chartData = useMemo(() => {
    if (!swings.length) return { 
      scoreSeries: [], 
      allMetricsSeries: {},
      averages: {}
    };

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

    // All available metrics
    const allMetrics = [
      'hip_shoulder_sep_deg',
      'attack_angle_deg', 
      'head_drift_cm',
      'contact_timing_frames',
      'bat_lag_deg',
      'torso_tilt_deg', 
      'stride_var_pct',
      'finish_balance_idx'
    ];

    const allMetricsSeries: Record<string, ChartPoint[]> = {};
    const averages: Record<string, number> = {};

    allMetrics.forEach(metric => {
      const series = getMetricSeries(metric);
      allMetricsSeries[metric] = series;
      
      // Calculate average for last 10 swings
      if (series.length > 0) {
        const values = series.slice(-10).map(point => point.value);
        averages[metric] = values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    });

    // Score average
    if (scoreSeries.length > 0) {
      const scoreValues = scoreSeries.slice(-10).map(point => point.value);
      averages['score'] = scoreValues.reduce((sum, val) => sum + val, 0) / scoreValues.length;
    }

    return {
      scoreSeries,
      allMetricsSeries,
      averages
    };
  }, [swings, metrics]);

  const getScoreColor = (score: number | null) => {
    if (!score) return 'bg-muted';
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
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
                <p className="text-sm text-muted-foreground">
                  Last {swings.length} swings • Avg: {chartData.averages['score']?.toFixed(1) || '—'}
                </p>
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

          {/* All Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="Hip-Shoulder Separation"
              unit="°"
              data={chartData.allMetricsSeries['hip_shoulder_sep_deg']}
              average={chartData.averages['hip_shoulder_sep_deg']}
              latestValue={getLatestMetricValue('hip_shoulder_sep_deg') || undefined}
              definition="The angle between shoulder and hip rotation at launch. More separation creates power."
            />
            
            <MetricCard
              title="Attack Angle"
              unit="°"
              data={chartData.allMetricsSeries['attack_angle_deg']}
              average={chartData.averages['attack_angle_deg']}
              latestValue={getLatestMetricValue('attack_angle_deg') || undefined}
              definition="The angle of the bat path through the hitting zone. Slight upward angle is ideal."
            />
            
            <MetricCard
              title="Head Drift"
              unit="cm"
              data={chartData.allMetricsSeries['head_drift_cm']}
              average={chartData.averages['head_drift_cm']}
              latestValue={getLatestMetricValue('head_drift_cm') || undefined}
              definition="How much the head moves during the swing. Less movement improves consistency."
            />
            
            <MetricCard
              title="Contact Timing"
              unit=" frames"
              data={chartData.allMetricsSeries['contact_timing_frames']}
              average={chartData.averages['contact_timing_frames']}
              latestValue={getLatestMetricValue('contact_timing_frames') || undefined}
              definition="How well-timed contact is relative to optimal swing sequence. 0 is perfect timing."
            />
            
            <MetricCard
              title="Bat Lag"
              unit="°"
              data={chartData.allMetricsSeries['bat_lag_deg']}
              average={chartData.averages['bat_lag_deg']}
              latestValue={getLatestMetricValue('bat_lag_deg') || undefined}
              definition="The angle between the bat and lead arm at launch. Proper lag creates whip action."
            />
            
            <MetricCard
              title="Torso Tilt"
              unit="°"
              data={chartData.allMetricsSeries['torso_tilt_deg']}
              average={chartData.averages['torso_tilt_deg']}
              latestValue={getLatestMetricValue('torso_tilt_deg') || undefined}
              definition="The forward lean of the torso at contact. Proper tilt helps attack angle."
            />
            
            <MetricCard
              title="Stride Variance"
              unit="%"
              data={chartData.allMetricsSeries['stride_var_pct']}
              average={chartData.averages['stride_var_pct']}
              latestValue={getLatestMetricValue('stride_var_pct') || undefined}
              definition="Consistency of stride length across swings. Lower variance shows better repeatability."
            />
            
            <MetricCard
              title="Finish Balance"
              unit=""
              data={chartData.allMetricsSeries['finish_balance_idx']}
              average={chartData.averages['finish_balance_idx']}
              latestValue={getLatestMetricValue('finish_balance_idx') || undefined}
              definition="How balanced the player is at swing completion. Lower values indicate better balance."
            />
          </div>


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

// Metric Card Component
interface MetricCardProps {
  title: string;
  unit: string;
  data: ChartPoint[];
  average?: number;
  latestValue?: number;
  definition?: string;
}

function MetricCard({ title, unit, data, average, latestValue, definition }: MetricCardProps) {
  return (
    <Card className="p-4">
      <div className="mb-3">
        <h4 className="text-sm font-medium">{title}</h4>
        {definition && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{definition}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">
            Latest: {latestValue?.toFixed(1) || '—'}{unit}
          </span>
          <span className="text-xs text-muted-foreground">
            Avg: {average?.toFixed(1) || '—'}{unit}
          </span>
        </div>
      </div>
      <Sparkline data={data} height={40} />
    </Card>
  );
}