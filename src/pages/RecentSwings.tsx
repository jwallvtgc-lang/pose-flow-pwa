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
            <div className="h-6 bg-muted rounded animate-pulse w-32"></div>
          </div>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-6">
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
            <h1 className="text-2xl font-anton font-black">Recent Swings</h1>
          </div>
          <Card className="p-6 text-center">
            <h3 className="text-lg font-anton font-black mb-2">Error Loading Swings</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadRecentSwings}>Try Again</Button>
          </Card>
        </div>
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
            <h1 className="text-2xl font-anton font-black">Recent Swings</h1>
          </div>
          <Card className="p-8 text-center">
            <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-anton font-black mb-2">No Swings Yet</h3>
            <p className="text-muted-foreground mb-4">
              Record your first swing to start seeing your swing history and get personalized feedback.
            </p>
            <Button onClick={() => navigate('/analysis')}>
              Record Your First Swing
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/')}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-anton font-black">Recent Swings</h1>
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
          {/* Compact Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <div>
                  <div className="text-lg font-anton font-black text-blue-800">{statistics.totalSwings}</div>
                  <div className="text-xs text-blue-600">Total</div>
                </div>
              </div>
            </Card>
            
            <Card className="p-3 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <div>
                  <div className="text-lg font-anton font-black text-green-800">{statistics.avgScore}</div>
                  <div className="text-xs text-green-600">Average</div>
                </div>
              </div>
            </Card>
            
            <Card className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                <div>
                  <div className="text-lg font-anton font-black text-purple-800">{statistics.todaySwings}</div>
                  <div className="text-xs text-purple-600">Today</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Swings History */}
          <div>
            <h3 className="text-lg font-anton font-black mb-4">Swing History</h3>
            <div className="space-y-3">
              {swings.map((swing) => {
                const date = swing.created_at ? new Date(swing.created_at) : new Date();
                const topCue = swing.cues?.[0];
                const isNew = isSwingNew(swing);
                
                return (
                  <Card
                    key={swing.id}
                    onClick={() => handleSwingTap(swing.id)}
                    className="p-4 cursor-pointer hover:shadow-md transition-shadow bg-muted/30 hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm font-medium">
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
                            <Badge className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100">
                              New
                            </Badge>
                          )}
                        </div>
                        
                        {topCue && (
                          <p className="text-sm text-muted-foreground italic">
                            "{topCue}"
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {swing.score_phase1 && (
                          <div className="bg-white/60 backdrop-blur-sm rounded-lg px-3 py-1">
                            <span className="text-lg font-anton font-black text-primary">
                              {swing.score_phase1}
                            </span>
                          </div>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
            className="w-full" 
            size="lg"
          >
            Record Another Swing
          </Button>
        </div>
      </div>
    </div>
  );
}