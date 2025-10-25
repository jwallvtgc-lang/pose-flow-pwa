import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, TrendingDown, Plus, Home, Target, Award, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
      
      // Query for leaderboard data
      const { data: swingData, error } = await supabase
        .from('swings')
        .select(`
          id,
          score_phase1,
          bat_speed_peak,
          bat_speed_avg,
          created_at,
          session_id
        `)
        .gte('created_at', dateFilter.toISOString())
        .not('score_phase1', 'is', null)
        .gt('score_phase1', 0);

      if (error) {
        console.error('Error loading leaderboard data:', error);
        return;
      }

      // Get all user profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, current_team, primary_position, avatar_url');

      if (profileError) {
        console.error('Error loading profiles:', profileError);
      }

      // Process data to create leaderboard
      const userStats = new Map<string, {
        user_id: string;
        full_name: string;
        current_team?: string;
        primary_position?: string;
        avatar_url?: string;
        scores: number[];
        batSpeeds: number[];
      }>();
      
      if (!user || !swingData || swingData.length === 0) {
        setEntries([]);
        return;
      }

      const currentUserProfile = profiles?.find(p => p.id === user.id);
      
      if (currentUserProfile) {
        const validScores = swingData.map(swing => swing.score_phase1).filter((score): score is number => score !== null);
        const validBatSpeeds = swingData
          .map(swing => swing.bat_speed_peak)
          .filter((speed): speed is number => speed !== null && speed > 0);
        
        userStats.set(user.id, {
          user_id: user.id,
          full_name: currentUserProfile.full_name || 'Unknown Player',
          current_team: currentUserProfile?.current_team || undefined,
          primary_position: currentUserProfile?.primary_position || undefined,
          avatar_url: currentUserProfile?.avatar_url || undefined,
          scores: validScores,
          batSpeeds: validBatSpeeds
        });
      }

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
      <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-black">
        <div className="px-4 py-6 max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">🏆 Leaderboard</h1>
            <p className="text-white/60 text-sm">Loading...</p>
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/10 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-white/10 rounded w-1/2"></div>
                    <div className="h-3 bg-white/10 rounded w-1/3"></div>
                  </div>
                  <div className="w-12 h-8 bg-white/10 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-black pb-32">
      <div className="px-4 py-6 max-w-2xl mx-auto">
        {/* HEADER */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">🏆 Leaderboard</h1>
          <p className="text-white/60 text-sm">
            {timeFilter === 'week' ? "This Week's Top Swings" : timeFilter === 'alltime' ? "All-Time Champions" : "My Team Rankings"}
          </p>
        </div>

        {/* TIME FILTER */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <button
            onClick={() => setTimeFilter('week')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
              timeFilter === 'week'
                ? 'bg-green-500/20 text-green-400 border border-green-500/40 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'text-white/50 hover:text-white/70 bg-white/5 border border-white/10'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setTimeFilter('alltime')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
              timeFilter === 'alltime'
                ? 'bg-green-500/20 text-green-400 border border-green-500/40 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'text-white/50 hover:text-white/70 bg-white/5 border border-white/10'
            }`}
          >
            All-Time
          </button>
          <button
            onClick={() => setTimeFilter('team')}
            className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
              timeFilter === 'team'
                ? 'bg-green-500/20 text-green-400 border border-green-500/40 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'text-white/50 hover:text-white/70 bg-white/5 border border-white/10'
            }`}
          >
            My Team
          </button>
        </div>

        {/* METRIC FILTER */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="text-white/40 text-xs">Ranked by:</span>
          <button
            onClick={() => setMetricFilter('score')}
            className={`text-sm font-medium transition-all ${
              metricFilter === 'score'
                ? 'text-green-400 border-b-2 border-green-400 pb-1'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            Overall Score
          </button>
          <button
            onClick={() => setMetricFilter('swings')}
            className={`text-sm font-medium transition-all ${
              metricFilter === 'swings'
                ? 'text-green-400 border-b-2 border-green-400 pb-1'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            Swings
          </button>
          <button
            onClick={() => setMetricFilter('speed')}
            className={`text-sm font-medium transition-all ${
              metricFilter === 'speed'
                ? 'text-green-400 border-b-2 border-green-400 pb-1'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            Bat Speed
          </button>
        </div>

        {/* LEADERBOARD LIST */}
        <div className="space-y-2">
          {entries.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-white/40" />
              <p className="text-white font-semibold mb-2">No Data Yet</p>
              <p className="text-white/60 text-sm">Record some swings to see the leaderboard</p>
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
                  className={`rounded-2xl p-4 mb-2 shadow-lg flex items-center justify-between transition-all ${
                    isCurrentUser
                      ? 'bg-white/10 border border-green-500/40'
                      : 'bg-white/5 border border-white/10'
                  } ${isTop3 ? 'ring-2 ring-offset-2 ring-offset-transparent' : ''} ${
                    entry.rank === 1 ? 'ring-yellow-500/40' :
                    entry.rank === 2 ? 'ring-gray-400/40' :
                    entry.rank === 3 ? 'ring-amber-600/40' : ''
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* LEFT SIDE */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Rank */}
                    <div className={`w-8 font-bold text-center ${
                      entry.rank === 1 ? 'text-yellow-400' :
                      entry.rank === 2 ? 'text-gray-300' :
                      entry.rank === 3 ? 'text-amber-500' :
                      'text-white/40'
                    }`}>
                      #{entry.rank}
                    </div>
                    
                    {/* Avatar */}
                    <Avatar className={`w-10 h-10 border ${
                      entry.rank === 1 ? 'border-yellow-500 ring-2 ring-yellow-500/20' :
                      entry.rank === 2 ? 'border-gray-300 ring-2 ring-gray-300/20' :
                      entry.rank === 3 ? 'border-amber-500 ring-2 ring-amber-500/20' :
                      'border-white/10'
                    }`}>
                      <AvatarImage src={entry.avatar_url} />
                      <AvatarFallback className="bg-white/10 text-white text-sm">
                        {entry.full_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold truncate">{entry.full_name}</span>
                        {isCurrentUser && (
                          <span className="rounded-sm bg-white/10 text-white/70 text-[10px] px-1.5 py-[2px]">
                            You
                          </span>
                        )}
                      </div>
                      {(entry.current_team || entry.primary_position) && (
                        <p className="text-white/40 text-xs">
                          {entry.current_team && entry.primary_position 
                            ? `${entry.current_team} · ${entry.primary_position}`
                            : entry.current_team || entry.primary_position}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* RIGHT SIDE */}
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      entry.rank <= 3 ? 'text-green-400' : 'text-white'
                    }`}>
                      {metricValue}{metricLabel && ` ${metricLabel}`}
                    </div>
                    {entry.trend !== undefined && entry.trend !== 0 && (
                      <div className={`text-[11px] flex items-center justify-end gap-0.5 ${
                        entry.trend > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {entry.trend > 0 ? (
                          <>
                            <TrendingUp className="w-3 h-3" />
                            +{entry.trend}
                          </>
                        ) : (
                          <>
                            <TrendingDown className="w-3 h-3" />
                            {entry.trend}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* MOTIVATION FOOTER */}
        {entries.length > 0 && (
          <div className="mt-6 bg-white/10 border border-white/20 rounded-2xl p-4 text-center shadow-lg">
            <p className="text-white text-sm">{getMotivationText()}</p>
          </div>
        )}
      </div>

      {/* BOTTOM NAVIGATION */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0f172a]/95 backdrop-blur-lg border-t border-white/10 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-around py-3 px-4">
          <button onClick={() => navigate('/')} className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors">
            <Home className="w-5 h-5" />
            <span className="text-xs">Home</span>
          </button>
          <button onClick={() => navigate('/swings')} className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors">
            <Target className="w-5 h-5" />
            <span className="text-xs">Swings</span>
          </button>
          <button onClick={() => navigate('/drills')} className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors">
            <Award className="w-5 h-5" />
            <span className="text-xs">Drills</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-green-400 transition-colors">
            <Trophy className="w-5 h-5" />
            <span className="text-xs font-semibold">Leaderboard</span>
          </button>
          <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors">
            <User className="w-5 h-5" />
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </div>

      {/* FLOATING UPLOAD BUTTON */}
      <Button
        onClick={() => navigate('/swing-analysis')}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all hover:scale-110 z-50"
      >
        <Plus className="w-6 h-6 text-white" />
      </Button>
    </div>
  );
}
