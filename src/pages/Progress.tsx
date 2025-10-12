import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, ArrowRight, ArrowLeft, Target, AlertTriangle, CheckCircle2, AlertCircle, Share2, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackCapture } from '@/lib/analytics';
import { metricSpecs } from '@/config/phase1_metrics';
import { toast } from 'sonner';

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
        {/* Header Skeleton */}
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

        {/* Content Skeletons */}
        <div className="container mx-auto px-4 py-6 max-w-2xl space-y-4">
          <Skeleton className="h-64 w-full rounded-3xl" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
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
        {/* Gradient Header */}
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
              <h1 className="text-xl font-anton font-black">Progress</h1>
              <div className="w-8" />
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <Card className="p-8 text-center rounded-3xl">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="text-2xl font-anton font-black mb-3">Record more swings to see your progress here</h3>
            <p className="text-muted-foreground mb-6 text-lg">
              Start tracking your improvement and see detailed metrics over time.
            </p>
            <Button onClick={() => navigate('/analysis')} size="lg" className="animate-pulse-soft">
              Record Your First Swing
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const latestScore = swings[0]?.score_phase1;

  const handleShare = () => {
    toast.success("Share feature coming soon!");
  };

  return (
    <div className="min-h-screen bg-background pb-safe">
      {/* Sticky Gradient Header */}
      <div 
        className={`sticky top-0 z-50 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 text-white safe-area-top transition-all duration-300 ${
          isScrolled ? 'header-blur shadow-lg' : ''
        }`}
      >
        <div className="container mx-auto px-4 py-4 max-w-2xl">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/')}
              className="h-8 w-8 p-0 text-white hover:bg-white/20 active:scale-95 transition-transform"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-anton font-black">Progress</h1>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleShare}
              className="h-8 w-8 p-0 text-white hover:bg-white/20 active:scale-95 transition-transform"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          </div>

          {/* Time Filter Tabs - Inside Header */}
          <div className="flex justify-center gap-2 pb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTimeFilter('week')}
              className={`text-sm px-4 transition-all duration-200 ${
                timeFilter === 'week' 
                  ? 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              Week
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTimeFilter('month')}
              className={`text-sm px-4 transition-all duration-200 ${
                timeFilter === 'month' 
                  ? 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30' 
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              Month
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTimeFilter('all')}
              className={`text-sm px-4 transition-all duration-200 ${
                timeFilter === 'all' 
                  ? 'bg-white/20 backdrop-blur-sm text-white hover:bg-white/30' 
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

        <div className="space-y-6 animate-fade-in-up">
          {/* Score Trend Card - Enhanced */}
          <Card className="relative p-6 overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-3xl shadow-lg">
            {/* Shimmer Effect */}
            <div className="absolute inset-0 shimmer-bg opacity-30" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-anton font-black">Score Trend</h3>
                  <p className="text-blue-100 text-sm">
                    Last {chartData.scoreSeries.length} swings • Avg: {chartData.averages['score']?.toFixed(1) || '—'}
                  </p>
                </div>
                {latestScore && (
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 animate-pulse-soft">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-5 h-5" />
                      <span className="text-3xl font-anton font-black">{latestScore}</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Enhanced Chart */}
              <div className="mb-4">
                <ScoreBarChart data={chartData.scoreSeries} />
              </div>
              
              {/* Trend Summary - More Prominent */}
              <div className="flex items-center justify-between bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${scoreTrend.isImproving ? 'bg-green-400' : 'bg-orange-400'}`} />
                  <span className="text-lg font-bold">{scoreTrend.description}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ArrowRight className={`w-5 h-5 transition-transform ${scoreTrend.isImproving ? 'rotate-[-45deg]' : 'rotate-45'}`} />
                  <span className="text-2xl font-anton font-black">
                    {scoreTrend.change > 0 ? '+' : ''}{scoreTrend.change.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Enhanced Improving & Focus Areas Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 rounded-2xl shadow-sm active:scale-98 transition-transform">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <span className="text-green-700 font-anton font-black text-sm">Improving</span>
              </div>
              <div className="text-5xl font-black text-green-800 mb-1">{improvingMetrics.improving}</div>
              <div className="text-green-600 text-sm font-medium">metrics trending up</div>
            </Card>
            
            <Card className="p-5 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 rounded-2xl shadow-sm active:scale-98 transition-transform animate-pulse-soft">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-white" />
                </div>
                <span className="text-orange-700 font-anton font-black text-sm">Focus Areas</span>
              </div>
              <div className="text-5xl font-black text-orange-800 mb-1">{improvingMetrics.needsWork}</div>
              <div className="text-orange-600 text-sm font-medium">metrics need work</div>
            </Card>
          </div>

          {/* Swing Metrics Section - Redesigned */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-anton font-black">Swing Metrics</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
              >
                View Details
              </Button>
            </div>
            <div className="space-y-3">
              <DetailedMetricCard
                title="Hip-Shoulder Separation"
                description="Angle between shoulder and hip rotation at launch"
                average={chartData.averages['hip_shoulder_sep_deg']}
                unit="deg"
                targetRange="15-35°"
                chartData={chartData}
                onTap={() => setSelectedMetric('hip_shoulder_sep_deg')}
              />
              
              <DetailedMetricCard
                title="Attack Angle"
                description="Bat path angle through the hitting zone"
                average={chartData.averages['attack_angle_deg']}
                unit="deg"
                targetRange="5-20°"
                chartData={chartData}
                onTap={() => setSelectedMetric('attack_angle_deg')}
              />
              
              <DetailedMetricCard
                title="Head Drift"
                description="Head movement during the swing"
                average={chartData.averages['head_drift_cm']}
                unit="cm"
                targetRange="0-6 cm (lower is better)"
                chartData={chartData}
                onTap={() => setSelectedMetric('head_drift_cm')}
              />
              
              <DetailedMetricCard
                title="Contact Timing"
                description="Timing relative to optimal swing sequence"
                average={chartData.averages['contact_timing_frames']}
                unit="frames"
                targetRange="-3 to +3"
                chartData={chartData}
                onTap={() => setSelectedMetric('contact_timing_frames')}
              />
              
              <DetailedMetricCard
                title="Bat Lag"
                description="Angle between bat and lead arm at launch"
                average={chartData.averages['bat_lag_deg']}
                unit="deg"
                targetRange="50-70°"
                chartData={chartData}
                onTap={() => setSelectedMetric('bat_lag_deg')}
              />
              
              <DetailedMetricCard
                title="Torso Tilt"
                description="Forward lean of torso at contact"
                average={chartData.averages['torso_tilt_deg']}
                unit="deg"
                targetRange="20-35°"
                chartData={chartData}
                onTap={() => setSelectedMetric('torso_tilt_deg')}
              />
              
              <DetailedMetricCard
                title="Finish Balance"
                description="Balance stability at swing finish"
                average={chartData.averages['finish_balance_idx']}
                unit="index"
                targetRange="0.0-0.3 (lower is better)"
                chartData={chartData}
                onTap={() => setSelectedMetric('finish_balance_idx')}
              />
            </div>
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

// Enhanced Score Bar Chart Component
function ScoreBarChart({ data }: { data: ChartPoint[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-20">
        <span className="text-blue-200 text-sm">No score data available</span>
      </div>
    );
  }

  const recentScores = data;
  const average = recentScores.reduce((sum, point) => sum + point.value, 0) / recentScores.length;
  
  const chartMin = 0;
  const chartMax = 100;
  const maxBarHeight = 100;

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
      {/* Chart Container */}
      <div className="relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-blue-200 pr-2" style={{ width: '30px' }}>
          <span>100</span>
          <span>50</span>
          <span>0</span>
        </div>
        
        {/* Average line */}
        <div 
          className="absolute left-8 right-0 border-t-2 border-dashed border-white/40 z-10"
          style={{ 
            top: `${maxBarHeight - ((average - chartMin) / (chartMax - chartMin)) * maxBarHeight + 10}px`
          }}
        >
          <span className="absolute -top-5 right-0 text-xs font-bold text-white bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
            Avg {average.toFixed(0)}
          </span>
        </div>

        {/* Bar Chart - Enhanced */}
        <div 
          className="ml-8 flex items-end gap-1 bg-white/10 backdrop-blur-sm rounded-xl p-4 overflow-x-auto scroll-smooth" 
          style={{ height: `${maxBarHeight + 20}px` }}
        >
          {recentScores.map((point, index) => {
            const barHeight = Math.max(
              ((point.value - chartMin) / (chartMax - chartMin)) * maxBarHeight,
              3
            );
            
            const isLatest = index === recentScores.length - 1;
            const swingNumber = recentScores.length - index;
            const isHovered = hoveredIndex === index;
            
            return (
              <div 
                key={`bar-${point.t}-${index}`} 
                className="flex flex-col items-center group relative cursor-pointer"
                style={{ 
                  minWidth: recentScores.length > 30 ? '12px' : recentScores.length > 20 ? '16px' : '20px',
                  flex: '0 0 auto' 
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => toast.info(`Swing #${swingNumber}: ${point.value} points`)}
              >
                {/* Enhanced Tooltip */}
                {isHovered && (
                  <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 z-20 animate-fade-in-up">
                    <div className="bg-gray-900 text-white text-xs rounded-xl px-4 py-3 shadow-xl whitespace-nowrap border border-white/10">
                      <div className="font-black text-base mb-1">#{swingNumber}</div>
                      <div className="text-xl font-bold mb-1">{point.value}</div>
                      <div className="text-gray-400">{getPerformanceLevel(point.value)}</div>
                    </div>
                  </div>
                )}
                
                {/* Bar with pulse for latest */}
                <div 
                  className={`w-full rounded-t-lg transition-all duration-300 ${
                    isLatest 
                      ? 'ring-2 ring-white animate-pulse-soft ' + getScoreColor(point.value)
                      : getScoreColor(point.value) + ' opacity-80'
                  } ${isHovered ? 'scale-110 opacity-100' : ''} active:scale-95`}
                  style={{ 
                    height: `${Math.round(barHeight)}px`,
                    minHeight: '3px'
                  }}
                />
                
                {/* Swing number */}
                {(isLatest || swingNumber % 5 === 0 || isHovered) && (
                  <div className={`text-[10px] mt-1 font-bold ${isLatest ? 'text-white' : 'text-blue-200'}`}>
                    {swingNumber}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Enhanced Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-green-600"></div>
          <span className="text-blue-100 font-medium">80+ Excellent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-yellow-500 rounded-full border-2 border-yellow-600"></div>
          <span className="text-blue-100 font-medium">60+ Good</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-orange-500 rounded-full border-2 border-orange-600"></div>
          <span className="text-blue-100 font-medium">40+ Fair</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-red-600"></div>
          <span className="text-blue-100 font-medium">&lt;40 Needs Work</span>
        </div>
      </div>
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-xs text-blue-100 font-medium">Latest swing highlighted</span>
        </div>
      </div>
    </div>
  );
}

// Redesigned Detailed Metric Card Component
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
  onTap?: () => void;
}

function DetailedMetricCard({ title, description, average, unit, targetRange, chartData, onTap }: DetailedMetricCardProps) {
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

  const getStatusColor = () => {
    if (!average) return 'border-gray-300';
    const isGood = isInTargetRange(average, title);
    return isGood ? 'border-green-500' : 'border-orange-500';
  };

  const getStatusIcon = () => {
    if (!average) return null;
    const isGood = isInTargetRange(average, title);
    return isGood ? (
      <CheckCircle2 className="w-5 h-5 text-green-600" />
    ) : (
      <AlertCircle className="w-5 h-5 text-orange-600" />
    );
  };

  const getStatusBadge = () => {
    if (!average) return null;
    const isGood = isInTargetRange(average, title);
    if (title === "Head Drift" && average <= 6) {
      return <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">✅ Great!</span>;
    }
    if (title === "Head Drift" && average > 6) {
      return <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">⚠️ Too much</span>;
    }
    if (title === "Hip-Shoulder Separation" && average < 15) {
      return <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">⚠️ Below target</span>;
    }
    return isGood ? (
      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">Good</span>
    ) : (
      <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">Needs Work</span>
    );
  };
  
  return (
    <Card 
      className={`p-4 border-l-4 ${getStatusColor()} rounded-2xl shadow-sm cursor-pointer active:scale-98 transition-all hover:shadow-md`}
      onClick={onTap}
    >
      {/* Top Row - Metric Name and Value */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1">
          {getStatusIcon()}
          <div>
            <h4 className="font-anton font-black text-base">{title}</h4>
            <p className="text-xs text-gray-600">{description}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black">
            {average ? `${average.toFixed(1)}` : '—'}
          </div>
          <div className="text-xs text-gray-500">{unit}</div>
        </div>
      </div>

      {/* Status Badge and Target */}
      <div className="flex items-center justify-between mb-3">
        {getStatusBadge()}
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Target className="w-3 h-3" />
          <span>{targetRange}</span>
        </div>
      </div>
      
      {/* Trend Bars - Last 7 swings (larger) */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-gray-500 mr-1 font-medium">Last 7:</span>
        {[...Array(7)].map((_, i) => {
          const dataPoint = lastSevenValues[i];
          if (!dataPoint) {
            return (
              <div 
                key={i} 
                className="h-6 flex-1 rounded-lg bg-gray-100 min-w-[10px]"
                title="No data"
              />
            );
          }
          
          const isGood = isInTargetRange(dataPoint.value, title);
          const opacity = Math.min(0.5 + (i * 0.1), 1);
          
          return (
            <div 
              key={i} 
              className={`h-6 flex-1 rounded-lg transition-all hover:scale-105 min-w-[10px] ${
                isGood ? 'bg-green-500' : 'bg-orange-500'
              }`}
              style={{ opacity }}
              title={`${dataPoint.value.toFixed(1)} ${unit} (${isGood ? 'Good' : 'Needs Work'})`}
            />
          );
        })}
        
        {/* Trend Arrow */}
        {lastSevenValues.length >= 2 && (() => {
          const recent = lastSevenValues.slice(-3).map((p: ChartPoint) => p.value);
          const older = lastSevenValues.slice(0, 3).map((p: ChartPoint) => p.value);
          if (recent.length && older.length) {
            const recentAvg = recent.reduce((a: number, b: number) => a + b, 0) / recent.length;
            const olderAvg = older.reduce((a: number, b: number) => a + b, 0) / older.length;
            
            const lowerIsBetter = title === "Head Drift" || title === "Finish Balance";
            const isImproving = lowerIsBetter ? recentAvg < olderAvg : recentAvg > olderAvg;
            
            return (
              <div className="ml-2">
                <TrendingUp className={`w-5 h-5 transition-transform ${
                  isImproving ? 'text-green-600' : 'text-orange-600 rotate-180'
                }`} />
              </div>
            );
          }
          return null;
        })()}
        
        <ChevronRight className="w-4 h-4 text-gray-400 ml-1" />
      </div>
    </Card>
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

  const metricTitles: Record<string, string> = {
    hip_shoulder_sep_deg: "Hip-Shoulder Separation",
    attack_angle_deg: "Attack Angle",
    head_drift_cm: "Head Drift",
    contact_timing_frames: "Contact Timing",
    bat_lag_deg: "Bat Lag",
    torso_tilt_deg: "Torso Tilt",
    finish_balance_idx: "Finish Balance"
  };

  const metricDescriptions: Record<string, string> = {
    hip_shoulder_sep_deg: "The angle between your shoulders and hips at the moment of launch. Greater separation creates more power and bat speed. Elite hitters typically generate 15-35 degrees of separation.",
    attack_angle_deg: "The vertical angle of your bat path through the hitting zone. A slight upward angle (5-20°) matches the downward trajectory of most pitches and increases your margin for error.",
    head_drift_cm: "How much your head moves during the swing. Less movement (0-6 cm) improves consistency, balance, and ability to track the ball.",
    contact_timing_frames: "How well-timed your contact is relative to the optimal swing sequence. Being within -3 to +3 frames ensures maximum power transfer.",
    bat_lag_deg: "The angle between your bat and lead arm at launch. Proper lag (50-70°) creates a whipping action that generates bat speed.",
    torso_tilt_deg: "Your forward lean at contact. Proper tilt (20-35°) helps you attack the ball at the right angle and maintain balance.",
    finish_balance_idx: "Your stability at the completion of the swing. Lower values (0.0-0.3) indicate better control and consistent mechanics."
  };

  const title = metricTitles[metricName] || metricName;
  const description = metricDescriptions[metricName] || "";
  const average = chartData.averages[metricName];
  const series = chartData.allMetricsSeries[metricName] || [];
  const last30 = series.slice(-30);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-anton font-black">{title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Current Value - Large */}
          <div className="text-center">
            <div className="text-6xl font-black text-blue-600 mb-2">
              {average ? average.toFixed(1) : '—'}
            </div>
            <div className="text-gray-500 text-sm">Current Average</div>
          </div>

          {/* Full Description */}
          <Card className="p-4 bg-blue-50 border-blue-200">
            <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
          </Card>

          {/* Trend Chart Placeholder */}
          <div className="h-48 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl flex items-center justify-center">
            <p className="text-gray-500 text-sm">Last 30 swings: {last30.length} data points</p>
          </div>

          {/* Drill Recommendations */}
          <div>
            <h4 className="font-anton font-black mb-3">Recommended Drills</h4>
            <div className="space-y-2">
              <Card className="p-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer">
                <span className="text-sm font-medium">View Related Drills</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Card>
            </div>
          </div>

          {/* Action Button */}
          <Button className="w-full" size="lg">
            View Drill
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}