import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ArrowLeft, Clock, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackCapture } from '@/lib/analytics';

type TimeFilter = 'week' | 'month' | 'all';

interface Swing {
  id: string;
  created_at: string | null;
  score_phase1: number | null;
  cues: string[] | null;
  drill_id: string | null;
}

export default function RecentSwings() {
  const navigate = useNavigate();
  const [swings, setSwings] = useState<Swing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  useEffect(() => {
    loadRecentSwings();
  }, [timeFilter]);

  const loadRecentSwings = async () => {
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
        // Analytics
        trackCapture.progressViewed(processedSwings.length);
      }

    } catch (err) {
      console.error('Failed to load recent swings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwingTap = (swingId: string) => {
    navigate(`/swing/${swingId}`);
  };

  const statistics = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const todaySwings = swings.filter(swing => {
      if (!swing.created_at) return false;
      const swingDate = new Date(swing.created_at);
      return swingDate >= today;
    });

    const scoresWithValues = swings.filter(s => s.score_phase1 !== null).map(s => s.score_phase1!);
    const avgScore = scoresWithValues.length > 0 
      ? Math.round(scoresWithValues.reduce((sum, score) => sum + score, 0) / scoresWithValues.length)
      : 0;

    return {
      totalSwings: swings.length,
      todaySwings: todaySwings.length,
      avgScore
    };
  }, [swings]);

  const isSwingNew = (swing: Swing) => {
    if (!swing.created_at) return false;
    const swingDate = new Date(swing.created_at);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return swingDate > oneDayAgo;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-b-[2rem] pt-safe pb-8 px-4 shimmer-bg animate-fade-in">
          <div className="container mx-auto max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="text-white hover:bg-white/20 rounded-xl"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="h-8 bg-white/20 rounded-xl animate-pulse w-40"></div>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-6 max-w-2xl -mt-4">
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-6 rounded-2xl shadow-sm">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-20 bg-muted rounded"></div>
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
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-b-[2rem] pt-safe pb-8 px-4 shimmer-bg">
          <div className="container mx-auto max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="text-white hover:bg-white/20 rounded-xl"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-3xl font-anton font-black text-white">Recent Swings</h1>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-6 max-w-2xl -mt-4">
          <Card className="p-8 text-center rounded-2xl shadow-sm bg-gradient-to-br from-red-50 to-orange-50">
            <h3 className="text-xl font-anton font-black mb-2">Error Loading Swings</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadRecentSwings} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
              Try Again
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (!swings.length) {
    return (
      <div className="min-h-screen bg-background">
        <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-b-[2rem] pt-safe pb-8 px-4 shimmer-bg">
          <div className="container mx-auto max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="text-white hover:bg-white/20 rounded-xl"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-3xl font-anton font-black text-white">Recent Swings</h1>
            </div>
          </div>
        </div>
        <div className="container mx-auto px-4 py-6 max-w-2xl -mt-4">
          <Card className="p-8 text-center rounded-2xl shadow-sm bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse-soft">
              <Clock className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-anton font-black mb-2">No Swings Yet</h3>
            <p className="text-muted-foreground mb-6">
              Record your first swing to start seeing your swing history and get personalized feedback.
            </p>
            <Button 
              onClick={() => navigate('/analysis')}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              Record Your First Swing
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-b-[2rem] pt-safe pb-8 px-4 shimmer-bg sticky top-0 z-10">
        <div className="container mx-auto max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/')}
              className="text-white hover:bg-white/20 rounded-xl"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-anton font-black text-white animate-fade-in-up">Recent Swings</h1>
          </div>

          {/* Time Filter Buttons */}
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setTimeFilter('week')}
              className={`px-6 py-2 rounded-xl font-medium transition-all ${
                timeFilter === 'week'
                  ? 'bg-white/30 backdrop-blur-sm text-white scale-105'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setTimeFilter('month')}
              className={`px-6 py-2 rounded-xl font-medium transition-all ${
                timeFilter === 'month'
                  ? 'bg-white/30 backdrop-blur-sm text-white scale-105'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-6 py-2 rounded-xl font-medium transition-all ${
                timeFilter === 'all'
                  ? 'bg-white/30 backdrop-blur-sm text-white scale-105'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              All
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl -mt-4">

        <div className="space-y-6">
          {/* Compact Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 border-0 rounded-2xl shadow-sm hover:shadow-md transition-all animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <div className="flex flex-col items-center gap-1">
                <BarChart3 className="w-5 h-5 text-white/90" />
                <div className="text-2xl font-anton font-black text-white">{statistics.totalSwings}</div>
                <div className="text-xs text-white/80">Total</div>
              </div>
            </Card>
            
            <Card className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 border-0 rounded-2xl shadow-sm hover:shadow-md transition-all animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="flex flex-col items-center gap-1">
                <TrendingUp className="w-5 h-5 text-white/90" />
                <div className="text-2xl font-anton font-black text-white">{statistics.avgScore}</div>
                <div className="text-xs text-white/80">Average</div>
              </div>
            </Card>
            
            <Card className="p-4 bg-gradient-to-br from-purple-500 to-pink-600 border-0 rounded-2xl shadow-sm hover:shadow-md transition-all animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="flex flex-col items-center gap-1">
                <Calendar className="w-5 h-5 text-white/90" />
                <div className="text-2xl font-anton font-black text-white">{statistics.todaySwings}</div>
                <div className="text-xs text-white/80">Today</div>
              </div>
            </Card>
          </div>

          {/* Swings History */}
          <div>
            <h3 className="text-xl font-anton font-black mb-4">Swing History</h3>
            <div className="space-y-3">
              {swings.map((swing, index) => {
                const date = swing.created_at ? new Date(swing.created_at) : new Date();
                const topCue = swing.cues?.[0];
                const isNew = isSwingNew(swing);
                
                return (
                  <Card
                    key={swing.id}
                    onClick={() => handleSwingTap(swing.id)}
                    className="p-4 cursor-pointer hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all rounded-2xl shadow-sm animate-fade-in-up"
                    style={{ animationDelay: `${0.4 + index * 0.05}s` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">
                              {date.toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {date.toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                          {isNew && (
                            <Badge className="text-xs bg-gradient-to-r from-blue-500 to-purple-600 text-white border-0 hover:from-blue-600 hover:to-purple-700">
                              New
                            </Badge>
                          )}
                        </div>
                        
                        {topCue && (
                          <p className="text-sm text-muted-foreground italic line-clamp-2">
                            "{topCue}"
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 ml-4">
                        {swing.score_phase1 && (
                          <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl px-4 py-2 shadow-sm">
                            <span className="text-xl font-anton font-black text-white">
                              {swing.score_phase1}
                            </span>
                          </div>
                        )}
                        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Action Button */}
          <Button 
            onClick={() => navigate('/analysis')} 
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl shadow-sm" 
            size="lg"
          >
            Record Another Swing
          </Button>
        </div>
      </div>
    </div>
  );
}