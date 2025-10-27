import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, TrendingDown, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Header } from '@/components/Header';

interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  current_team?: string;
  primary_position?: string;
  avatar_url?: string;
  total_swings: number;
  average_score: number;
  max_score: number;
  average_bat_speed: number;
  rank: number;
  trend?: number; // +/- change from previous period
}

type TimeFilter = 'week' | 'alltime' | 'team';
type MetricFilter = 'score' | 'swings' | 'speed';

export default function Leaderboard() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('week');
  const [metricFilter, setMetricFilter] = useState<MetricFilter>('score');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [timeFilter, metricFilter]);

  const loadLeaderboard = async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      
      // Calculate date based on time filter
      let dateFilter = new Date();
      if (timeFilter === 'week') {
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (timeFilter === 'alltime') {
        dateFilter = new Date('2020-01-01'); // Far back date for all-time
      }
      
      // Query for swings with sessions and athletes to get user_id
      const { data: swingData, error } = await supabase
        .from('swings')
        .select(`
          id,
          score_phase1,
          bat_speed_peak,
          bat_speed_avg,
          created_at,
          sessions!inner(
            athlete_id,
            athletes!inner(
              user_id
            )
          )
        `)
        .gte('created_at', dateFilter.toISOString())
        .not('score_phase1', 'is', null)
        .gt('score_phase1', 0);

      if (error) {
        console.error('Error loading leaderboard data:', error);
        setEntries([]);
        return;
      }

      if (!swingData || swingData.length === 0) {
        setEntries([]);
        return;
      }

      // Get all user profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, current_team, primary_position, avatar_url');

      if (profileError) {
        console.error('Error loading profiles:', profileError);
      }

      // Process data to create leaderboard grouped by user
      const userStats = new Map<string, {
        user_id: string;
        full_name: string;
        current_team?: string;
        primary_position?: string;
        avatar_url?: string;
        scores: number[];
        batSpeeds: number[];
      }>();
      
      // Group swings by user
      swingData.forEach((swing: any) => {
        const userId = swing.sessions?.athletes?.user_id;
        if (!userId) return;

        const score = swing.score_phase1;
        const batSpeed = swing.bat_speed_peak;

        if (!userStats.has(userId)) {
          const profile = profiles?.find(p => p.id === userId);
          userStats.set(userId, {
            user_id: userId,
            full_name: profile?.full_name || 'Unknown Player',
            current_team: profile?.current_team || undefined,
            primary_position: profile?.primary_position || undefined,
            avatar_url: profile?.avatar_url || undefined,
            scores: [],
            batSpeeds: []
          });
        }

        const stats = userStats.get(userId)!;
        if (score !== null && score > 0) {
          stats.scores.push(score);
        }
        if (batSpeed !== null && batSpeed > 0) {
          stats.batSpeeds.push(batSpeed);
        }
      });

      // Create leaderboard entries
      let leaderboardEntries: LeaderboardEntry[] = Array.from(userStats.values()).map(user => ({
        user_id: user.user_id,
        full_name: user.full_name,
        current_team: user.current_team,
        primary_position: user.primary_position,
        avatar_url: user.avatar_url,
        total_swings: user.scores.length,
        average_score: user.scores.length > 0 ? 
          Math.round((user.scores.reduce((sum, score) => sum + score, 0) / user.scores.length)) : 0,
        max_score: user.scores.length > 0 ? Math.max(...user.scores) : 0,
        average_bat_speed: user.batSpeeds.length > 0 ?
          Math.round((user.batSpeeds.reduce((sum, speed) => sum + speed, 0) / user.batSpeeds.length)) : 0,
        rank: 0,
        trend: Math.floor(Math.random() * 7) - 3 // Mock trend data for now
      }));

      // Sort based on selected metric
      if (metricFilter === 'score') {
        leaderboardEntries = leaderboardEntries
          .filter(e => e.total_swings >= 3)
          .sort((a, b) => b.average_score - a.average_score);
      } else if (metricFilter === 'swings') {
        leaderboardEntries = leaderboardEntries
          .sort((a, b) => b.total_swings - a.total_swings);
      } else if (metricFilter === 'speed') {
        leaderboardEntries = leaderboardEntries
          .filter(e => e.average_bat_speed > 0 && e.total_swings >= 3)
          .sort((a, b) => b.average_bat_speed - a.average_bat_speed);
      }

      // Assign ranks and take top 10
      const rankedEntries = leaderboardEntries
        .slice(0, 10)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      setEntries(rankedEntries);

    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMetricValue = (entry: LeaderboardEntry) => {
    if (metricFilter === 'score') return entry.average_score;
    if (metricFilter === 'swings') return entry.total_swings;
    if (metricFilter === 'speed') return entry.average_bat_speed;
    return entry.average_score;
  };

  const getMetricLabel = () => {
    if (metricFilter === 'score') return '';
    if (metricFilter === 'swings') return 'swings';
    if (metricFilter === 'speed') return 'mph';
    return '';
  };

  const getMotivationText = () => {
    const currentUser = entries.find(e => e.user_id === currentUserId);
    if (!currentUser) return "💪 Record swings to join the leaderboard!";
    
    const nextPlayer = entries.find(e => e.rank === currentUser.rank - 1);
    if (!nextPlayer) return "🏆 You're at the top! Keep it up!";
    
    const gap = getMetricValue(nextPlayer) - getMetricValue(currentUser);
    const metricName = metricFilter === 'score' ? 'Overall Score' : metricFilter === 'swings' ? 'Swings' : 'Bat Speed';
    
    return `💪 You're #${currentUser.rank} in ${metricName} — increase by ${gap > 0 ? `+${Math.ceil(gap)}` : '1'} ${getMetricLabel()} to pass #${nextPlayer.rank}.`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-black relative">
        {/* Vignette overlay */}
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />
        
        <div className="px-4 py-6 max-w-2xl mx-auto relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <Trophy className="w-8 h-8 text-yellow-400 animate-pulse" />
              <h1 className="text-2xl font-bold text-white/90 tracking-tight">Leaderboard</h1>
            </div>
            <p className="text-white/60 text-sm">Loading rankings...</p>
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-lg animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/10 rounded w-1/2"></div>
                    <div className="h-3 bg-white/10 rounded w-1/3"></div>
                  </div>
                  <div className="w-16 h-8 bg-white/10 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-black pb-28 relative">
      {/* Vignette overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />
      
      {/* Subtle shimmer background */}
      <div className="fixed inset-0 opacity-30 pointer-events-none" style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.05) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer-slow 30s linear infinite'
      }} />
      
      {/* HEADER */}
      <div className="sticky top-0 z-50 bg-gradient-to-b from-[#0F172A]/95 to-black/95 backdrop-blur-xl text-white safe-area-top border-b border-white/10">
        <div className="container mx-auto px-4 py-4 max-w-2xl">
          <Header 
            leftAction={
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/')}
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            }
            rightAction={<div className="w-8" />}
          />
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto relative z-10">
        {/* TITLE */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="relative">
              <Trophy className="w-8 h-8 text-yellow-400" style={{
                filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))'
              }} />
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 opacity-20 blur-xl rounded-full" />
            </div>
            <h1 className="text-2xl font-bold text-white/90 tracking-tight">Leaderboard</h1>
          </div>
          <p className="text-white/60 text-sm mb-4">
            {timeFilter === 'week' ? "This Week's Top Swings" : timeFilter === 'alltime' ? "All-Time Champions" : "My Team Rankings"}
          </p>
          {/* Divider glow line */}
          <div className="flex justify-center">
            <div className="h-[1px] w-4/5 bg-gradient-to-r from-transparent via-green-500/40 to-transparent" />
          </div>
        </div>

        {/* TIME FILTER */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            onClick={() => setTimeFilter('week')}
            className={`px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all duration-200 ${
              timeFilter === 'week'
                ? 'bg-green-500/20 text-green-300 border border-green-400/60 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-105'
                : 'text-white/50 hover:text-white/80 bg-white/5 border border-white/10 hover:bg-white/10'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setTimeFilter('alltime')}
            className={`px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all duration-200 ${
              timeFilter === 'alltime'
                ? 'bg-green-500/20 text-green-300 border border-green-400/60 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-105'
                : 'text-white/50 hover:text-white/80 bg-white/5 border border-white/10 hover:bg-white/10'
            }`}
          >
            All-Time
          </button>
          <button
            onClick={() => setTimeFilter('team')}
            className={`px-5 py-2.5 rounded-2xl font-semibold text-sm transition-all duration-200 ${
              timeFilter === 'team'
                ? 'bg-green-500/20 text-green-300 border border-green-400/60 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-105'
                : 'text-white/50 hover:text-white/80 bg-white/5 border border-white/10 hover:bg-white/10'
            }`}
          >
            My Team
          </button>
        </div>

        {/* METRIC FILTER */}
        <div className="mb-8">
          <p className="text-center text-white/50 text-xs mb-3">Ranked by:</p>
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => setMetricFilter('score')}
              className={`text-sm font-medium transition-all duration-250 pb-2 relative ${
                metricFilter === 'score'
                  ? 'text-green-300 font-semibold'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              Overall Score
              {metricFilter === 'score' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-green-400 rounded-full animate-slide-in" />
              )}
            </button>
            <button
              onClick={() => setMetricFilter('swings')}
              className={`text-sm font-medium transition-all duration-250 pb-2 relative ${
                metricFilter === 'swings'
                  ? 'text-green-300 font-semibold'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              Swings
              {metricFilter === 'swings' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-green-400 rounded-full animate-slide-in" />
              )}
            </button>
            <button
              onClick={() => setMetricFilter('speed')}
              className={`text-sm font-medium transition-all duration-250 pb-2 relative ${
                metricFilter === 'speed'
                  ? 'text-green-300 font-semibold'
                  : 'text-white/50 hover:text-white/70'
              }`}
            >
              Bat Speed
              {metricFilter === 'speed' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-green-400 rounded-full animate-slide-in" />
              )}
            </button>
          </div>
        </div>

        {/* LEADERBOARD LIST */}
        <div className="space-y-3">
          {entries.length === 0 ? (
            <div className="rounded-2xl bg-white/5 border border-white/10 shadow-lg p-8 text-center max-w-md mx-auto">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-white/20" />
              <p className="text-white/80 font-semibold text-lg mb-2">No Swings Yet</p>
              <p className="text-white/50 text-sm mb-4">Upload your first swing to unlock the leaderboard!</p>
              <button 
                onClick={() => navigate('/swing-analysis')}
                className="text-green-400 text-sm underline hover:opacity-80 transition-opacity"
              >
                Get started now
              </button>
            </div>
          ) : (
            entries.map((entry, index) => {
              const isCurrentUser = entry.user_id === currentUserId;
              const isTop3 = entry.rank <= 3;
              const metricValue = getMetricValue(entry);
              const metricLabel = getMetricLabel();
              
              return (
                <div
                  key={entry.user_id}
                  className={`relative rounded-2xl p-5 transition-all duration-200 ${
                    isCurrentUser
                      ? 'bg-white/10 border border-green-500/40 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                      : 'bg-white/5 border border-white/10 shadow-[0_0_10px_rgba(255,255,255,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                  } ${isTop3 ? 'ring-1 ring-offset-2 ring-offset-transparent' : ''} ${
                    entry.rank === 1 ? 'ring-yellow-500/30' :
                    entry.rank === 2 ? 'ring-gray-400/30' :
                    entry.rank === 3 ? 'ring-amber-600/30' : ''
                  }`}
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  {/* Rank watermark */}
                  <div className="absolute left-3 top-1 text-[48px] font-black text-white/5 leading-none pointer-events-none">
                    {entry.rank}
                  </div>
                  
                  {/* Top 3 gradient glow */}
                  {isTop3 && (
                    <div className={`absolute inset-0 rounded-2xl opacity-10 pointer-events-none ${
                      entry.rank === 1 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                      entry.rank === 2 ? 'bg-gradient-to-r from-gray-300 to-gray-500' :
                      'bg-gradient-to-r from-amber-400 to-amber-700'
                    }`} />
                  )}
                  
                  <div className="relative flex items-center justify-between">
                    {/* LEFT SIDE */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Rank number */}
                      <div className={`text-sm font-bold ${
                        entry.rank === 1 ? 'text-yellow-400' :
                        entry.rank === 2 ? 'text-gray-300' :
                        entry.rank === 3 ? 'text-amber-500' :
                        'text-white/40'
                      }`}>
                        #{entry.rank}
                      </div>
                      
                      {/* Avatar */}
                      <Avatar className={`w-12 h-12 border-2 ${
                        entry.rank === 1 ? 'border-yellow-400 ring-4 ring-yellow-500/20' :
                        entry.rank === 2 ? 'border-gray-300 ring-4 ring-gray-300/20' :
                        entry.rank === 3 ? 'border-amber-500 ring-4 ring-amber-500/20' :
                        'border-white/20'
                      }`}>
                        <AvatarImage src={entry.avatar_url} />
                        <AvatarFallback className="bg-white/10 text-white/90 text-base font-semibold">
                          {entry.full_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* Player Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-white/90 font-semibold text-base truncate">{entry.full_name}</span>
                          {isCurrentUser && (
                            <span className="rounded-full bg-green-500/20 text-green-300 text-[10px] font-medium px-2 py-0.5">
                              You
                            </span>
                          )}
                        </div>
                        {(entry.current_team || entry.primary_position) && (
                          <p className="text-white/50 text-xs">
                            {entry.current_team && entry.primary_position 
                              ? `${entry.current_team} · ${entry.primary_position}`
                              : entry.current_team || entry.primary_position}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* RIGHT SIDE - Score */}
                    <div className="text-right ml-4">
                      <div 
                        className={`text-lg font-bold ${
                          entry.rank <= 3 ? 'text-green-400' : 'text-white/90'
                        }`}
                        style={entry.rank <= 3 ? {
                          filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))'
                        } : {}}
                      >
                        {metricValue}{metricLabel && ` ${metricLabel}`}
                      </div>
                      {entry.trend !== undefined && entry.trend !== 0 && (
                        <div className={`text-[10px] flex items-center justify-end gap-1 mt-1 ${
                          entry.trend > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {entry.trend > 0 ? (
                            <>
                              <TrendingUp className="w-3 h-3" />
                              <span>+{entry.trend}</span>
                            </>
                          ) : (
                            <>
                              <TrendingDown className="w-3 h-3" />
                              <span>{entry.trend}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* MOTIVATION FOOTER */}
        {entries.length > 0 && (
          <div className="mt-8 bg-white/10 border border-white/20 rounded-2xl p-5 text-center shadow-[0_0_20px_rgba(255,255,255,0.05)]">
            <p className="text-white/90 text-sm font-medium">{getMotivationText()}</p>
          </div>
        )}
      </div>


      <style>{`
        @keyframes shimmer-slow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes slide-in {
          from {
            transform: scaleX(0);
            opacity: 0;
          }
          to {
            transform: scaleX(1);
            opacity: 1;
          }
        }

        .animate-slide-in {
          animation: slide-in 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
