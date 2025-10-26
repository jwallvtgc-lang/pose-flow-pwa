import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress as ProgressBar } from '@/components/ui/progress';
import { TrendingUp, ArrowRight, ArrowLeft, Target, Share2, ChevronRight, Zap, Activity, Brain, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackCapture } from '@/lib/analytics';
import { metricSpecs } from '@/config/phase1_metrics';
import { toast } from 'sonner';
import { format, subDays, startOfWeek, endOfWeek, isWithinInterval, isSameDay } from 'date-fns';
import { Header } from '@/components/Header';

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
  const [aiInsight, setAiInsight] = useState<string>('');
  const [insightLoading, setInsightLoading] = useState(false);

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

  // Generate AI insight when data changes
  useEffect(() => {
    if (swings.length >= 3 && metrics.length > 0) {
      generateInsight();
    }
  }, [swings, metrics]);

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

  const generateInsight = async () => {
    try {
      setInsightLoading(true);
      
      // Prepare recent scores
      const recentScores = swings
        .slice(0, 10)
        .filter(s => s.score_phase1 !== null)
        .map(s => s.score_phase1 as number)
        .reverse();

      // Metric name and unit mapping
      const metricLabels: Record<string, { label: string; unit: string }> = {
        hip_shoulder_sep_deg: { label: 'Hip-Shoulder Separation', unit: '°' },
        attack_angle_deg: { label: 'Attack Angle', unit: '°' },
        head_drift_cm: { label: 'Head Drift', unit: 'cm' },
        contact_timing_frames: { label: 'Contact Timing', unit: 'frames' },
        bat_lag_deg: { label: 'Bat Lag', unit: '°' },
        torso_tilt_deg: { label: 'Torso Tilt', unit: '°' },
        stride_var_pct: { label: 'Stride Variance', unit: '%' },
        finish_balance_idx: { label: 'Finish Balance', unit: 'index' }
      };

      // Prepare metric trends
      const metricTrends = Object.keys(metricSpecs).map(metricName => {
        const series = chartData.allMetricsSeries[metricName] || [];
        const recent = series.slice(-3).map(p => p.value);
        const older = series.slice(-6, -3).map(p => p.value);
        
        if (recent.length === 0 || older.length === 0) return null;
        
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        const spec = metricSpecs[metricName as keyof typeof metricSpecs];
        
        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        const isImproving = spec && 'invert' in spec && spec.invert 
          ? recentAvg < olderAvg
          : recentAvg > olderAvg;
        
        const change = Math.abs(recentAvg - olderAvg);
        if (change > 0.1) {
          trend = isImproving ? 'improving' : 'declining';
        }
        
        const metricInfo = metricLabels[metricName] || { label: metricName, unit: '' };
        
        return {
          name: metricInfo.label,
          recentAvg,
          olderAvg,
          trend,
          unit: metricInfo.unit
        };
      }).filter((t): t is NonNullable<typeof t> => t !== null);

      const { data, error } = await supabase.functions.invoke('generate-progress-insight', {
        body: {
          recentScores,
          metricTrends,
          totalSwings: swings.length,
          timeframe: timeFilter
        }
      });

      if (error) throw error;
      
      if (data?.insight) {
        setAiInsight(data.insight);
      }
    } catch (err) {
      console.error('Failed to generate insight:', err);
      setAiInsight("Keep grinding! Consistent practice is building your skills.");
    } finally {
      setInsightLoading(false);
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

  // Calculate improving metrics (unused but kept for potential future use)
  // const improvingMetrics = useMemo(() => {
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
    
  //   return { improving, needsWork };
  // }, [chartData]);

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

  // Calculate metric comparisons for "Then vs Now" - dynamically choose top changing metrics
  const metricComparison = useMemo(() => {
    if (swings.length < 6) return null;
    
    const recentSwings = swings.slice(0, 3);
    const oldSwings = swings.slice(-3);
    
    const getAvgMetric = (swingList: Swing[], metricName: string) => {
      const values = swingList
        .map(s => {
          const metric = metrics.find(m => m.swing_id === s.id && m.metric === metricName);
          return metric?.value || null;
        })
        .filter((v): v is number => v !== null);
      
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };

    // Metric name and unit mapping
    const metricInfo: Record<string, { label: string; unit: string }> = {
      hip_shoulder_sep_deg: { label: 'Hip-Shoulder Sep', unit: '°' },
      attack_angle_deg: { label: 'Attack Angle', unit: '°' },
      head_drift_cm: { label: 'Head Drift', unit: 'cm' },
      contact_timing_frames: { label: 'Contact Timing', unit: 'frames' },
      bat_lag_deg: { label: 'Bat Lag', unit: '°' },
      torso_tilt_deg: { label: 'Torso Tilt', unit: '°' },
      stride_var_pct: { label: 'Stride Variance', unit: '%' },
      finish_balance_idx: { label: 'Finish Balance', unit: 'index' }
    };

    // Calculate all metric changes
    const allChanges = Object.keys(metricSpecs).map(metricName => {
      const recent = getAvgMetric(recentSwings, metricName);
      const old = getAvgMetric(oldSwings, metricName);
      const spec = metricSpecs[metricName as keyof typeof metricSpecs];
      const info = metricInfo[metricName];
      
      if (recent === null || old === null || !info) return null;
      
      const change = Math.abs(recent - old);
      const isImproving = spec && 'invert' in spec && spec.invert 
        ? recent < old
        : recent > old;
      
      return {
        key: metricName,
        recent,
        old,
        change,
        label: info.label,
        unit: info.unit,
        invert: spec && 'invert' in spec ? spec.invert : false,
        isImproving
      };
    }).filter((m): m is NonNullable<typeof m> => m !== null && m.change > 0);

    // Sort by biggest change and take top 3
    const topChanges = allChanges
      .sort((a, b) => b.change - a.change)
      .slice(0, 3);

    if (topChanges.length === 0) return null;

    // Convert to object format for display
    const result: Record<string, any> = {};
    topChanges.forEach((metric, index) => {
      result[`metric_${index}`] = {
        recent: metric.recent,
        old: metric.old,
        label: metric.label,
        unit: metric.unit,
        invert: metric.invert,
        isImproving: metric.isImproving
      };
    });

    return result;
  }, [swings, metrics]);

  // Helper function for score colors
  const getScoreColor = (score: number) => {
    if (score >= 60) return 'text-emerald-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const handleShare = () => {
    toast.success("Share feature coming soon!");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black">
        <div className="bg-gradient-to-b from-[#0F172A] to-black text-white safe-area-top">
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
              <Skeleton key={i} className="h-24 w-full rounded-2xl bg-white/5" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black flex items-center justify-center">
        <Card className="p-6 text-center max-w-md bg-white/5 border-white/10 text-white">
          <h3 className="text-lg font-black mb-2">Error Loading Progress</h3>
          <p className="text-white/60 mb-4">{error}</p>
          <Button onClick={loadProgressData} className="bg-emerald-500 hover:bg-emerald-600">Try Again</Button>
        </Card>
      </div>
    );
  }

  if (!swings.length) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black">
        <div className="bg-gradient-to-b from-[#0F172A] to-black text-white safe-area-top">
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
          <Card className="p-8 text-center rounded-3xl bg-white/5 border-white/10 text-white shadow-[0_0_30px_rgba(16,185,129,0.1)]">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
              <TrendingUp className="w-12 h-12 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-black mb-3">Record more swings to see your progress here</h3>
            <p className="text-white/60 mb-6 text-lg">
              Start tracking your improvement and see detailed metrics over time.
            </p>
            <Button onClick={() => navigate('/analysis')} size="lg" className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white">
              Record Your First Swing
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black pb-28">
      {/* Sticky Header */}
      <div 
        className={`sticky top-0 z-50 bg-gradient-to-b from-[#0F172A]/95 to-black/95 backdrop-blur-xl text-white safe-area-top transition-all duration-300 border-b border-white/10 ${
          isScrolled ? 'shadow-[0_4px_20px_rgba(16,185,129,0.1)]' : ''
        }`}
      >
        <div className="container mx-auto px-4 py-4 max-w-2xl">
          <Header 
            leftAction={
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            }
            rightAction={
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleShare}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            }
          />

          {/* Time Filter Tabs */}
          <div className="flex justify-center gap-2 pb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTimeFilter('week')}
              className={`text-sm px-4 rounded-full ${
                timeFilter === 'week' 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              Week
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTimeFilter('month')}
              className={`text-sm px-4 rounded-full ${
                timeFilter === 'month' 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              Month
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTimeFilter('all')}
              className={`text-sm px-4 rounded-full ${
                timeFilter === 'all' 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
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
          {/* Hero Summary Card */}
          <Card className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-[0_0_30px_rgba(16,185,129,0.15)] text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📈</span>
                <h2 className="text-xl font-black">Your Swing Progress</h2>
              </div>
              
              <div className="flex items-baseline gap-3 mb-2">
                <span className={`text-5xl font-black ${getScoreColor(stats.latest)}`}>
                  +{Math.abs(stats.latest - stats.average)}
                </span>
                <span className="text-white/60 text-lg">points this {timeFilter === 'week' ? 'week' : timeFilter === 'month' ? 'month' : 'period'}</span>
              </div>
              
              {/* Mini progress bar */}
              <div className="mb-4">
                <ProgressBar value={(stats.latest / 100) * 100} className="h-2 bg-white/10" />
              </div>
              
              <div className="text-sm text-white/60">
                Best session: {swings[0]?.created_at ? format(new Date(swings[0].created_at), 'MMM d') : '—'} — Latest Score: {stats.latest}
              </div>
            </div>
          </Card>

          {/* Metric Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { metric: 'attack_angle_deg', label: 'Attack Angle', unit: '°', icon: TrendingUp },
              { metric: 'head_drift_cm', label: 'Head Drift', unit: 'cm', icon: Target, invert: true },
              { metric: 'hip_shoulder_sep_deg', label: 'Hip-Shoulder Sep', unit: '°', icon: Activity },
              { metric: 'torso_tilt_deg', label: 'Torso Tilt', unit: '°', icon: Zap }
            ].map(({ metric, label, unit, icon: Icon, invert }) => {
              const series = chartData.allMetricsSeries[metric] || [];
              const recent = series.slice(-3).map(p => p.value);
              const older = series.slice(-6, -3).map(p => p.value);
              
              let trend: 'up' | 'down' | 'flat' = 'flat';
              let change = 0;
              
              if (recent.length && older.length) {
                const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
                const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
                change = recentAvg - olderAvg;
                trend = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
              }
              
              const avgValue = chartData.averages[metric];
              const isImproving = invert ? trend === 'down' : trend === 'up';
              
              // Get target range from metricSpecs
              const spec = metricSpecs[metric as keyof typeof metricSpecs];
              const targetRange = spec ? `${spec.target[0]}-${spec.target[1]}${unit}` : null;
              
              return (
                <Card 
                  key={metric}
                  className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] transition-all cursor-pointer"
                  onClick={() => setSelectedMetric(metric)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="w-4 h-4 text-white/60" />
                    {trend !== 'flat' && (
                      <span className={`text-xs ${isImproving ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trend === 'up' ? '↗' : '↘'} {Math.abs(change).toFixed(1)}{unit}
                      </span>
                    )}
                  </div>
                  <div className="text-white/60 text-xs mb-1">{label}</div>
                  <div className={`text-2xl font-black ${(invert ? trend === 'down' : trend === 'up') ? 'text-emerald-400' : 'text-white'}`}>
                    {avgValue ? avgValue.toFixed(1) : '—'}
                    <span className="text-sm ml-1 text-white/60">{unit}</span>
                  </div>
                  
                  {/* Target Range */}
                  {targetRange && (
                    <div className="text-xs text-white/40 mt-1">
                      Target: {targetRange}
                    </div>
                  )}
                  
                  <div className="text-xs text-white/40 mt-1">
                    vs {timeFilter === 'week' ? 'last week' : timeFilter === 'month' ? 'last month' : 'previous swings'}
                  </div>
                  
                  {/* Mini sparkline */}
                  {series.length > 0 && (
                    <div className="mt-2 h-6 flex items-end gap-0.5">
                      {series.slice(-8).map((point, i) => (
                        <div 
                          key={i} 
                          className={`flex-1 rounded-t ${(invert ? trend === 'down' : trend === 'up') ? 'bg-emerald-500/40' : 'bg-white/20'}`}
                          style={{ height: `${(point.value / Math.max(...series.map(s => s.value))) * 100}%` }}
                        />
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Then vs Now Comparison - Dynamic Top Changes */}
          {metricComparison && Object.keys(metricComparison).length > 0 && (
            <Card className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-[0_0_20px_rgba(16,185,129,0.1)] text-white">
              <h3 className="font-black text-lg mb-2 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                Then vs Now
              </h3>
              <p className="text-xs text-white/60 mb-4">Biggest changes in your last 3 swings</p>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Then Card */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <div className="text-xs text-white/40 mb-3">Previous 3 Swings</div>
                  {Object.entries(metricComparison).map(([key, data]) => (
                    data.old !== null && (
                      <div key={key} className="mb-2 last:mb-0">
                        <div className="text-xs text-white/60">{data.label}</div>
                        <div className="text-lg font-black text-white/80">
                          {data.old.toFixed(1)}{data.unit}
                        </div>
                      </div>
                    )
                  ))}
                </div>
                
                {/* Now Card */}
                <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/30">
                  <div className="text-xs text-emerald-400 mb-3">Recent 3 Swings</div>
                  {Object.entries(metricComparison).map(([key, data]) => {
                    if (data.recent === null || data.old === null) return null;
                    return (
                      <div key={key} className="mb-2 last:mb-0">
                        <div className="text-xs text-white/60">{data.label}</div>
                        <div className={`text-lg font-black flex items-center gap-1 ${data.isImproving ? 'text-emerald-400' : 'text-orange-400'}`}>
                          {data.recent.toFixed(1)}{data.unit}
                          {data.isImproving ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="mt-4 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
            </Card>
          )}

          {/* AI Coach Insight */}
          <Card className="bg-white/5 border border-emerald-500/20 rounded-2xl p-5 shadow-[0_0_20px_rgba(16,185,129,0.15)] text-white">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 border border-emerald-500/30">
                <Brain className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-base mb-2 flex items-center gap-2">
                  AI Coach Insight
                </h3>
                {insightLoading ? (
                  <div className="flex items-center gap-2 text-white/60">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-emerald-400 border-t-transparent" />
                    <span className="text-sm">Analyzing your progress...</span>
                  </div>
                ) : (
                  <p className="text-white font-medium text-sm leading-relaxed">
                    {aiInsight || "Record a few more swings to get personalized insights!"}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Progress Timeline */}
          <Card className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-[0_0_20px_rgba(16,185,129,0.1)] text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg">Recent Sessions</h3>
              <span className="text-xs text-white/60">Last {Math.min(swings.length, 8)} swings</span>
            </div>

            <div className="relative space-y-4">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500 via-cyan-500 to-transparent" />
              
              {swings.slice(0, 8).map((swing, index) => {
                const score = swing.score_phase1 || 0;
                const date = swing.created_at ? format(new Date(swing.created_at), 'MMM d') : 'Unknown';
                const prevScore = index < swings.length - 1 ? (swings[index + 1].score_phase1 || 0) : score;
                const scoreDelta = score - prevScore;
                
                // Get all metrics for this swing and calculate their distance from target
                const swingMetrics = metrics.filter(m => m.swing_id === swing.id);
                
                const metricInfo: Record<string, { label: string; unit: string }> = {
                  hip_shoulder_sep_deg: { label: 'Hip-Shoulder', unit: '°' },
                  attack_angle_deg: { label: 'Attack', unit: '°' },
                  head_drift_cm: { label: 'Head', unit: 'cm' },
                  contact_timing_frames: { label: 'Timing', unit: 'fr' },
                  bat_lag_deg: { label: 'Bat Lag', unit: '°' },
                  torso_tilt_deg: { label: 'Torso', unit: '°' },
                  stride_var_pct: { label: 'Stride', unit: '%' },
                  finish_balance_idx: { label: 'Balance', unit: '' }
                };
                
                // Calculate distance from target for each metric
                const metricsWithDistance = swingMetrics
                  .map(m => {
                    const spec = metricSpecs[m.metric as keyof typeof metricSpecs];
                    if (!spec || m.value === null) return null;
                    
                    const [targetMin, targetMax] = spec.target;
                    const value = m.value;
                    
                    // Calculate how far from target range (0 if within range)
                    let distance = 0;
                    if (value < targetMin) {
                      distance = targetMin - value;
                    } else if (value > targetMax) {
                      distance = value - targetMax;
                    }
                    
                    const info = metricInfo[m.metric || ''];
                    if (!info) return null;
                    
                    return {
                      metric: m.metric,
                      value: m.value,
                      label: info.label,
                      unit: info.unit,
                      distance: Math.abs(distance),
                      isOutOfRange: distance > 0
                    };
                  })
                  .filter((m): m is NonNullable<typeof m> => m !== null)
                  .sort((a, b) => b.distance - a.distance)
                  .slice(0, 2); // Take top 2 most significant metrics
                
                return (
                  <div 
                    key={swing.id}
                    className="relative pl-10 cursor-pointer hover:bg-white/5 rounded-lg p-3 -ml-3 transition-all"
                    onClick={() => navigate(`/swing/${swing.id}`)}
                  >
                    {/* Timeline marker */}
                    <div className={`absolute left-2.5 top-5 w-3 h-3 rounded-full ${index === 0 ? 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-cyan-500/50'} border-2 border-black`} />
                    
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-xs text-white/60 mb-1">{date}</div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm text-white/80">Swingscore</span>
                          <span className={`text-xl font-black ${getScoreColor(score)}`}>{score}</span>
                          {scoreDelta !== 0 && index < swings.length - 1 && (
                            <Badge className={`text-xs ${scoreDelta > 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                              {scoreDelta > 0 ? '▲' : '▼'} {Math.abs(scoreDelta)}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Dynamic key metrics - shows biggest deviations */}
                        <div className="flex gap-3 text-xs flex-wrap">
                          {metricsWithDistance.map(m => (
                            <div key={m.metric} className={m.isOutOfRange ? 'text-orange-400' : 'text-white/60'}>
                              {m.label}: <span className={`font-medium ${m.isOutOfRange ? 'text-orange-300' : 'text-white'}`}>
                                {m.value.toFixed(1)}{m.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <ChevronRight className="w-4 h-4 text-white/40 mt-2" />
                    </div>
                  </div>
                );
              })}
            </div>

            {swings.length > 8 && (
              <div className="mt-4 pt-4 border-t border-white/10 text-center">
                <button 
                  className="text-emerald-400 hover:text-emerald-300 font-medium text-sm transition-colors"
                  onClick={() => navigate('/recent-swings')}
                >
                  View All Swings →
                </button>
              </div>
            )}
          </Card>

          {/* WEEKLY BREAKDOWN */}
          <div>
            <h3 className="font-black text-xl mb-4 text-white">Weekly Breakdown</h3>
            <div className="space-y-3">
              {weeklyData.map((week, index) => {
                const prevWeek = weeklyData[index + 1];
                const trend = prevWeek && week.avgScore > prevWeek.avgScore ? 'up' : 'down';
                
                return (
                  <Card key={week.name} className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-[0_0_15px_rgba(16,185,129,0.08)] text-white hover:bg-white/10 transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-base font-black">{week.name}</div>
                        <div className="text-xs text-white/60 mt-0.5">{week.swingCount} swings</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-4xl font-black ${getScoreColor(week.avgScore)}`}>{week.avgScore}</div>
                        {week.swingCount > 0 && prevWeek && prevWeek.swingCount > 0 && (
                          <div className={`flex items-center justify-end gap-1 text-xs ${trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {trend === 'up' ? '↗' : '↘'} avg score
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Horizontal gradient bars */}
                    <div className="flex gap-1.5 mt-3">
                      {[...Array(Math.min(week.swingCount, 12))].map((_, i) => (
                        <div key={i} className="h-1.5 flex-1 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" />
                      ))}
                      {week.swingCount > 12 && (
                        <span className="text-xs text-white/60 ml-1">+{week.swingCount - 12}</span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* ACTIVITY HEATMAP */}
          <Card className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-[0_0_20px_rgba(16,185,129,0.1)] text-white">
            <h3 className="font-black text-xl mb-2">Activity Heatmap</h3>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-white/60">Last 30 Days</div>
              <div className="flex items-center gap-3 text-xs text-white/60">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-white/10" />
                  <span>None</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-emerald-500" />
                  <span>Active</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-7 gap-2.5">
              {heatmapData.map((day, i) => {
                const getColor = (count: number) => {
                  if (count === 0) return 'bg-white/10';
                  if (count === 1) return 'bg-emerald-500/30';
                  if (count === 2) return 'bg-emerald-500/60';
                  return 'bg-emerald-500';
                };

                return (
                  <div 
                    key={i} 
                    className={`aspect-square rounded-lg ${getColor(day.count)} hover:scale-110 transition-transform cursor-pointer`}
                    title={`${format(day.date, 'MMM d')}: ${day.count} swings`}
                  />
                );
              })}
            </div>
          </Card>


          {/* Action Button */}
          <Button 
            onClick={() => navigate('/analysis')} 
            className="w-full shadow-[0_0_30px_rgba(16,185,129,0.3)] bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white border-0" 
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
      <DialogContent className="max-w-md bg-gradient-to-b from-[#0F172A] to-black border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="font-black text-xl text-white">{info.title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-white/60">{info.description}</p>
          
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="text-sm text-white/60 mb-1">Average</div>
            <div className="text-3xl font-black text-emerald-400">{average?.toFixed(1) || '—'}</div>
            <div className="text-xs text-white/60 mt-2">
              <Target className="w-3 h-3 inline mr-1" />
              Target: {info.targetRange}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Last 10 Swings</div>
            <div className="flex gap-1 h-24 items-end">
              {series.slice(-10).map((point, i) => {
                const maxVal = Math.max(...series.slice(-10).map(p => p.value));
                const height = (point.value / maxVal) * 100;
                return (
                  <div 
                    key={i}
                    className="flex-1 bg-gradient-to-t from-emerald-500 to-cyan-500 rounded-t-lg transition-all hover:opacity-100"
                    style={{ 
                      height: `${Math.max(height, 10)}%`,
                      opacity: 0.5 + (i * 0.05)
                    }}
                    title={point.value.toFixed(1)}
                  />
                );
              })}
            </div>
          </div>

          <Button onClick={onClose} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
