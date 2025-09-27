import { useState, useEffect } from 'react';
import { Trophy, Medal, Award, TrendingUp, Target, Activity } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  current_team?: string;
  primary_position?: string;
  total_swings: number;
  average_score: number;
  max_score: number;
  rank: number;
}

type LeaderboardType = 'total_swings' | 'average_score' | 'max_score';

export default function Leaderboard() {
  const [leaderboards, setLeaderboards] = useState<Record<LeaderboardType, LeaderboardEntry[]>>({
    total_swings: [],
    average_score: [],
    max_score: []
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
        
        userStats.set(user.id, {
          user_id: user.id,
          full_name: currentUserProfile.full_name || 'Unknown Player',
          current_team: currentUserProfile?.current_team || undefined,
          primary_position: currentUserProfile?.primary_position || undefined,
          scores: validScores
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

      setLeaderboards({
        total_swings: totalSwingsLeaderboard,
        average_score: averageScoreLeaderboard,
        max_score: maxScoreLeaderboard
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
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">{rank}</div>;
    }
  };

  const getTabInfo = (type: LeaderboardType) => {
    switch (type) {
      case 'total_swings':
        return {
          title: 'Most Active',
          subtitle: 'Total swings in last 30 days',
          icon: Activity,
          getValue: (entry: LeaderboardEntry) => `${entry.total_swings} swings`
        };
      case 'average_score':
        return {
          title: 'Best Average',
          subtitle: 'Average score (min. 3 swings)',
          icon: Target,
          getValue: (entry: LeaderboardEntry) => `${entry.average_score} avg`
        };
      case 'max_score':
        return {
          title: 'Highest Score',
          subtitle: 'Best single swing score',
          icon: TrendingUp,
          getValue: (entry: LeaderboardEntry) => `${entry.max_score} max`
        };
    }
  };

  const renderLeaderboard = (entries: LeaderboardEntry[], type: LeaderboardType) => {
    const tabInfo = getTabInfo(type);
    
    return (
      <div className="space-y-4">
        {entries.map((entry) => (
          <Card key={entry.user_id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              {/* Rank */}
              <div className="flex-shrink-0">
                {getRankIcon(entry.rank)}
              </div>
              
              {/* Player Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {entry.full_name}
                  </h3>
                  {entry.current_team && (
                    <Badge variant="secondary" className="text-xs">
                      {entry.current_team}
                    </Badge>
                  )}
                </div>
                {entry.primary_position && (
                  <p className="text-sm text-gray-500">{entry.primary_position}</p>
                )}
              </div>
              
              {/* Stats */}
              <div className="text-right">
                <div className="text-xl font-bold text-blue-600">
                  {tabInfo.getValue(entry)}
                </div>
                <div className="text-xs text-gray-500">
                  {entry.total_swings} total • {entry.max_score} best
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="container mx-auto px-6 py-8 max-w-4xl">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg font-medium text-gray-600">Loading leaderboards...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Trophy className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
              Leaderboard
            </h1>
          </div>
          <p className="text-lg text-gray-600">
            Top performers from the last 30 days
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LeaderboardType)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white rounded-2xl p-1 shadow-md">
            <TabsTrigger value="total_swings" className="rounded-xl data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <Activity className="w-4 h-4 mr-2" />
              Most Active
            </TabsTrigger>
            <TabsTrigger value="average_score" className="rounded-xl data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <Target className="w-4 h-4 mr-2" />
              Best Average
            </TabsTrigger>
            <TabsTrigger value="max_score" className="rounded-xl data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <TrendingUp className="w-4 h-4 mr-2" />
              Highest Score
            </TabsTrigger>
          </TabsList>

          <TabsContent value="total_swings" className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Most Active Players</h2>
              <p className="text-gray-600">Players with the most swings recorded</p>
            </div>
            {leaderboards.total_swings.length > 0 ? (
              renderLeaderboard(leaderboards.total_swings, 'total_swings')
            ) : (
              <Card className="p-8 text-center">
                <p className="text-gray-500">No data available for the last 30 days</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="average_score" className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Best Average Scores</h2>
              <p className="text-gray-600">Players with the highest average scores (minimum 3 swings)</p>
            </div>
            {leaderboards.average_score.length > 0 ? (
              renderLeaderboard(leaderboards.average_score, 'average_score')
            ) : (
              <Card className="p-8 text-center">
                <p className="text-gray-500">No data available for the last 30 days</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="max_score" className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Highest Single Scores</h2>
              <p className="text-gray-600">Players with the best individual swing scores</p>
            </div>
            {leaderboards.max_score.length > 0 ? (
              renderLeaderboard(leaderboards.max_score, 'max_score')
            ) : (
              <Card className="p-8 text-center">
                <p className="text-gray-500">No data available for the last 30 days</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}