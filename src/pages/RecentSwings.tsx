import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ArrowLeft, Clock, Filter, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackCapture } from '@/lib/analytics';

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
  const [activeFilter, setActiveFilter] = useState<'all' | 'today' | 'week'>('all');

  useEffect(() => {
    loadRecentSwings();
  }, []);

  const loadRecentSwings = async () => {
    try {
      setIsLoading(true);
      setError('');

      // Fetch recent swings
      const { data: swingsData, error: swingsError } = await supabase
        .from('swings')
        .select('id, created_at, score_phase1, cues, drill_id')
        .order('created_at', { ascending: false })
        .limit(20);

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
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todaySwings = swings.filter(swing => {
      if (!swing.created_at) return false;
      const swingDate = new Date(swing.created_at);
      return swingDate >= today;
    });

    const weekSwings = swings.filter(swing => {
      if (!swing.created_at) return false;
      const swingDate = new Date(swing.created_at);
      return swingDate >= weekAgo;
    });

    const scoresWithValues = swings.filter(s => s.score_phase1 !== null).map(s => s.score_phase1!);
    const avgScore = scoresWithValues.length > 0 
      ? Math.round(scoresWithValues.reduce((sum, score) => sum + score, 0) / scoresWithValues.length)
      : 0;

    return {
      totalSwings: swings.length,
      todaySwings: todaySwings.length,
      weekSwings: weekSwings.length,
      avgScore
    };
  }, [swings]);

  // Filter swings based on active filter
  const filteredSwings = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    switch (activeFilter) {
      case 'today':
        return swings.filter(swing => {
          if (!swing.created_at) return false;
          const swingDate = new Date(swing.created_at);
          return swingDate >= today;
        });
      case 'week':
        return swings.filter(swing => {
          if (!swing.created_at) return false;
          const swingDate = new Date(swing.created_at);
          return swingDate >= weekAgo;
        });
      default:
        return swings;
    }
  }, [swings, activeFilter]);

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
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Recent Swings</h1>
          </div>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="p-4">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded mb-2"></div>
                  <div className="h-8 bg-muted rounded"></div>
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
          <h3 className="text-lg font-semibold mb-2">Error Loading Swings</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={loadRecentSwings}>Try Again</Button>
        </Card>
      </div>
    );
  }

  if (!swings.length) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Recent Swings</h1>
          </div>
          <Card className="p-8 text-center">
            <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Swings Yet</h3>
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Recent Swings</h1>
              <p className="text-sm text-muted-foreground">Swing history & analysis</p>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="p-4 text-center">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-2">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div className="text-2xl font-bold">{statistics.totalSwings}</div>
            <div className="text-xs text-muted-foreground">Total Swings</div>
          </Card>
          
          <Card className="p-4 text-center">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div className="text-2xl font-bold">{statistics.avgScore}</div>
            <div className="text-xs text-muted-foreground">Avg Score</div>
            <div className="text-xs text-muted-foreground">last 7 swings</div>
          </Card>
          
          <Card className="p-4 text-center">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div className="text-2xl font-bold">{statistics.todaySwings}</div>
            <div className="text-xs text-muted-foreground">Today swings</div>
          </Card>
        </div>

        {/* Info Box */}
        <Card className="p-4 mb-6 bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-800">
            View your swing history and track your improvement over time. Tap any swing to see detailed analysis and personalized coaching feedback.
          </p>
        </Card>

        {/* Filter Tabs */}
        <div className="flex gap-6 mb-6">
          <button
            onClick={() => setActiveFilter('all')}
            className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
              activeFilter === 'all'
                ? 'text-blue-600 border-blue-600'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            All Swings
          </button>
          <button
            onClick={() => setActiveFilter('today')}
            className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
              activeFilter === 'today'
                ? 'text-blue-600 border-blue-600'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setActiveFilter('week')}
            className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
              activeFilter === 'week'
                ? 'text-blue-600 border-blue-600'
                : 'text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            Week
          </button>
        </div>

        {/* Swings List */}
        <div className="space-y-3 mb-6">
          {filteredSwings.map((swing) => {
            const date = swing.created_at ? new Date(swing.created_at) : new Date();
            const topCue = swing.cues?.[0];
            const isNew = isSwingNew(swing);
            
            return (
              <Card
                key={swing.id}
                onClick={() => handleSwingTap(swing.id)}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
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
                      <Badge className="bg-yellow-500 text-white hover:bg-yellow-500">
                        {swing.score_phase1}
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Button onClick={() => navigate('/analysis')} className="w-full" size="lg">
          Record Another Swing
        </Button>
      </div>
    </div>
  );
}