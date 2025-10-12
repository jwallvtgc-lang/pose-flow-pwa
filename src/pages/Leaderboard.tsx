import { useState, useEffect } from 'react';
import { Trophy, Medal, Award, TrendingUp, Target, Activity, ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  rank: number;
}

type LeaderboardType = 'total_swings' | 'average_score' | 'max_score';

export default function Leaderboard() {
  const navigate = useNavigate();
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
      <div className="space-y-6">
        {entries.map((entry) => (
          <Card key={entry.user_id} className="p-6 hover:shadow-lg transition-all duration-200 rounded-3xl bg-white">
            <div className="flex items-center gap-4">
              {/* Rank */}
              <div className="flex-shrink-0">
                {getRankIcon(entry.rank)}
              </div>
              
              {/* Player Info */}
              <div className="flex-1 min-w-0">
                <div className="mb-2">
                  <h3 className="text-lg font-anton font-black text-gray-900 leading-tight">
                    {entry.full_name}
                  </h3>
                </div>
                <div className="flex flex-col gap-1">
                  {entry.current_team && (
                    <Badge variant="secondary" className="text-xs rounded-full w-fit bg-blue-100 text-blue-700 border-0">
                      {entry.current_team}
                    </Badge>
                  )}
                  {entry.primary_position && (
                    <p className="text-sm font-medium text-gray-600">{entry.primary_position}</p>
                  )}
                </div>
              </div>
              
              {/* Stats */}
              <div className="text-right flex-shrink-0">
                <div className="text-2xl font-anton font-black text-blue-600 mb-1">
                  {tabInfo.getValue(entry)}
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  <div>{entry.total_swings} total swings</div>
                  <div>{entry.max_score} best score</div>
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
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6 max-w-lg">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="h-6 bg-muted rounded animate-pulse w-32"></div>
          </div>
          
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="p-6 rounded-3xl">
                <div className="animate-pulse flex items-center gap-4">
                  <div className="w-12 h-12 bg-muted rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                  <div className="w-16 h-8 bg-muted rounded"></div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="h-10 w-10 p-0 rounded-2xl">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-anton font-black text-gray-900">Leaderboard</h1>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LeaderboardType)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white rounded-3xl p-1 shadow-lg h-12">
            <TabsTrigger value="total_swings" className="rounded-2xl data-[state=active]:bg-blue-500 data-[state=active]:text-white text-xs sm:text-sm h-10 px-3">
              <Activity className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Most Active</span>
              <span className="sm:hidden">Active</span>
            </TabsTrigger>
            <TabsTrigger value="average_score" className="rounded-2xl data-[state=active]:bg-blue-500 data-[state=active]:text-white text-xs sm:text-sm h-10 px-3">
              <Target className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Best Average</span>
              <span className="sm:hidden">Average</span>
            </TabsTrigger>
            <TabsTrigger value="max_score" className="rounded-2xl data-[state=active]:bg-blue-500 data-[state=active]:text-white text-xs sm:text-sm h-10 px-3">
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Highest Score</span>
              <span className="sm:hidden">Best</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="total_swings" className="space-y-6">
            {leaderboards.total_swings.length > 0 ? (
              renderLeaderboard(leaderboards.total_swings, 'total_swings')
            ) : (
              <Card className="p-8 text-center rounded-3xl bg-white">
                <div className="text-gray-400 mb-2">
                  <Activity className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-500 font-medium">No data available for the last 30 days</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="average_score" className="space-y-6">
            {leaderboards.average_score.length > 0 ? (
              renderLeaderboard(leaderboards.average_score, 'average_score')
            ) : (
              <Card className="p-8 text-center rounded-3xl bg-white">
                <div className="text-gray-400 mb-2">
                  <Target className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-500 font-medium">No data available for the last 30 days</p>
                <p className="text-sm text-gray-400 mt-1">Minimum 3 swings required</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="max_score" className="space-y-6">
            {leaderboards.max_score.length > 0 ? (
              renderLeaderboard(leaderboards.max_score, 'max_score')
            ) : (
              <Card className="p-8 text-center rounded-3xl bg-white">
                <div className="text-gray-400 mb-2">
                  <TrendingUp className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-500 font-medium">No data available for the last 30 days</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}