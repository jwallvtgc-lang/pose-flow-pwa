import { useState, useEffect } from 'react';
import { Trophy, Medal, Award, TrendingUp, Target, Activity, ArrowLeft, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  current_team?: string;
  primary_position?: string;
  total_swings: number;
  average_score: number;
  max_score: number;
  average_bat_speed: number;
  rank: number;
}

type LeaderboardType = 'total_swings' | 'average_score' | 'max_score' | 'bat_speed';

export default function Leaderboard() {
  const navigate = useNavigate();
  const [leaderboards, setLeaderboards] = useState<Record<LeaderboardType, LeaderboardEntry[]>>({
    total_swings: [],
    average_score: [],
    max_score: [],
    bat_speed: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<LeaderboardType>('total_swings');

  useEffect(() => {
    loadLeaderboards();
  }, []);

  const loadLeaderboards = async () => {
    try {
      setIsLoading(true);
      
      // Calculate date 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Query for leaderboard data - work directly with user data
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
        .gte('created_at', thirtyDaysAgo.toISOString())
        .not('score_phase1', 'is', null)
        .gt('score_phase1', 0);

      if (error) {
        console.error('Error loading leaderboard data:', error);
        return;
      }

      // Get all user profiles for team/position info
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, current_team, primary_position');

      if (profileError) {
        console.error('Error loading profiles:', profileError);
      }

      // Since we don't have proper athlete-user linkage, we'll show the current user's swings
      // This is a temporary solution until the athlete linking is fixed  
      const { data: { user } } = await supabase.auth.getUser();
      
      // Process the data to create leaderboards
      const userStats = new Map<string, {
        user_id: string;
        full_name: string;
        current_team?: string;
        primary_position?: string;
        scores: number[];
        batSpeeds: number[];
      }>();
      
      if (!user) {
        console.log('No authenticated user found');
        return;
      }

      const currentUserProfile = profiles?.find(p => p.id === user.id);
      
      if (currentUserProfile && swingData && swingData.length > 0) {
        // For now, attribute all swings to the current authenticated user
        // since we can't properly link swings to users through athletes table
        const validScores = swingData.map(swing => swing.score_phase1).filter((score): score is number => score !== null);
        const validBatSpeeds = swingData
          .map(swing => swing.bat_speed_peak)
          .filter((speed): speed is number => speed !== null && speed > 0);
        
        userStats.set(user.id, {
          user_id: user.id,
          full_name: currentUserProfile.full_name || 'Unknown Player',
          current_team: currentUserProfile?.current_team || undefined,
          primary_position: currentUserProfile?.primary_position || undefined,
          scores: validScores,
          batSpeeds: validBatSpeeds
        });
      }

      // Create leaderboard entries
      const entries: LeaderboardEntry[] = Array.from(userStats.values()).map(user => ({
        user_id: user.user_id,
        full_name: user.full_name,
        current_team: user.current_team || undefined,
        primary_position: user.primary_position || undefined,
        total_swings: user.scores.length,
        average_score: user.scores.length > 0 ? 
          Math.round((user.scores.reduce((sum, score) => sum + score, 0) / user.scores.length) * 10) / 10 : 0,
        max_score: user.scores.length > 0 ? Math.max(...user.scores) : 0,
        average_bat_speed: user.batSpeeds.length > 0 ?
          Math.round((user.batSpeeds.reduce((sum, speed) => sum + speed, 0) / user.batSpeeds.length) * 10) / 10 : 0,
        rank: 0 // Will be set below
      })).filter(entry => entry.total_swings > 0);

      // Create separate leaderboards
      const totalSwingsLeaderboard = [...entries]
        .sort((a, b) => b.total_swings - a.total_swings)
        .slice(0, 10)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      const averageScoreLeaderboard = [...entries]
        .filter(entry => entry.total_swings >= 3) // Minimum 3 swings for average
        .sort((a, b) => b.average_score - a.average_score)
        .slice(0, 10)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      const maxScoreLeaderboard = [...entries]
        .sort((a, b) => b.max_score - a.max_score)
        .slice(0, 10)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      const batSpeedLeaderboard = [...entries]
        .filter(entry => entry.average_bat_speed > 0 && entry.total_swings >= 3)
        .sort((a, b) => b.average_bat_speed - a.average_bat_speed)
        .slice(0, 10)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));

      setLeaderboards({
        total_swings: totalSwingsLeaderboard,
        average_score: averageScoreLeaderboard,
        max_score: maxScoreLeaderboard,
        bat_speed: batSpeedLeaderboard
      });

    } catch (error) {
      console.error('Failed to load leaderboards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg animate-pulse-soft">
            <Trophy className="w-8 h-8 text-white" />
          </div>
        );
      case 2:
        return (
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center shadow-lg">
            <Medal className="w-7 h-7 text-white" />
          </div>
        );
      case 3:
        return (
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center shadow-lg">
            <Award className="w-7 h-7 text-white" />
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-lg font-black text-white shadow-md">
            {rank}
          </div>
        );
    }
  };

  const renderLeaderboard = (entries: LeaderboardEntry[], type: LeaderboardType) => {
    return (
      <div className="space-y-4">
        {entries.map((entry, index) => (
          <Card 
            key={entry.user_id} 
            className="p-5 shadow-sm transition-all duration-300 rounded-2xl bg-white hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] card-tilt animate-fade-in-up overflow-hidden relative"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Top 3 background gradient */}
            {entry.rank <= 3 && (
              <div className={`absolute inset-0 opacity-5 ${
                entry.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-orange-500' :
                entry.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                'bg-gradient-to-br from-amber-400 to-amber-700'
              }`}></div>
            )}
            
            <div className="flex items-center gap-4 relative z-10">
              {/* Rank Icon */}
              <div className="flex-shrink-0 animate-bounce-subtle">
                {getRankIcon(entry.rank)}
              </div>
              
              {/* Player Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-black text-gray-900 leading-tight mb-1">
                  {entry.full_name}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {entry.current_team && (
                    <Badge className="text-xs rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 px-2 py-0.5">
                      {entry.current_team}
                    </Badge>
                  )}
                  {entry.primary_position && (
                    <span className="text-xs font-semibold text-gray-500">{entry.primary_position}</span>
                  )}
                </div>
              </div>
              
              {/* Stats */}
              <div className="text-right flex-shrink-0">
                <div className={`text-3xl font-black mb-1 ${
                  entry.rank === 1 ? 'text-yellow-500' :
                  entry.rank === 2 ? 'text-gray-400' :
                  entry.rank === 3 ? 'text-amber-600' :
                  'bg-gradient-to-br from-blue-500 to-purple-600 bg-clip-text text-transparent'
                }`}>
                  {type === 'total_swings' && entry.total_swings}
                  {type === 'average_score' && entry.average_score}
                  {type === 'max_score' && entry.max_score}
                  {type === 'bat_speed' && entry.average_bat_speed}
                </div>
                <div className="text-xs font-bold text-gray-500">
                  {type === 'total_swings' && 'swings'}
                  {type === 'average_score' && 'avg'}
                  {type === 'max_score' && 'max'}
                  {type === 'bat_speed' && 'mph'}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        {/* Gradient Header */}
        <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 pt-safe rounded-b-[2rem] pb-8 px-6 shadow-lg relative overflow-hidden shimmer-bg">
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="h-10 w-10 p-0 text-white hover:bg-white/20">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-3xl font-black text-white tracking-tight">Leaderboard</h1>
            <div className="w-10"></div>
          </div>
        </div>

        <div className="px-6 -mt-4">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="p-5 rounded-2xl shadow-sm">
                <div className="animate-pulse flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="w-16 h-8 bg-gray-200 rounded"></div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-safe">
      {/* Gradient Header with Shimmer */}
      <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 pt-safe rounded-b-[2rem] pb-6 px-6 shadow-lg relative overflow-hidden shimmer-bg sticky top-0 z-10 header-blur">
        <div className="flex items-center justify-center mb-6 relative">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/')} 
            className="absolute left-0 h-10 w-10 p-0 text-white hover:bg-white/20 rounded-xl transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-300" />
            <h1 className="text-3xl font-black text-white tracking-tight">Leaderboard</h1>
          </div>
        </div>

        {/* Tabs inside header */}
        <div className="grid grid-cols-4 gap-3">
          <button
            onClick={() => setActiveTab('total_swings')}
            className={`py-4 px-2 rounded-2xl font-semibold text-xs transition-all flex flex-col items-center gap-2 ${
              activeTab === 'total_swings'
                ? 'bg-white/20 backdrop-blur-sm text-white'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <Activity className="w-5 h-5" />
            <span>Active</span>
          </button>
          <button
            onClick={() => setActiveTab('average_score')}
            className={`py-4 px-2 rounded-2xl font-semibold text-xs transition-all flex flex-col items-center gap-2 ${
              activeTab === 'average_score'
                ? 'bg-white/20 backdrop-blur-sm text-white'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <Target className="w-5 h-5" />
            <span>Average</span>
          </button>
          <button
            onClick={() => setActiveTab('max_score')}
            className={`py-4 px-2 rounded-2xl font-semibold text-xs transition-all flex flex-col items-center gap-2 ${
              activeTab === 'max_score'
                ? 'bg-white/20 backdrop-blur-sm text-white'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span>Best</span>
          </button>
          <button
            onClick={() => setActiveTab('bat_speed')}
            className={`py-4 px-2 rounded-2xl font-semibold text-xs transition-all flex flex-col items-center gap-2 ${
              activeTab === 'bat_speed'
                ? 'bg-white/20 backdrop-blur-sm text-white'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
          >
            <Zap className="w-5 h-5" />
            <span>Speed</span>
          </button>
        </div>
      </div>

      <div className="px-6 -mt-4">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LeaderboardType)} className="space-y-6">

          <TabsContent value="total_swings">
            {leaderboards.total_swings.length > 0 ? (
              renderLeaderboard(leaderboards.total_swings, 'total_swings')
            ) : (
              <Card className="p-8 text-center rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border-0">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center animate-pulse-soft">
                  <Activity className="w-10 h-10 text-white" />
                </div>
                <p className="text-gray-900 font-bold text-lg mb-2">No Swings Yet!</p>
                <p className="text-gray-500 text-sm">Record some swings to see the leaderboard</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="average_score">
            {leaderboards.average_score.length > 0 ? (
              renderLeaderboard(leaderboards.average_score, 'average_score')
            ) : (
              <Card className="p-8 text-center rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border-0">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center animate-pulse-soft">
                  <Target className="w-10 h-10 text-white" />
                </div>
                <p className="text-gray-900 font-bold text-lg mb-2">Not Enough Data</p>
                <p className="text-gray-500 text-sm">Need at least 3 swings to show averages</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="max_score">
            {leaderboards.max_score.length > 0 ? (
              renderLeaderboard(leaderboards.max_score, 'max_score')
            ) : (
              <Card className="p-8 text-center rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border-0">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center animate-pulse-soft">
                  <TrendingUp className="w-10 h-10 text-white" />
                </div>
                <p className="text-gray-900 font-bold text-lg mb-2">No High Scores Yet!</p>
                <p className="text-gray-500 text-sm">Start swinging to compete for the top spot</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="bat_speed">
            {leaderboards.bat_speed.length > 0 ? (
              renderLeaderboard(leaderboards.bat_speed, 'bat_speed')
            ) : (
              <Card className="p-8 text-center rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border-0">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center animate-pulse-soft">
                  <Zap className="w-10 h-10 text-white" />
                </div>
                <p className="text-gray-900 font-bold text-lg mb-2">No Speed Data!</p>
                <p className="text-gray-500 text-sm">Need at least 3 swings with speed tracking</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}