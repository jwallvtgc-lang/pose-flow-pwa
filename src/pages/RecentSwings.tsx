import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { trackCapture } from '@/lib/analytics';
import { AppHeader } from '@/components/AppHeader';

type TimeFilter = 'week' | 'month' | 'all';

interface Swing {
  id: string;
  created_at: string | null;
  score_phase1: number | null;
  cues: string[] | null;
  drill_id: string | null;
  video_url: string | null;
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
        .select('id, created_at, score_phase1, cues, drill_id, video_url')
        .order('created_at', { ascending: false });

      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      } else {
        query = query.limit(500); // Increased limit for 'all' view
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
      <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black">
        <AppHeader 
          onBack={() => navigate('/')}
        />
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">⚾ Recent Swings</h1>
            <p className="text-white/50 text-sm">Loading your swing history...</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/5 border border-white/10 p-4 animate-pulse">
                <div className="aspect-[4/3] bg-white/10 rounded-lg mb-3"></div>
                <div className="h-4 bg-white/10 rounded mb-2"></div>
                <div className="h-3 bg-white/10 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black">
        <AppHeader 
          onBack={() => navigate('/')}
        />
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">⚾ Recent Swings</h1>
            <p className="text-white/50 text-sm">Tap to review and compare your latest sessions.</p>
          </div>
          <Card className="p-8 text-center rounded-2xl bg-white/5 border border-white/20 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <h3 className="text-xl font-bold text-white mb-2">Error Loading Swings</h3>
            <p className="text-white/70 mb-4">{error}</p>
            <Button 
              onClick={loadRecentSwings} 
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              Try Again
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (!swings.length) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black">
        <AppHeader 
          onBack={() => navigate('/')}
        />
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">⚾ Recent Swings</h1>
            <p className="text-white/50 text-sm">Tap to review and compare your latest sessions.</p>
          </div>
          <Card className="p-12 text-center rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_25px_rgba(16,185,129,0.15)] backdrop-blur-md">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
              <Clock className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No swings yet — upload your first one!</h3>
            <p className="text-white/60 mb-8 max-w-sm mx-auto">
              Record your first swing to start seeing your swing history and get personalized feedback.
            </p>
            <Button 
              onClick={() => navigate('/analysis')}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 py-6 text-lg font-semibold shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_35px_rgba(16,185,129,0.6)] transition-all"
            >
              + Upload Swing
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black">
      <AppHeader 
        onBack={() => navigate('/')}
      />

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Title & Subtitle */}
        <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">⚾ Recent Swings</h1>
          <p className="text-white/50 text-sm">Tap to review and compare your latest sessions.</p>
          <div className="h-1 w-24 mx-auto mt-3 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-transparent"></div>
        </div>

        {/* Filter Tabs */}
        <div className="flex justify-center gap-3 mb-6">
          <button
            onClick={() => setTimeFilter('all')}
            className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${
              timeFilter === 'all'
                ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'text-white/50 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTimeFilter('week')}
            className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${
              timeFilter === 'week'
                ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'text-white/50 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            Best
          </button>
          <button
            onClick={() => setTimeFilter('month')}
            className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${
              timeFilter === 'month'
                ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'text-white/50 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            Needs Work
          </button>
        </div>

        {/* Performance Summary Card */}
        <Card className="mb-6 rounded-xl bg-white/10 border border-white/20 p-3 text-center backdrop-blur-sm">
          <p className="text-white/80 text-sm">
            🔥 You've improved <span className="text-emerald-400 font-semibold">+{Math.max(0, statistics.avgScore - 50)}</span> Swingscore in your last <span className="text-emerald-400 font-semibold">{Math.min(10, swings.length)}</span> swings!
          </p>
        </Card>

        {/* 2-Column Swing Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {swings.map((swing, index) => {
            const date = swing.created_at ? new Date(swing.created_at) : new Date();
            const isNew = isSwingNew(swing);
            const isBest = swing.score_phase1 === Math.max(...swings.filter(s => s.score_phase1).map(s => s.score_phase1!));
            
            return (
              <Card
                key={swing.id}
                onClick={() => handleSwingTap(swing.id)}
                className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] cursor-pointer hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95 transition-all backdrop-blur-sm animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Video Thumbnail */}
                <div className="relative aspect-[4/3] bg-gradient-to-b from-white/10 to-transparent rounded-t-2xl overflow-hidden border-b border-white/10">
                  {swing.video_url ? (
                    <video 
                      src={swing.video_url}
                      className="w-full h-full object-cover"
                      preload="metadata"
                      playsInline
                      muted
                      crossOrigin="anonymous"
                      onError={(e) => {
                        console.log('Video thumbnail load error:', swing.video_url);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-12 h-12 text-white/40" />
                    </div>
                  )}
                  {/* Fallback play icon if video doesn't load */}
                  {swing.video_url && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Play className="w-12 h-12 text-white/60" />
                    </div>
                  )}
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
                  {isBest && (
                    <Badge className="absolute top-2 right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 shadow-[0_0_15px_rgba(251,191,36,0.6)] text-xs">
                      🏆 Best
                    </Badge>
                  )}
                  {isNew && !isBest && (
                    <Badge className="absolute top-2 right-2 bg-emerald-500/80 text-white border-0 text-xs">
                      New
                    </Badge>
                  )}
                </div>

                {/* Card Content */}
                <div className="p-3">
                  {/* Score */}
                  {swing.score_phase1 !== null && (
                    <div className={`text-3xl font-bold mb-2 ${
                      swing.score_phase1 >= 70 ? 'text-emerald-400' : swing.score_phase1 >= 50 ? 'text-white' : 'text-red-400'
                    }`}>
                      {swing.score_phase1}
                    </div>
                  )}
                  
                  {/* Date & Status */}
                  <div className="text-white/60 text-xs mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="text-white/40 text-xs">
                    · Analyzed
                  </div>
                  
                  {/* Drill Name */}
                  {swing.cues?.[0] && (
                    <div className="text-white text-xs mt-2 line-clamp-2 italic">
                      "{swing.cues[0]}"
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        {/* Bottom Action Button */}
        <Button 
          onClick={() => navigate('/analysis')} 
          className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white py-6 text-lg font-semibold rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:shadow-[0_0_35px_rgba(16,185,129,0.6)] transition-all"
        >
          + Upload Swing
        </Button>
      </div>
    </div>
  );
}