import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, ArrowRight, ArrowLeft, Target, AlertTriangle, Share2, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackCapture } from '@/lib/analytics';
import { metricSpecs } from '@/config/phase1_metrics';
import { toast } from 'sonner';
import { format, subDays, startOfWeek, endOfWeek, isWithinInterval, isSameDay } from 'date-fns';

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
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // Handle scroll for sticky header
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

      const { data: swingsData, error: swingsError } = await query;

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

  // Calculate stats
  const stats = useMemo(() => {
    const scores = swings
      .filter(s => s.score_phase1 !== null)
      .map(s => s.score_phase1 as number);
    
    if (scores.length === 0) return { latest: 0, average: 0, best: 0 };
    
    return {
      latest: scores[0] || 0,
      average: Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length),
      best: Math.max(...scores)
    };
  }, [swings]);

  // Calculate weekly breakdown
  const weeklyData = useMemo(() => {
    const now = new Date();
    const weeks = [
      { name: 'This Week', start: startOfWeek(now), end: endOfWeek(now) },
      { name: 'Last Week', start: startOfWeek(subDays(now, 7)), end: endOfWeek(subDays(now, 7)) },
      { name: '2 Weeks Ago', start: startOfWeek(subDays(now, 14)), end: endOfWeek(subDays(now, 14)) },
    ];

    return weeks.map(week => {
      const weekSwings = swings.filter(s => {
        if (!s.created_at) return false;
        const date = new Date(s.created_at);
        return isWithinInterval(date, { start: week.start, end: week.end });
      });

      const scores = weekSwings
        .filter(s => s.score_phase1 !== null)
        .map(s => s.score_phase1 as number);

      const avgScore = scores.length > 0 
        ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
        : 0;

      return {
        ...week,
        swingCount: weekSwings.length,
        avgScore,
      };
    });
  }, [swings]);

  // Calculate improving metrics
  const chartData = useMemo(() => {
    if (!swings.length) return { 
      scoreSeries: [], 
      allMetricsSeries: {},
      averages: {}
    };

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
      
      if (series.length > 0) {
        const values = series.slice(-10).map(point => point.value);
        averages[metric] = values.reduce((sum, val) => sum + val, 0) / values.length;
      }
    });

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
          
          const isImproving = spec && 'invert' in spec && spec.invert 
            ? recentAvg < olderAvg
            : recentAvg > olderAvg;
            
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

  // Activity heatmap data (last 30 days)
  const heatmapData = useMemo(() => {
    const days = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = subDays(now, i);
      const daySwings = swings.filter(s => {
        if (!s.created_at) return false;
        return isSameDay(new Date(s.created_at), date);
      });
      
      days.push({
        date,
        count: daySwings.length,
        day: format(date, 'EEE')[0], // First letter of day
      });
    }
    
    return days;
  }, [swings]);

  const handleShare = () => {
    toast.success("Share feature coming soon!");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 text-white safe-area-top">
          <div className="container mx-auto px-4 py-4 max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-8 w-8 rounded-lg bg-white/20" />
              <Skeleton className="h-6 w-24 bg-white/20" />
              <Skeleton className="h-8 w-8 rounded-lg bg-white/20" />
            </div>
            <div className="flex justify-center gap-2 pb-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-9 w-20 rounded-lg bg-white/20" />
              ))}
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-6 text-center max-w-md">
          <h3 className="text-lg font-black mb-2">Error Loading Progress</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadProgressData}>Try Again</Button>
        </Card>
      </div>
    );
  }

  if (!swings.length) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 text-white safe-area-top">
          <div className="container mx-auto px-4 py-4 max-w-2xl">
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-black">Progress</h1>
              <div className="w-8" />
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <Card className="p-8 text-center rounded-3xl">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-2xl font-black mb-3">Record more swings to see your progress here</h3>
            <p className="text-muted-foreground mb-6 text-lg">
              Start tracking your improvement and see detailed metrics over time.
            </p>
            <Button onClick={() => navigate('/analysis')} size="lg">
              Record Your First Swing
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const getScoreGradient = (score: number) => {
    if (score >= 60) return 'bg-gradient-to-br from-green-400 to-green-600';
    if (score >= 40) return 'bg-gradient-to-br from-orange-400 to-orange-600';
    return 'bg-gradient-to-br from-red-400 to-red-600';
  };

  return (
    <div className="min-h-screen bg-background pb-safe">
      {/* Sticky Header */}
      <div 
        className={`sticky top-0 z-50 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 text-white safe-area-top transition-all duration-300 ${
          isScrolled ? 'shadow-lg' : ''
        }`}
      >
        <div className="container mx-auto px-4 py-4 max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/')}
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-black">Progress</h1>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleShare}
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          </div>

          {/* Time Filter Tabs */}
          <div className="flex justify-center gap-2 pb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTimeFilter('week')}
              className={`text-sm px-4 ${
                timeFilter === 'week' 
                  ? 'bg-white/20 text-white' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              Week
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTimeFilter('month')}
              className={`text-sm px-4 ${
                timeFilter === 'month' 
                  ? 'bg-white/20 text-white' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              Month
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTimeFilter('all')}
              className={`text-sm px-4 ${
                timeFilter === 'all' 
                  ? 'bg-white/20 text-white' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              All
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="space-y-6">
          {/* Score Trend Header */}
          <div>
            <h2 className="text-2xl font-black mb-4">Score Trend</h2>
            
            {/* SUMMARY STATS ROW */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <Card className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-500 mb-1">Latest</div>
                <div className="text-3xl font-black text-gray-900">{stats.latest}</div>
              </Card>
              <Card className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-500 mb-1">Average</div>
                <div className="text-3xl font-black text-gray-900">{stats.average}</div>
              </Card>
              <Card className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="text-xs text-gray-500 mb-1">Best</div>
                <div className="text-3xl font-black text-green-600">{stats.best}</div>
              </Card>
            </div>
          </div>

          {/* RECENT SWINGS TIMELINE */}
          <Card className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg">Recent Swings</h3>
              <span className="text-sm text-gray-500">Last {Math.min(swings.length, 8)} swings</span>
            </div>

            <div className="space-y-3">
              {swings.slice(0, 8).map((swing, index) => {
                const score = swing.score_phase1 || 0;
                const date = swing.created_at ? format(new Date(swing.created_at), 'MMM d') : 'Unknown';
                
                return (
                  <div 
                    key={swing.id}
                    className="flex items-center gap-4 cursor-pointer active:scale-98 transition-transform"
                    onClick={() => navigate(`/swing/${swing.id}`)}
                  >
                    {/* Score Circle */}
                    <div className={`relative w-14 h-14 rounded-full ${getScoreGradient(score)} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <span className="text-white font-black text-lg">{score}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 mb-1">{date}</div>
                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${score >= 60 ? 'bg-red-500' : score >= 40 ? 'bg-orange-500' : 'bg-red-500'}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                    </div>

                    {/* Latest Badge and Chevron */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {index === 0 && (
                        <Badge className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 hover:bg-blue-100">
                          Latest
                        </Badge>
                      )}
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                );
              })}
            </div>

            {swings.length > 8 && (
              <div className="mt-4 text-center">
                <button 
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  onClick={() => navigate('/recent-swings')}
                >
                  View All Swings →
                </button>
              </div>
            )}
          </Card>

          {/* WEEKLY BREAKDOWN */}
          <div>
            <h3 className="font-black text-2xl mb-4">Weekly Breakdown</h3>
            <div className="space-y-3">
              {weeklyData.map((week, index) => {
                const prevWeek = weeklyData[index + 1];
                const trend = prevWeek && week.avgScore > prevWeek.avgScore ? 'up' : 'down';
                
                return (
                  <Card key={week.name} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-base font-black text-gray-900">{week.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{week.swingCount} swings</div>
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-black text-gray-900">{week.avgScore}</div>
                        {week.swingCount > 0 && prevWeek && prevWeek.swingCount > 0 && (
                          <div className={`flex items-center justify-end gap-1 text-xs ${trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                            {trend === 'up' ? '↗' : '↘'} avg score
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Horizontal Blue Bars */}
                    <div className="flex gap-1.5 mt-3">
                      {[...Array(Math.min(week.swingCount, 12))].map((_, i) => (
                        <div key={i} className="h-1.5 flex-1 bg-blue-500 rounded-full" />
                      ))}
                      {week.swingCount > 12 && (
                        <span className="text-xs text-gray-500 ml-1">+{week.swingCount - 12}</span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* ACTIVITY HEATMAP */}
          <Card className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-black text-2xl mb-2">Activity</h3>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-500">Last 30 Days</div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-gray-200" />
                  <span>No swings</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-green-600" />
                  <span>Active</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-2.5">
              {heatmapData.map((day, i) => {
                const getColor = (count: number) => {
                  if (count === 0) return 'bg-gray-200';
                  if (count === 1) return 'bg-green-300';
                  if (count === 2) return 'bg-green-500';
                  return 'bg-green-600';
                };

                return (
                  <div 
                    key={i} 
                    className={`aspect-square rounded-xl ${getColor(day.count)}`}
                    title={`${format(day.date, 'MMM d')}: ${day.count} swings`}
                  />
                );
              })}
            </div>
          </Card>

          {/* PROGRESS OVERVIEW */}
          <Card className="relative overflow-hidden rounded-3xl shadow-lg border-0">
            <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-sm opacity-90 mb-1">Progress Overview</div>
                  <h3 className="text-3xl font-black">Last 50 Swings</h3>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-black">{stats.latest}</div>
                  <div className="text-sm opacity-90">Current</div>
                </div>
              </div>

              {/* Simple Line Chart */}
              <div className="relative h-32 mb-6">
                <svg className="w-full h-full" viewBox="0 0 500 120" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.8)" />
                    </linearGradient>
                    <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.2)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                  </defs>
                  
                  {(() => {
                    const data = chartData.scoreSeries.slice(-50);
                    if (data.length < 2) return null;
                    
                    const maxScore = Math.max(...data.map(d => d.value), 100);
                    const points = data.map((point, i) => {
                      const x = (i / (data.length - 1)) * 500;
                      const y = 120 - ((point.value / maxScore) * 100);
                      return `${x},${y}`;
                    }).join(' ');
                    
                    const areaPoints = `0,120 ${points} 500,120`;
                    
                    return (
                      <>
                        <polyline
                          points={areaPoints}
                          fill="url(#areaGradient)"
                        />
                        <polyline
                          points={points}
                          fill="none"
                          stroke="url(#lineGradient)"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-xs opacity-75 mb-1">Avg</div>
                  <div className="text-2xl font-black">{chartData.averages['score']?.toFixed(1) || '—'}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-xs opacity-75 mb-1">Best</div>
                  <div className="text-2xl font-black">{stats.best}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <div className="text-xs opacity-75 mb-1">Total</div>
                  <div className="text-2xl font-black">{swings.length}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* IMPROVING & FOCUS AREAS - Moved after Progress Overview */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <span className="text-green-700 font-black text-sm">Improving</span>
              </div>
              <div className="text-5xl font-black text-green-800 mb-1">{improvingMetrics.improving}</div>
              <div className="text-green-600 text-sm font-medium">metrics trending up</div>
            </Card>
            
            <Card className="p-5 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <span className="text-orange-700 font-black text-sm">Focus Areas</span>
              </div>
              <div className="text-5xl font-black text-orange-800 mb-1">{improvingMetrics.needsWork}</div>
              <div className="text-orange-600 text-sm font-medium">metrics need work</div>
            </Card>
          </div>

          {/* Action Button */}
          <Button 
            onClick={() => navigate('/analysis')} 
            className="w-full shadow-lg" 
            size="lg"
          >
            <ArrowRight className="w-5 h-5 mr-2" />
            Record Another Swing
          </Button>
        </div>
      </div>

      {/* Metric Detail Modal */}
      <MetricDetailModal
        metricName={selectedMetric}
        isOpen={!!selectedMetric}
        onClose={() => setSelectedMetric(null)}
        chartData={chartData}
      />
    </div>
  );
}

// Metric Detail Modal Component
interface MetricDetailModalProps {
  metricName: string | null;
  isOpen: boolean;
  onClose: () => void;
  chartData: {
    scoreSeries: ChartPoint[];
    allMetricsSeries: Record<string, ChartPoint[]>;
    averages: Record<string, number>;
  };
}

function MetricDetailModal({ metricName, isOpen, onClose, chartData }: MetricDetailModalProps) {
  if (!metricName) return null;

  const series = chartData.allMetricsSeries[metricName] || [];
  const average = chartData.averages[metricName];

  const metricInfo: Record<string, { title: string; description: string; targetRange: string }> = {
    'hip_shoulder_sep_deg': {
      title: 'Hip-Shoulder Separation',
      description: 'Angle between shoulder and hip rotation at launch',
      targetRange: '15-35°'
    },
    'attack_angle_deg': {
      title: 'Attack Angle',
      description: 'Bat path angle through the hitting zone',
      targetRange: '5-20°'
    },
    'head_drift_cm': {
      title: 'Head Drift',
      description: 'Head movement during the swing',
      targetRange: '0-6 cm'
    },
    'contact_timing_frames': {
      title: 'Contact Timing',
      description: 'Timing relative to optimal swing sequence',
      targetRange: '-3 to +3'
    },
    'bat_lag_deg': {
      title: 'Bat Lag',
      description: 'Angle between bat and lead arm at launch',
      targetRange: '50-70°'
    },
    'torso_tilt_deg': {
      title: 'Torso Tilt',
      description: 'Forward lean of torso at contact',
      targetRange: '20-35°'
    },
    'finish_balance_idx': {
      title: 'Finish Balance',
      description: 'Balance stability at swing finish',
      targetRange: '0.0-0.3'
    }
  };

  const info = metricInfo[metricName];
  if (!info) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-black text-xl">{info.title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{info.description}</p>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">Average</div>
            <div className="text-3xl font-black">{average?.toFixed(1) || '—'}</div>
            <div className="text-xs text-gray-500 mt-2">
              <Target className="w-3 h-3 inline mr-1" />
              Target: {info.targetRange}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Last 10 Swings</div>
            <div className="flex gap-1">
              {series.slice(-10).map((point, i) => (
                <div 
                  key={i}
                  className="flex-1 bg-blue-500 rounded-t-lg"
                  style={{ 
                    height: `${Math.max((point.value / 100) * 100, 10)}px`,
                    opacity: 0.5 + (i * 0.05)
                  }}
                  title={point.value.toFixed(1)}
                />
              ))}
            </div>
          </div>

          <Button onClick={onClose} className="w-full">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
