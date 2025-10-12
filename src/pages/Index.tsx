import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, BarChart3, TrendingUp, Activity, Bell, Star, Play, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { HamburgerMenu } from "@/components/HamburgerMenu";

const Index = () => {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState({
    bestScore: 0,
    todayCount: 0,
    trendingScore: 0,
    isLoading: true
  });
  
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; current_streak: number | null } | null>(null);
  const [latestSwing, setLatestSwing] = useState<any>(null);
  const [topDrills, setTopDrills] = useState<Array<{name: string; count: number; description: string}>>([]);
  const [leaderboardRank, setLeaderboardRank] = useState<{ rank: number; totalUsers: number; averageScore: number } | null>(null);

  useEffect(() => {
    console.log('Index useEffect - auth state:', { 
      hasUser: !!user, 
      userEmail: user?.email,
      userId: user?.id,
      loading 
    });
    
    if (user) {
      console.log('User authenticated, loading data for user:', user.email);
      loadStats().catch(err => console.error('loadStats failed:', err));
      loadUserProfile().catch(err => console.error('loadUserProfile failed:', err));
      loadLatestSwing().catch(err => console.error('loadLatestSwing failed:', err));
      loadTopDrills().catch(err => console.error('loadTopDrills failed:', err));
      loadLeaderboardRank().catch(err => console.error('loadLeaderboardRank failed:', err));
    } else if (!loading) {
      console.log('No user detected, showing placeholder data (loading:', loading, ')');
      // Show placeholder data for non-authenticated users
      setStats({
        bestScore: 68,
        todayCount: 12,
        trendingScore: 64.7,
        isLoading: false
      });
      setTopDrills([
        { name: 'Hip Rotation Drill', count: 12, description: 'Fire hips first, hands last' },
        { name: 'Head Still Drill', count: 8, description: 'Keep your head stable for consistent contact' }
      ]);
      setLeaderboardRank({ rank: 1, totalUsers: 1, averageScore: 64.7 });
    } else {
      console.log('Auth is still loading...');
    }
  }, [user, loading]);

  const loadStats = async () => {
    try {
      console.log('Loading stats...');
      // Get all user swings
      const { data: swings, error: swingsError } = await supabase
        .from('swings')
        .select('id, created_at, score_phase1')
        .order('created_at', { ascending: false });

      if (swingsError) {
        console.error('Error loading swings:', swingsError);
        return;
      }

      console.log('Loaded swings:', swings?.length || 0);

      const today = new Date().toDateString();
      const validSwings = (swings || []).filter(swing => swing.score_phase1 && swing.score_phase1 > 0);
      
      // Calculate stats
      const bestScore = validSwings.length > 0 
        ? Math.max(...validSwings.map(swing => swing.score_phase1 || 0))
        : 0;
      
      const todayCount = (swings || []).filter(swing => 
        swing.created_at && new Date(swing.created_at).toDateString() === today
      ).length;
      
      // Calculate trending score (average of last 7 swings)
      const recent7Swings = validSwings.slice(0, 7);
      const trendingScore = recent7Swings.length > 0
        ? recent7Swings.reduce((sum, swing) => sum + (swing.score_phase1 || 0), 0) / recent7Swings.length
        : 0;

      setStats({
        bestScore,
        todayCount,
        trendingScore,
        isLoading: false
      });

    } catch (error) {
      console.error('Failed to load stats:', error);
      setStats(prev => ({ ...prev, isLoading: false }));
    }
  };

  const loadUserProfile = async () => {
    if (!user?.id) return;
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, current_streak')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        return;
      }

      setUserProfile(profile);
    } catch (error) {
      console.error('Failed to load user profile:', error);
    }
  };

  const loadLatestSwing = async () => {
    try {
      const { data: swing, error } = await supabase
        .from('swings')
        .select('id, created_at, score_phase1, cues')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading latest swing:', error);
        return;
      }

      setLatestSwing(swing);
    } catch (error) {
      console.error('Failed to load latest swing:', error);
    }
  };

  const loadLeaderboardRank = async () => {
    if (!user?.id) return;
    
    try {
      // Calculate date 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // Get current user's swing data from the last 30 days
      const { data: userSwings, error: swingsError } = await supabase
        .from('swings')
        .select('id, score_phase1, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .not('score_phase1', 'is', null)
        .gt('score_phase1', 0);

      if (swingsError) {
        console.error('Error loading swing data for ranking:', swingsError);
        return;
      }

      // If no swings, show as newcomer
      if (!userSwings || userSwings.length === 0) {
        setLeaderboardRank({ rank: 1, totalUsers: 1, averageScore: 0 });
        return;
      }

      // Calculate current user's average score
      const validSwings = userSwings.filter(swing => swing.score_phase1 && swing.score_phase1 > 0);
      
      if (validSwings.length === 0) {
        setLeaderboardRank({ rank: 1, totalUsers: 1, averageScore: 0 });
        return;
      }

      const userAverageScore = validSwings.reduce((sum, swing) => sum + (swing.score_phase1 || 0), 0) / validSwings.length;
      
      // Since we currently only have one user's data, they are always rank #1
      // In the future, when you have multiple users, you'd calculate the actual rank
      // by comparing against all users' average scores
      
      setLeaderboardRank({
        rank: 1, // Always #1 since you're the only active user
        totalUsers: 1, // Only counting users with recent activity
        averageScore: Math.round(userAverageScore * 10) / 10
      });

    } catch (error) {
      console.error('Failed to load leaderboard rank:', error);
      // Default to rank 1 if there's an error
      setLeaderboardRank({ rank: 1, totalUsers: 1, averageScore: 0 });
    }
  };

  const loadTopDrills = async () => {
    try {
      // Get swings from the last week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { data: swings, error } = await supabase
        .from('swings')
        .select('drill_id, drill_data')
        .gte('created_at', oneWeekAgo.toISOString())
        .not('drill_id', 'is', null)
        .or('drill_data.not.is.null');

      if (error) {
        console.error('Error loading drill data:', error);
        return;
      }

      // Count drill occurrences
      const drillCount: Record<string, {count: number; description: string}> = {};
      
      for (const swing of swings || []) {
        let drillName = '';
        let description = '';
        
        if (swing.drill_data && typeof swing.drill_data === 'object' && swing.drill_data !== null) {
          // Use embedded drill data - type guard for drill_data
          const drillData = swing.drill_data as { name?: string; how_to?: string };
          if (drillData.name) {
            drillName = drillData.name;
            description = drillData.how_to || 'Improve your swing mechanics';
          }
        } else if (swing.drill_id) {
          // For drill_id, we'd need to join with drills table
          // For now, we'll focus on embedded drill_data since that's what fallback coaching uses
          continue;
        }
        
        if (drillName) {
          if (drillCount[drillName]) {
            drillCount[drillName].count++;
          } else {
            drillCount[drillName] = {
              count: 1,
              description: description.length > 50 ? description.substring(0, 50) + '...' : description
            };
          }
        }
      }
      
      // Sort by count and take top 2
      const sortedDrills = Object.entries(drillCount)
        .map(([name, data]) => ({
          name,
          count: data.count,
          description: data.description
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 2);
      
      setTopDrills(sortedDrills);
      
    } catch (error) {
      console.error('Failed to load top drills:', error);
    }
  };

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-blue-200 rounded-full mx-auto"></div>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-black tracking-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>SwingSense</h1>
            <p className="text-lg font-medium text-gray-600">Loading your experience...</p>
          </div>
        </div>
      </div>
    );
  }

  // Debug: Log the current state
  console.log('Index render:', { user: user?.email, loading });
  console.log('Index component rendered to DOM');

  const getFirstName = () => {
    if (!userProfile?.full_name) return 'Player';
    return userProfile.full_name.split(' ')[0] || 'Player';
  };

  const getRankStars = (averageScore: number) => {
    // Performance-based star rating using actual swing scores
    if (averageScore >= 80) return 5; // Elite performance
    if (averageScore >= 70) return 4; // Advanced performance
    if (averageScore >= 60) return 3; // Skilled performance
    if (averageScore >= 50) return 2; // Developing performance
    return 1; // Beginner performance
  };

  const getRankLabel = (averageScore: number) => {
    // Performance-based labels using actual swing scores
    if (averageScore >= 80) return "Elite Player";
    if (averageScore >= 70) return "Advanced Hitter";
    if (averageScore >= 60) return "Skilled Player";
    if (averageScore >= 50) return "Developing Hitter";
    return "Beginner Player";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }) + ' • ' + date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 scroll-smooth-inertia">
      <div className="container mx-auto px-6 py-6 max-w-lg">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <HamburgerMenu />
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <h1 className="text-2xl font-black text-black tracking-tight text-glitch" style={{ fontFamily: 'Poppins, sans-serif' }}>SwingSense</h1>
          </div>
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
            <Bell className="w-5 h-5 text-gray-600" />
          </div>
        </div>

        {/* Welcome Section */}
        <Card className="p-8 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-3xl mb-8 text-white relative overflow-hidden shadow-2xl border-0">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
          
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h2 className="text-3xl font-bold mb-2 leading-tight">
                Welcome back,
              </h2>
              <h2 className="text-3xl font-bold mb-4 leading-tight">
                {user ? getFirstName() : 'Player'}!
              </h2>
              <p className="text-blue-100 text-base mb-4 leading-relaxed">
                Your swing is improving every day
              </p>
              {/* Leaderboard rank indicator with stars */}
              <div className="flex items-center gap-2 mb-6">
                {leaderboardRank ? (
                  <>
                    {[...Array(getRankStars(leaderboardRank.averageScore))].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                    {[...Array(5 - getRankStars(leaderboardRank.averageScore))].map((_, i) => (
                      <Star key={`empty-${i}`} className="w-4 h-4 text-yellow-400/40" />
                    ))}
                    <span className="text-blue-100 text-sm font-medium ml-2">
                      Rank #{leaderboardRank.rank} • {getRankLabel(leaderboardRank.averageScore)}
                    </span>
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4 text-yellow-400/40" />
                    <Star className="w-4 h-4 text-yellow-400/40" />
                    <Star className="w-4 h-4 text-yellow-400/40" />
                    <Star className="w-4 h-4 text-yellow-400/40" />
                    <Star className="w-4 h-4 text-yellow-400/40" />
                    <span className="text-blue-100 text-sm font-medium ml-2">Calculating rank...</span>
                  </>
                )}
              </div>
              {/* Weekly improvement indicator */}
              <div className="flex items-center gap-2 text-blue-100">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">+5 this week</span>
              </div>
            </div>
            <div className="text-right bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
              <div className="text-4xl font-black mb-1">
                {stats.isLoading ? '...' : stats.bestScore}
              </div>
              <div className="text-blue-200 text-sm font-medium">
                Personal<br />Best
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 relative z-10 mt-8">
            <Link to={user ? "/analysis" : "/auth"}>
              <Button className="w-full bg-white/15 hover:bg-white/25 text-white border-0 rounded-2xl h-16 backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg">
                <Camera className="w-6 h-6 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">Record</div>
                  <div className="text-xs text-blue-200">New swing</div>
                </div>
              </Button>
            </Link>
            <Link to={user ? "/progress" : "/auth"}>
              <Button className="w-full bg-white/15 hover:bg-white/25 text-white border-0 rounded-2xl h-16 backdrop-blur-sm transition-all duration-300 hover:scale-105 shadow-lg">
                <BarChart3 className="w-6 h-6 mr-3" />
                <div className="text-left">
                  <div className="font-semibold">Analytics</div>
                  <div className="text-xs text-blue-200">View progress</div>
                </div>
              </Button>
            </Link>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Consecutive Days */}
          <Card className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 card-tilt">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-md">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full font-medium flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +2
              </div>
            </div>
            <div className="text-3xl font-black text-gray-900 mb-2">
              {stats.isLoading ? '...' : (userProfile?.current_streak || 0)}
            </div>
            <div className="text-base font-semibold text-gray-700 mb-1">Consecutive Days</div>
            <div className="text-sm text-gray-500">keep it up!</div>
          </Card>

          {/* Weekly Average */}
          <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 card-tilt">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-2xl flex items-center justify-center shadow-md">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full font-medium flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +6.7
              </div>
            </div>
            <div className="text-3xl font-black text-gray-900 mb-2">
              {stats.isLoading ? '...' : stats.trendingScore.toFixed(1)}
            </div>
            <div className="text-base font-semibold text-gray-700 mb-1">Weekly Avg</div>
            <div className="text-sm text-gray-500">points</div>
          </Card>
        </div>

        {/* Latest Analysis Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-2xl font-black text-gray-900">Latest Analysis</h3>
            <Link to={user ? "/recent-swings" : "/auth"} className="text-blue-600 text-base font-semibold hover:text-blue-700 transition-colors">
              View All →
            </Link>
          </div>
          
          {user && latestSwing ? (
            <Card className="p-6 bg-white rounded-3xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 card-tilt">
              <div className="flex items-start gap-5">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-red-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="text-white font-black text-xl">
                    {latestSwing.score_phase1}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-gray-600">
                      {formatDate(latestSwing.created_at)}
                    </div>
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold shadow-md">
                      Latest
                    </div>
                  </div>
                  <div className="text-lg font-bold text-gray-900 mb-3">
                    Swing Analysis
                  </div>
                  
                  {latestSwing.cues && latestSwing.cues.length > 0 && (
                    <div className="space-y-1">
                      {latestSwing.cues.slice(0, 2).map((cue: string, index: number) => (
                        <div key={index} className="flex items-center text-xs">
                          <div className={`w-2 h-2 rounded-full mr-2 ${
                            index === 0 ? 'bg-green-500' : 'bg-yellow-500'
                          }`}></div>
                          <span className="text-gray-600">{cue}</span>
                        </div>
                      ))}
                      {latestSwing.cues.length > 2 && (
                        <div className="flex items-center text-xs">
                          <div className="w-2 h-2 rounded-full mr-2 bg-red-500"></div>
                          <span className="text-gray-600">+{latestSwing.cues.length - 2} points from last session</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <Link to={user ? `/swing/${latestSwing.id}` : "/auth"} className="inline-flex items-center text-blue-600 text-sm font-medium mt-3 hover:text-blue-700">
                    View Detailed Analysis →
                  </Link>
                </div>
              </div>
            </Card>
          ) : !user ? (
            <Card className="p-4 bg-white rounded-2xl">
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                  <BarChart3 className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  Sign up to see your swing analysis history
                </p>
                <Link to="/auth">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm">
                    Get Started
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="p-4 bg-white rounded-2xl">
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Camera className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  No swing analysis yet. Record your first swing to get started!
                </p>
                <Link to="/analysis">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm">
                    Record Swing
                  </Button>
                </Link>
              </div>
            </Card>
          )}
        </div>

        {/* Top Drills Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-2xl font-black text-gray-900">Top Drills</h3>
            <div className="text-gray-500 text-sm">This week</div>
          </div>
          
          {topDrills.length > 0 ? (
            <div className="space-y-4">
              {topDrills.map((drill, index) => (
                <Card key={drill.name} className="p-5 bg-gradient-to-r from-purple-50 to-pink-50 rounded-3xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 card-tilt">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md ${
                      index === 0 
                        ? 'bg-gradient-to-br from-purple-500 to-purple-600' 
                        : 'bg-gradient-to-br from-pink-500 to-pink-600'
                    }`}>
                      <span className="text-white font-bold text-lg">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-900 mb-1">
                        {drill.name}
                      </h4>
                      <p className="text-sm text-gray-600 mb-2">
                        {drill.description}
                      </p>
                      {/* Star rating */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          {[...Array(index === 0 ? 5 : 4)].map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          ))}
                          {index === 1 && <Star className="w-3 h-3 text-gray-300" />}
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                          {drill.count} recommendations
                        </span>
                      </div>
                    </div>
                    <Button size="sm" className="bg-white hover:bg-gray-50 text-gray-700 rounded-2xl h-10 w-10 p-0 shadow-md">
                      <Play className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-6 bg-white rounded-3xl border-0 shadow-lg">
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Activity className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-600 text-sm mb-4">
                  {user ? 'No drill recommendations yet. Record more swings to see your top recommended drills!' : 'Sign up to see your personalized drill recommendations'}
                </p>
                <Link to={user ? "/analysis" : "/auth"}>
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg text-sm">
                    {user ? 'Record Swing' : 'Get Started'}
                  </Button>
                </Link>
              </div>
            </Card>
          )}
        </div>

        {/* Bottom CTA Card */}
        <Card className="p-8 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-3xl mb-8 text-white relative overflow-hidden shadow-2xl border-0">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
          
          <div className="text-center relative z-10">
            <div className="w-16 h-16 bg-white/15 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
              <Award className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-4 leading-tight">
              Ready to improve your<br />swing?
            </h2>
            <p className="text-blue-100 text-base mb-8 leading-relaxed max-w-sm mx-auto">
              Join thousands of players using AI-powered analysis to perfect their baseball swing
            </p>
            <Link to={user ? "/analysis" : "/auth"}>
              <Button className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-bold text-lg h-14 px-8 rounded-2xl shadow-lg transition-all duration-300 hover:scale-105">
                {user ? 'Record New Swing' : 'Get Started Now'}
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Index;
