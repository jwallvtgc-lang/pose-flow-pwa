import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TrendingUp, ArrowRight, ArrowLeft, Target, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackCapture } from '@/lib/analytics';
import { metricSpecs } from '@/config/phase1_metrics';

type TimeFilter = 'week' | 'month' | 'all';

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
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  useEffect(() => {
    loadProgressData();
  }, [timeFilter]);

  const loadProgressData = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Calculate date filter
      const now = new Date();
      let dateFilter: string | null = null;
      
      if (timeFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = weekAgo.toISOString();
      } else if (timeFilter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFilter = monthAgo.toISOString();
      }

      // Fetch swings with date filter
      let query = supabase
        .from('swings')
        .select('id, created_at, score_phase1, cues, drill_id')
        .order('created_at', { ascending: false });

      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      } else {
        query = query.limit(50); // Limit for 'all' to avoid performance issues
      }

      console.log('Progress query filter:', timeFilter, 'dateFilter:', dateFilter);
      const { data: swingsData, error: swingsError } = await query;

      console.log('Raw swings data returned:', swingsData?.length || 0, 'swings');
      console.log('Swings error:', swingsError);

      if (swingsError) throw swingsError;
      const processedSwings = (swingsData || []).map(swing => ({
        ...swing,
        created_at: swing.created_at || '',
        cues: Array.isArray(swing.cues) ? swing.cues.filter((cue): cue is string => typeof cue === 'string') : 
              swing.cues ? [String(swing.cues)] : null
      })) as Swing[];
      
      console.log('Processed swings:', processedSwings.length);
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
              onClick={() => navigate('/')}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-anton font-black">Progress</h1>
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
          <h3 className="text-lg font-anton font-black mb-2">Error Loading Progress</h3>
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
              onClick={() => navigate('/')}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-anton font-black">Progress</h1>
          </div>
          <Card className="p-8 text-center">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-anton font-black mb-2">No Swings Yet</h3>
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
              onClick={() => navigate('/')}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-anton font-black">Progress</h1>
          </div>

          {/* Time Filter Buttons */}
          <div className="flex justify-center mb-6">
            <div className="bg-muted rounded-lg p-1 flex gap-1">
              <Button
                variant={timeFilter === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeFilter('week')}
                className="text-sm px-4"
              >
                Week
              </Button>
              <Button
                variant={timeFilter === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeFilter('month')}
                className="text-sm px-4"
              >
                Month
              </Button>
              <Button
                variant={timeFilter === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeFilter('all')}
                className="text-sm px-4"
              >
                All
              </Button>
            </div>
          </div>

        <div className="space-y-6">
          {/* Score Trend Card - Blue Gradient */}
          <Card className="relative p-6 overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-anton font-black">Score Trend</h3>
                <p className="text-blue-100 text-sm">
                  Last {chartData.scoreSeries.length} swings • Avg: {chartData.averages['score']?.toFixed(1) || '—'}
                </p>
              </div>
              {latestScore && (
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-2xl font-anton font-black">{latestScore}</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Trend Line Visualization */}
            <div className="mb-4">
              <ScoreBarChart data={chartData.scoreSeries} />
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
                <span className="text-green-700 font-anton font-black text-sm">Improving</span>
              </div>
              <div className="text-2xl font-anton font-black text-green-800">{improvingMetrics.improving}</div>
              <div className="text-green-600 text-xs">metrics trending up</div>
            </Card>
            
            <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <span className="text-orange-700 font-anton font-black text-sm">Focus Areas</span>
              </div>
              <div className="text-2xl font-anton font-black text-orange-800">{improvingMetrics.needsWork}</div>
              <div className="text-orange-600 text-xs">metrics need work</div>
            </Card>
          </div>

          {/* Swing Metrics Section */}
          <div>
            <h3 className="text-lg font-anton font-black mb-4">Swing Metrics</h3>
            <div className="space-y-4">
              <DetailedMetricCard
                title="Hip-Shoulder Separation"
                description="The angle between shoulder and hip rotation at launch. More separation creates power."
                average={chartData.averages['hip_shoulder_sep_deg']}
                unit="deg"
                targetRange="15-35°"
                chartData={chartData}
              />
              
              <DetailedMetricCard
                title="Attack Angle"
                description="The angle of the bat path through the hitting zone. Slight upward angle is ideal."
                average={chartData.averages['attack_angle_deg']}
                unit="deg"
                targetRange="5-20°"
                chartData={chartData}
              />
              
              <DetailedMetricCard
                title="Head Drift"
                description="How much the head moves during the swing. Less movement improves consistency."
                average={chartData.averages['head_drift_cm']}
                unit="cm"
                targetRange="0-6 cm (lower is better)"
                chartData={chartData}
              />
              
              <DetailedMetricCard
                title="Contact Timing"
                description="How well-timed contact is relative to optimal swing sequence."
                average={chartData.averages['contact_timing_frames']}
                unit="frames"
                targetRange="-3 to +3"
                chartData={chartData}
              />
              
              <DetailedMetricCard
                title="Bat Lag"
                description="The angle between the bat and lead arm at launch. Proper lag creates whip action."
                average={chartData.averages['bat_lag_deg']}
                unit="deg"
                targetRange="50-70°"
                chartData={chartData}
              />
              
              <DetailedMetricCard
                title="Torso Tilt"
                description="The forward lean of the torso at contact. Proper tilt helps attack angle."
                average={chartData.averages['torso_tilt_deg']}
                unit="deg"
                targetRange="20-35°"
                chartData={chartData}
              />
              
              <DetailedMetricCard
                title="Finish Balance"
                description="Balance stability at swing finish. Lower values indicate better control and stability."
                average={chartData.averages['finish_balance_idx']}
                unit="index"
                targetRange="0.0-0.3 (lower is better)"
                chartData={chartData}
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

// Enhanced Score Bar Chart Component - Shows all available swings
function ScoreBarChart({ data }: { data: ChartPoint[] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-20">
        <span className="text-blue-200 text-sm">No score data available</span>
      </div>
    );
  }

  // Show all available swings (no artificial limit)
  const recentScores = data;
  const average = recentScores.reduce((sum, point) => sum + point.value, 0) / recentScores.length;
  
  // Fixed scale from 0-100 for consistency
  const chartMin = 0;
  const chartMax = 100;
  const maxBarHeight = 80;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500 border-green-600';
    if (score >= 60) return 'bg-yellow-500 border-yellow-600';
    if (score >= 40) return 'bg-orange-500 border-orange-600';
    return 'bg-red-500 border-red-600';
  };

  const getPerformanceLevel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  };

  return (
    <div className="space-y-3">
      {/* Chart Container with Y-axis */}
      <div className="relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-blue-200 pr-2" style={{ width: '30px' }}>
          <span>100</span>
          <span>75</span>
          <span>50</span>
          <span>25</span>
          <span>0</span>
        </div>
        
        {/* Average line */}
        <div 
          className="absolute left-8 right-0 border-t border-dashed border-blue-300 z-10"
          style={{ 
            top: `${maxBarHeight - ((average - chartMin) / (chartMax - chartMin)) * maxBarHeight + 10}px`
          }}
        >
          <span className="absolute -top-4 right-0 text-xs text-blue-200 bg-blue-600/80 px-2 py-1 rounded text-white">
            Avg: {average.toFixed(0)}
          </span>
        </div>

        {/* Bar Chart */}
        <div 
          className="ml-8 flex items-end gap-0.5 bg-white/10 rounded p-3 overflow-x-auto" 
          style={{ height: `${maxBarHeight + 20}px` }}
        >
          {recentScores.map((point, index) => {
            // Ensure bars have proper height (minimum 2px for visibility)
            const barHeight = Math.max(
              ((point.value - chartMin) / (chartMax - chartMin)) * maxBarHeight,
              2
            );
            
            const isLatest = index === recentScores.length - 1;
            const swingNumber = recentScores.length - index; // Reverse numbering (most recent = 1)
            
            return (
              <div 
                key={`bar-${point.t}-${index}`} 
                className="flex flex-col items-center group relative"
                style={{ 
                  minWidth: recentScores.length > 30 ? '10px' : recentScores.length > 20 ? '14px' : '18px',
                  flex: '0 0 auto' 
                }}
              >
                {/* Tooltip on hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-16 left-1/2 transform -translate-x-1/2 z-20">
                  <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
                    <div className="font-medium">Swing #{swingNumber}</div>
                    <div>Score: {point.value}</div>
                    <div className="text-gray-300">{getPerformanceLevel(point.value)}</div>
                  </div>
                </div>
                
                {/* Score value above bar */}
                {(isLatest || recentScores.length <= 10) && (
                  <div className="text-xs text-white font-medium mb-1" style={{ marginBottom: '2px' }}>
                    {point.value}
                  </div>
                )}
                
                {/* Bar */}
                <div 
                  className={`w-full rounded-t-sm transition-all duration-300 ${
                    isLatest 
                      ? 'ring-2 ring-white/50 ' + getScoreColor(point.value).replace('border-', 'shadow-lg shadow-')
                      : getScoreColor(point.value).split(' ')[0] + ' opacity-90'
                  } hover:opacity-100 hover:scale-105`}
                  style={{ 
                    height: `${Math.round(barHeight)}px`,
                    minHeight: '2px'
                  }}
                />
                
                {/* Swing number */}
                <div className={`text-xs mt-1 ${isLatest ? 'text-white font-bold' : 'text-blue-200'}`}>
                  {swingNumber <= 5 || swingNumber % 5 === 0 || isLatest ? swingNumber : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Enhanced Legend and Stats */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded border border-green-600"></div>
              <span className="text-blue-200">80+ Excellent</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-500 rounded border border-yellow-600"></div>
              <span className="text-blue-200">60+ Good</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-orange-500 rounded border border-orange-600"></div>
              <span className="text-blue-200">40+ Fair</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded border border-red-600"></div>
              <span className="text-blue-200">&lt;40 Needs Work</span>
            </div>
          </div>
          <div className="text-blue-200">
            <span className="font-medium">Latest swing highlighted</span>
          </div>
        </div>
        <div className="text-center text-xs text-blue-200">
          Numbers show most recent swings (1 = latest, {recentScores.length} = oldest shown)
        </div>
      </div>
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
  chartData: {
    scoreSeries: ChartPoint[];
    allMetricsSeries: Record<string, ChartPoint[]>;
    averages: Record<string, number>;
  };
}

function DetailedMetricCard({ title, description, average, unit, targetRange, chartData }: DetailedMetricCardProps) {
  // Get the metric name from title
  const getMetricName = (title: string): string => {
    const titleToMetric: Record<string, string> = {
      "Hip-Shoulder Separation": "hip_shoulder_sep_deg",
      "Attack Angle": "attack_angle_deg", 
      "Head Drift": "head_drift_cm",
      "Contact Timing": "contact_timing_frames",
      "Bat Lag": "bat_lag_deg",
      "Torso Tilt": "torso_tilt_deg",
      "Finish Balance": "finish_balance_idx"
    };
    return titleToMetric[title] || '';
  };

  const metricName = getMetricName(title);
  const metricData = chartData.allMetricsSeries[metricName] || [];
  const lastSevenValues = metricData.slice(-7);

  const isInTargetRange = (value: number, title: string): boolean => {
    switch (title) {
      case "Head Drift": return value <= 6;
      case "Attack Angle": return value >= 5 && value <= 20;
      case "Hip-Shoulder Separation": return value >= 15 && value <= 35;
      case "Contact Timing": return value >= -3 && value <= 3;
      case "Bat Lag": return value >= 50 && value <= 70;
      case "Torso Tilt": return value >= 20 && value <= 35;
      case "Finish Balance": return value <= 0.3;
      default: return false;
    }
  };
  
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-anton font-black text-base mb-1">{title}</h4>
          <p className="text-sm text-muted-foreground mb-3">{description}</p>
        </div>
        <div className="text-right ml-4">
          <div className="text-lg font-anton font-black">
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
      
      {/* Trend Bars - Last 7 swings */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground mr-2">Last 7:</span>
        {[...Array(7)].map((_, i) => {
          const dataPoint = lastSevenValues[i];
          if (!dataPoint) {
            return (
              <div 
                key={i} 
                className="h-3 flex-1 rounded bg-muted min-w-[8px]"
                title="No data"
              />
            );
          }
          
          const isGood = isInTargetRange(dataPoint.value, title);
          const intensity = Math.min(30 + (i * 10), 100); // Increasing opacity for recent swings
          
          return (
            <div 
              key={i} 
              className={`h-3 flex-1 rounded transition-all hover:scale-110 min-w-[8px] ${
                isGood ? 'bg-green-500' : 'bg-red-500'
              }`}
              style={{ opacity: intensity / 100 }}
              title={`Swing ${i + 1}: ${dataPoint.value.toFixed(1)} ${unit} (${isGood ? 'Good' : 'Needs Work'})`}
            />
          );
        })}
        
        {/* Trend Arrow */}
        <div className="ml-3 flex items-center">
          {lastSevenValues.length >= 2 && (() => {
            const recent = lastSevenValues.slice(-3).map((p: ChartPoint) => p.value);
            const older = lastSevenValues.slice(0, 3).map((p: ChartPoint) => p.value);
            if (recent.length && older.length) {
              const recentAvg = recent.reduce((a: number, b: number) => a + b, 0) / recent.length;
              const olderAvg = older.reduce((a: number, b: number) => a + b, 0) / older.length;
              
              // For metrics where lower is better, flip the comparison
              const lowerIsBetter = title === "Head Drift" || title === "Finish Balance";
              const isImproving = lowerIsBetter ? recentAvg < olderAvg : recentAvg > olderAvg;
              
              return (
                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                  isImproving ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  {isImproving ? '↗' : '↘'}
                </div>
              );
            }
            return null;
          })()}
        </div>
      </div>
    </Card>
  );
}