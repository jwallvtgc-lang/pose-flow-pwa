import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ArrowLeft, Clock } from 'lucide-react';
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

  const getScoreColor = (score: number | null) => {
    if (!score) return 'bg-muted';
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleSwingTap = (swingId: string) => {
    navigate(`/swing/${swingId}`);
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
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Recent Swings</h1>
        </div>

        <Card className="p-4 mb-6">
          <p className="text-muted-foreground text-sm mb-4">
            View your swing history and track your improvement over time. Tap any swing to see detailed analysis and coaching feedback.
          </p>
          <div className="space-y-2">
            {swings.map((swing) => {
              const date = swing.created_at ? new Date(swing.created_at) : new Date();
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

        <Button onClick={() => navigate('/analysis')} className="w-full" size="lg">
          Record Another Swing
        </Button>
      </div>
    </div>
  );
}