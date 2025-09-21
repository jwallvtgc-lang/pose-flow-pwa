import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TrendingUp, ArrowRight, ArrowLeft, Target, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackCapture } from '@/lib/analytics';
import { metricSpecs } from '@/config/phase1_metrics';

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

  // Calculate improvement metrics
  const improvingMetrics = useMemo(() => {
    const allMetrics = Object.keys(metricSpecs);
    let improving = 0;
    let needsWork = 0;
    
    allMetrics.forEach(metricName => {
      const series = chartData.allMetricsSeries[metricName];
      if (series && series.length >= 2) {
        const recent = series.slice(-3).map(p => p.value);
        const older = series.slice(-6, -3).map(p => p.value);
        
        if (recent.length && older.length) {
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
          const spec = metricSpecs[metricName as keyof typeof metricSpecs];
          
          // Check if improving (moving toward target range)
          const isImproving = spec && 'invert' in spec && spec.invert 
            ? recentAvg < olderAvg  // Lower is better
            : recentAvg > olderAvg; // Higher is better
            
          if (isImproving) {
            improving++;
          } else {
            needsWork++;
          }
        }
      }
    });
    
    return { improving, needsWork };
  }, [chartData]);

  // Calculate score trend
  const scoreTrend = useMemo(() => {
    const scores = chartData.scoreSeries;
    if (scores && scores.length >= 2) {
      const recent = scores.slice(-3).map(p => p.value);
      const older = scores.slice(-6, -3).map(p => p.value);
      
      if (recent.length && older.length) {
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        const change = recentAvg - olderAvg;
        
        return {
          change,
          isImproving: change > 0,
          description: change > 0 ? 'Improving steadily' : 'Needs focus'
        };
      }
    }
    
    return { change: 0, isImproving: true, description: 'Getting started' };
  }, [chartData]);



  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Progress</h1>
          </div>
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
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Progress</h1>
        </div>
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

  return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">Progress</h1>
          </div>

        <div className="space-y-6">
          {/* Score Trend Card - Blue Gradient */}
          <Card className="relative p-6 overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Score Trend</h3>
                <p className="text-blue-100 text-sm">
                  Last {swings.length} swings • Avg: {chartData.averages['score']?.toFixed(1) || '—'}
                </p>
              </div>
              {latestScore && (
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-2xl font-bold">{latestScore}</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Trend Line Visualization */}
            <div className="mb-4">
              <TrendLineVisual data={chartData.scoreSeries} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-blue-100 text-sm">{scoreTrend.description}</span>
              <span className="text-blue-100 text-sm font-medium">
                {scoreTrend.change > 0 ? '+' : ''}{scoreTrend.change.toFixed(1)} points
              </span>
            </div>
          </Card>

          {/* Improving & Focus Areas Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-green-700 font-medium text-sm">Improving</span>
              </div>
              <div className="text-2xl font-bold text-green-800">{improvingMetrics.improving}</div>
              <div className="text-green-600 text-xs">metrics trending up</div>
            </Card>
            
            <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <span className="text-orange-700 font-medium text-sm">Focus Areas</span>
              </div>
              <div className="text-2xl font-bold text-orange-800">{improvingMetrics.needsWork}</div>
              <div className="text-orange-600 text-xs">metrics need work</div>
            </Card>
          </div>

          {/* Swing Metrics Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Swing Metrics</h3>
            <div className="space-y-4">
              <DetailedMetricCard
                title="Hip-Shoulder Separation"
                description="The angle between shoulder and hip rotation at launch. More separation creates power."
                average={chartData.averages['hip_shoulder_sep_deg']}
                unit="deg"
                targetRange="15-35°"
              />
              
              <DetailedMetricCard
                title="Attack Angle"
                description="The angle of the bat path through the hitting zone. Slight upward angle is ideal."
                average={chartData.averages['attack_angle_deg']}
                unit="deg"
                targetRange="5-20°"
              />
              
              <DetailedMetricCard
                title="Head Drift"
                description="How much the head moves during the swing. Less movement improves consistency."
                average={chartData.averages['head_drift_cm']}
                unit="cm"
                targetRange="0-6 cm (lower is better)"
              />
              
              <DetailedMetricCard
                title="Contact Timing"
                description="How well-timed contact is relative to optimal swing sequence."
                average={chartData.averages['contact_timing_frames']}
                unit="frames"
                targetRange="-3 to +3"
              />
              
              <DetailedMetricCard
                title="Bat Lag"
                description="The angle between the bat and lead arm at launch. Proper lag creates whip action."
                average={chartData.averages['bat_lag_deg']}
                unit="deg"
                targetRange="50-70°"
              />
              
              <DetailedMetricCard
                title="Torso Tilt"
                description="The forward lean of the torso at contact. Proper tilt helps attack angle."
                average={chartData.averages['torso_tilt_deg']}
                unit="deg"
                targetRange="20-35°"
              />
            </div>
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

// Trend Line Visual Component (simple dots for trend display)
function TrendLineVisual({ data }: { data: ChartPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-8">
        <span className="text-blue-200 text-xs">No trend data</span>
      </div>
    );
  }

  const points = data.slice(-7); // Show last 7 points
  
  return (
    <div className="flex items-center justify-between h-8">
      {points.map((_, index) => (
        <div 
          key={index} 
          className="w-3 h-3 bg-white/60 rounded-full flex-shrink-0"
        />
      ))}
    </div>
  );
}

// Detailed Metric Card Component
interface DetailedMetricCardProps {
  title: string;
  description: string;
  average?: number;
  unit: string;
  targetRange: string;
}

function DetailedMetricCard({ title, description, average, unit, targetRange }: DetailedMetricCardProps) {
  const getProgressColor = (title: string, value?: number) => {
    if (!value) return 'bg-muted';
    
    // Simple heuristic for color coding - would be better to use actual target ranges
    if (title === "Head Drift" && value < 3) return 'bg-green-500';
    if (title === "Attack Angle" && value > 0 && value < 25) return 'bg-green-500';
    if (title === "Hip-Shoulder Separation" && value > 15) return 'bg-green-500';
    return 'bg-red-500';
  };

  const progressColor = getProgressColor(title, average);
  
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-medium text-base mb-1">{title}</h4>
          <p className="text-sm text-muted-foreground mb-3">{description}</p>
        </div>
        <div className="text-right ml-4">
          <div className="text-lg font-bold">
            {average ? `${average.toFixed(1)} ${unit}` : '—'}
          </div>
        </div>
      </div>
      
      <div className="mb-3">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Target className="w-4 h-4" />
          <span>Target: {targetRange}</span>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        {[...Array(7)].map((_, i) => (
          <div 
            key={i} 
            className={`h-2 flex-1 rounded ${
              i < 4 ? progressColor : 'bg-muted'
            }`}
          />
        ))}
        <div className="bg-blue-500 h-2 w-8 rounded ml-2" />
      </div>
    </Card>
  );
}