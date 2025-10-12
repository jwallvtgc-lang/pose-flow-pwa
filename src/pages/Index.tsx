import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, TrendingUp, Award, Settings, Zap, Trophy, ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const Index = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [weekSwingCount, setWeekSwingCount] = useState(0);
  
  const [stats, setStats] = useState({
    bestScore: 0,
    trendingScore: 0,
    improvement: 0,
    isLoading: true
  });
  
  const [monthlyStats, setMonthlyStats] = useState({
    bestScoreThisMonth: 0,
    topBatSpeedThisMonth: 0,
    isLoading: true
  });
  
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; current_streak: number | null; avatar_url: string | null } | null>(null);
  const [latestSwing, setLatestSwing] = useState<any>(null);
  const [topDrills, setTopDrills] = useState<Array<{name: string; count: number; description: string}>>([]);
  const [leaderboardRank, setLeaderboardRank] = useState<{ rank: number; totalUsers: number; averageScore: number } | null>(null);

  // Handle scroll for sticky header
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (user) {
      loadStats().catch(err => console.error('loadStats failed:', err));
      loadMonthlyStats().catch(err => console.error('loadMonthlyStats failed:', err));
      loadUserProfile().catch(err => console.error('loadUserProfile failed:', err));
      loadLatestSwing().catch(err => console.error('loadLatestSwing failed:', err));
      loadTopDrills().catch(err => console.error('loadTopDrills failed:', err));
      loadLeaderboardRank().catch(err => console.error('loadLeaderboardRank failed:', err));
      loadWeekSwingCount().catch(err => console.error('loadWeekSwingCount failed:', err));
    } else if (!loading) {
      // Show placeholder data for non-authenticated users
      setStats({
        bestScore: 68,
        trendingScore: 64.7,
        improvement: 8,
        isLoading: false
      });
      setMonthlyStats({
        bestScoreThisMonth: 72,
        topBatSpeedThisMonth: 68,
        isLoading: false
      });
      setTopDrills([
        { name: 'Hip Rotation Drill', count: 12, description: 'Fire hips first' },
        { name: 'Head Still Drill', count: 8, description: 'Keep stable' }
      ]);
      setLeaderboardRank({ rank: 1, totalUsers: 1, averageScore: 64.7 });
      setWeekSwingCount(12);
    }
  }, [user, loading]);

  const loadWeekSwingCount = async () => {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { data: swings, error } = await supabase
        .from('swings')
        .select('id')
        .gte('created_at', oneWeekAgo.toISOString());

      if (error) {
        console.error('Error loading week swing count:', error);
        return;
      }

      setWeekSwingCount(swings?.length || 0);
    } catch (error) {
      console.error('Failed to load week swing count:', error);
    }
  };

  const loadStats = async () => {
    try {
      const { data: swings, error: swingsError } = await supabase
        .from('swings')
        .select('id, created_at, score_phase1')
        .order('created_at', { ascending: false });

      if (swingsError) {
        console.error('Error loading swings:', swingsError);
        return;
      }

      const validSwings = (swings || []).filter(swing => swing.score_phase1 && swing.score_phase1 > 0);
      
      const bestScore = validSwings.length > 0 
        ? Math.max(...validSwings.map(swing => swing.score_phase1 || 0))
        : 0;
      
      const recent7Swings = validSwings.slice(0, 7);
      const trendingScore = recent7Swings.length > 0
        ? recent7Swings.reduce((sum, swing) => sum + (swing.score_phase1 || 0), 0) / recent7Swings.length
        : 0;

      const previous7Swings = validSwings.slice(7, 14);
      let improvement = 0;
      
      if (recent7Swings.length > 0 && previous7Swings.length > 0) {
        const previousAvg = previous7Swings.reduce((sum, swing) => sum + (swing.score_phase1 || 0), 0) / previous7Swings.length;
        improvement = ((trendingScore - previousAvg) / previousAvg) * 100;
      }

      setStats({
        bestScore,
        trendingScore,
        improvement: Math.round(improvement),
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
      setStats(prev => ({ ...prev, isLoading: false }));
    }
  };

  const loadMonthlyStats = async () => {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const { data: swings, error: swingsError } = await supabase
        .from('swings')
        .select('score_phase1, bat_speed_peak')
        .gte('created_at', firstDayOfMonth.toISOString())
        .order('created_at', { ascending: false });

      if (swingsError) {
        console.error('Error loading monthly stats:', swingsError);
        return;
      }

      const validSwings = (swings || []).filter(swing => swing.score_phase1 && swing.score_phase1 > 0);
      const bestScoreThisMonth = validSwings.length > 0 
        ? Math.max(...validSwings.map(swing => swing.score_phase1 || 0))
        : 0;

      const swingsWithBatSpeed = (swings || []).filter(swing => swing.bat_speed_peak && swing.bat_speed_peak > 0);
      const topBatSpeedThisMonth = swingsWithBatSpeed.length > 0
        ? Math.max(...swingsWithBatSpeed.map(swing => swing.bat_speed_peak || 0))
        : 0;

      setMonthlyStats({
        bestScoreThisMonth,
        topBatSpeedThisMonth: Math.round(topBatSpeedThisMonth),
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to load monthly stats:', error);
      setMonthlyStats(prev => ({ ...prev, isLoading: false }));
    }
  };

  const loadUserProfile = async () => {
    if (!user?.id) return;
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, current_streak, avatar_url')
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
        .select('id, created_at, score_phase1, cues, video_url')
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
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
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

      if (!userSwings || userSwings.length === 0) {
        setLeaderboardRank({ rank: 1, totalUsers: 1, averageScore: 0 });
        return;
      }

      const validSwings = userSwings.filter(swing => swing.score_phase1 && swing.score_phase1 > 0);
      
      if (validSwings.length === 0) {
        setLeaderboardRank({ rank: 1, totalUsers: 1, averageScore: 0 });
        return;
      }

      const userAverageScore = validSwings.reduce((sum, swing) => sum + (swing.score_phase1 || 0), 0) / validSwings.length;
      
      setLeaderboardRank({
        rank: 1,
        totalUsers: 1,
        averageScore: Math.round(userAverageScore * 10) / 10
      });
    } catch (error) {
      console.error('Failed to load leaderboard rank:', error);
      setLeaderboardRank({ rank: 1, totalUsers: 1, averageScore: 0 });
    }
  };

  const loadTopDrills = async () => {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { data: swings, error } = await supabase
        .from('swings')
        .select('drill_id, drill_data')
        .gte('created_at', oneWeekAgo.toISOString());

      if (error) {
        console.error('Error loading drill data:', error);
        return;
      }

      const drillCount: Record<string, {count: number; description: string}> = {};
      
      for (const swing of swings || []) {
        let drillName = '';
        let description = '';
        
        if (swing.drill_data && typeof swing.drill_data === 'object' && swing.drill_data !== null) {
          const drillData = swing.drill_data as { name?: string; how_to?: string };
          if (drillData.name) {
            drillName = drillData.name;
            description = drillData.how_to || 'Improve your swing mechanics';
          }
        } else if (swing.drill_id) {
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
        <div className="text-center space-y-6 animate-fade-in-up">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-blue-200 rounded-full mx-auto"></div>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-black tracking-tight">SwingSense</h1>
            <p className="text-lg font-medium text-gray-600">Loading your experience...</p>
          </div>
        </div>
      </div>
    );
  }

  const getFirstName = () => {
    if (!userProfile?.full_name) return 'Player';
    return userProfile.full_name.split(' ')[0] || 'Player';
  };

  const getRankLabel = (averageScore: number) => {
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
      day: 'numeric'
    });
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return "from-green-400 to-green-600";
    if (score >= 70) return "from-blue-400 to-blue-600";
    if (score >= 60) return "from-yellow-400 to-yellow-600";
    if (score >= 50) return "from-orange-400 to-orange-600";
    return "from-red-400 to-red-600";
  };

  const hasSwings = latestSwing !== null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header with blur on scroll */}
      <div 
        className={`fixed top-0 left-0 right-0 z-50 safe-area-top transition-all duration-300 ${
          scrolled ? 'bg-white/80 header-blur shadow-sm' : 'bg-white'
        } border-b border-gray-200`}
      >
        <div className="py-4 px-6">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-md animate-float">
              <span className="text-white font-black text-xl">S</span>
            </div>
            <h1 className="text-2xl font-black text-black tracking-tight">SwingSense</h1>
          </div>
        </div>
      </div>

      {/* Add padding for fixed header */}
      <div className="h-[72px] safe-area-top"></div>

      {/* HEADER SECTION with animated gradient shimmer */}
      <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 pb-20 pt-6 px-6 relative overflow-hidden">
        {/* Shimmer effect overlay */}
        <div className="absolute inset-0 shimmer-bg opacity-30 pointer-events-none"></div>
        
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 border-2 border-white/30 animate-fade-in-up">
              <AvatarImage src={userProfile?.avatar_url || undefined} />
              <AvatarFallback className="bg-white/20 text-white font-bold text-lg backdrop-blur-sm">
                {user ? getFirstName()[0] : 'P'}
              </AvatarFallback>
            </Avatar>
            <div className="animate-fade-in-up">
              <p className="text-white/80 text-sm font-medium">Welcome back,</p>
              <p className="text-white text-lg font-bold">{user ? getFirstName() : 'Player'}</p>
            </div>
          </div>
          
          <Link to="/profile">
            <button className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all hover:scale-110 animate-fade-in-up">
              <Settings className="w-5 h-5 text-white" />
            </button>
          </Link>
        </div>

        {/* Hero card - shows actual latest swing or empty state */}
        {!hasSwings && user ? (
          <Card className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 text-white shadow-xl relative z-10 animate-fade-in-up">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-subtle">
                <Camera className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-black">No swings yet</h2>
              <p className="text-white/80 text-base">Record your first swing to get started!</p>
              <Link to="/analysis">
                <Button className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold text-lg h-14 px-8 rounded-2xl shadow-lg mt-4 animate-pulse-soft">
                  <Camera className="w-5 h-5 mr-2" />
                  Record First Swing
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <Card className="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-6 text-white shadow-xl relative z-10 animate-fade-in-up">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-white/80 text-sm font-medium mb-2">Latest Swing Score</p>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-black leading-none">
                    {stats.isLoading ? '...' : latestSwing ? latestSwing.score_phase1 : Math.round(stats.trendingScore)}
                  </span>
                  {stats.improvement !== 0 && (
                    <div className={`${stats.improvement > 0 ? 'bg-green-500/90' : 'bg-red-500/90'} backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1 mb-1 animate-pulse-soft`}>
                      <TrendingUp className={`w-4 h-4 ${stats.improvement < 0 ? 'rotate-180' : ''}`} />
                      <span className="text-sm font-bold">{stats.improvement > 0 ? '+' : ''}{stats.improvement}%</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-white/80 text-sm font-medium mb-2">Personal Best</p>
                <p className="text-3xl font-black">{stats.isLoading ? '...' : stats.bestScore}</p>
              </div>
            </div>
            
            <div className="flex items-center justify-between pt-4 border-t border-white/20">
              <div>
                <p className="text-white/80 text-sm font-medium">{leaderboardRank ? getRankLabel(leaderboardRank.averageScore) : 'High School Level'}</p>
              </div>
              <div className="text-right">
                <p className="text-white/80 text-sm font-medium">Next: <span className="text-white font-bold">75 pts</span></p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* KEY METRICS - 2x2 Grid (smaller cards) */}
      <div className="px-6 -mt-6 mb-8 relative z-10">
        <div className="grid grid-cols-2 gap-3 animate-fade-in-up">
          {/* Day Streak */}
          <Card className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all card-tilt">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-500 rounded-xl flex items-center justify-center mb-2">
              <Zap className={`w-5 h-5 text-white ${(userProfile?.current_streak || 0) > 0 ? 'animate-bounce-subtle' : ''}`} />
            </div>
            <p className="text-2xl font-black text-gray-900 mb-0.5">
              {stats.isLoading ? '...' : (userProfile?.current_streak || 0)}
            </p>
            <p className="text-xs font-semibold text-gray-600">Day Streak</p>
          </Card>

          {/* This Week */}
          <Card className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all card-tilt">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl flex items-center justify-center mb-2">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            {weekSwingCount === 0 && user ? (
              <>
                <p className="text-lg font-black text-gray-400 mb-0.5">0</p>
                <p className="text-xs font-semibold text-gray-500">Record your first!</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-black text-gray-900 mb-0.5">
                  {stats.isLoading ? '...' : weekSwingCount}
                </p>
                <p className="text-xs font-semibold text-gray-600">This Week</p>
              </>
            )}
          </Card>

          {/* Improvement */}
          <Card className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all card-tilt">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-500 rounded-xl flex items-center justify-center mb-2">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <p className={`text-2xl font-black mb-0.5 ${stats.improvement > 0 ? 'text-green-600' : stats.improvement < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {stats.isLoading ? '...' : stats.improvement !== 0 ? `${stats.improvement > 0 ? '+' : ''}${stats.improvement}%` : '-'}
            </p>
            <p className="text-xs font-semibold text-gray-600">Improvement</p>
          </Card>

          {/* Top Bat Speed */}
          <Card className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all card-tilt">
            <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-red-500 rounded-xl flex items-center justify-center mb-2">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <p className="text-2xl font-black text-gray-900 mb-0.5">
              {monthlyStats.isLoading ? '...' : monthlyStats.topBatSpeedThisMonth}
              <span className="text-sm font-semibold text-gray-500 ml-0.5">mph</span>
            </p>
            <p className="text-xs font-semibold text-gray-600">Top Speed</p>
          </Card>
        </div>
      </div>

      {/* Main content area */}
      <div className="px-6 pb-28 space-y-6">
        {/* Latest Analysis Section - Redesigned */}
        <div className="mb-8 animate-fade-in-up">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-black text-gray-900">Latest Analysis</h3>
            {user && hasSwings && (
              <Link to="/recent-swings" className="text-blue-600 text-sm font-semibold hover:text-blue-700 transition-colors">
                View All →
              </Link>
            )}
          </div>
          
          {user && latestSwing ? (
            <Card className="bg-white rounded-2xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden card-tilt">
              <div className="flex items-start gap-4 p-5">
                {/* Large score badge with gradient */}
                <div className={`w-20 h-20 bg-gradient-to-br ${getScoreGradient(latestSwing.score_phase1)} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
                  <span className="text-white font-black text-2xl">
                    {latestSwing.score_phase1}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium text-gray-500">
                      {formatDate(latestSwing.created_at)}
                    </div>
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                      Latest
                    </div>
                  </div>
                  
                  {/* Top 2 recommendations only */}
                  {latestSwing.cues && latestSwing.cues.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {latestSwing.cues.slice(0, 2).map((cue: string, index: number) => (
                        <div key={index} className="flex items-start text-xs">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 mr-2 flex-shrink-0 ${
                            index === 0 ? 'bg-green-500' : 'bg-yellow-500'
                          }`}></div>
                          <span className="text-gray-700 font-medium line-clamp-1">{cue}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Prominent button at bottom */}
              <Link to={`/swing/${latestSwing.id}`}>
                <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-t-none rounded-b-2xl h-12 shadow-lg">
                  View Detailed Analysis
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </Card>
          ) : !user ? (
            <Card className="p-8 bg-white rounded-2xl shadow-lg animate-fade-in-up">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Camera className="w-8 h-8 text-blue-600" />
                </div>
                <h4 className="text-lg font-bold text-gray-900 mb-2">Sign up to track progress</h4>
                <p className="text-gray-600 text-sm mb-4">
                  Get AI-powered swing analysis and personalized recommendations
                </p>
                <Link to="/auth">
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-8 py-3 rounded-2xl shadow-lg">
                    Get Started Free
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="p-12 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border-0 shadow-lg animate-fade-in-up">
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-bounce-subtle">
                  <Camera className="w-12 h-12 text-white" />
                </div>
                <h4 className="text-2xl font-black text-gray-900 mb-3">Ready to analyze your first swing?</h4>
                <p className="text-gray-600 text-base mb-6 max-w-sm mx-auto">
                  Record a swing to get instant AI-powered analysis and personalized coaching tips
                </p>
                <Link to="/analysis">
                  <Button className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold text-lg h-14 px-10 rounded-2xl shadow-lg animate-pulse-soft">
                    <Camera className="w-6 h-6 mr-2" />
                    Record Your First Swing
                  </Button>
                </Link>
              </div>
            </Card>
          )}
        </div>

        {/* Top Drills Section - Simplified */}
        <div className="mb-8 animate-fade-in-up">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-black text-gray-900">Top Drills</h3>
            <div className="text-gray-500 text-xs">This week</div>
          </div>
          
          {topDrills.length > 0 ? (
            <div className="space-y-3">
              {topDrills.map((drill, index) => (
                <Card key={drill.name} className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border-0 shadow-sm hover:shadow-md transition-all duration-300 card-tilt">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {index === 0 ? '🥇' : '🥈'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-bold text-gray-900 mb-1 truncate">
                        {drill.name}
                      </h4>
                      {/* Star rating */}
                      <div className="flex items-center gap-1">
                        {[...Array(index === 0 ? 5 : 4)].map((_, i) => (
                          <span key={i} className="text-yellow-400 text-sm">★</span>
                        ))}
                        {index === 1 && <span className="text-gray-300 text-sm">★</span>}
                      </div>
                    </div>
                    <Button size="sm" className="bg-white hover:bg-gray-50 text-gray-700 rounded-xl h-9 w-9 p-0 shadow-sm">
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
              <Button className="w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold h-11 rounded-2xl shadow-sm border border-gray-200">
                View All Drills
              </Button>
            </div>
          ) : (
            <Card className="p-6 bg-white rounded-2xl shadow-sm">
              <div className="text-center">
                <div className="text-4xl mb-3">💪</div>
                <p className="text-gray-600 text-sm mb-4">
                  {user ? 'Record swings to get drill recommendations' : 'Sign up to see personalized drills'}
                </p>
                <Link to={user ? "/analysis" : "/auth"}>
                  <Button className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded-2xl shadow-sm">
                    {user ? 'Record Swing' : 'Get Started'}
                  </Button>
                </Link>
              </div>
            </Card>
          )}
        </div>

        {/* Bottom CTA Card - Only for non-logged-in users */}
        {!user && (
          <Card className="p-8 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl text-white relative overflow-hidden shadow-2xl border-0 animate-fade-in-up">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
            
            <div className="text-center relative z-10">
              <div className="w-16 h-16 bg-white/15 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur-sm animate-float">
                <Award className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-3 leading-tight">
                Ready to improve your swing?
              </h2>
              <p className="text-blue-100 text-sm mb-6 leading-relaxed max-w-sm mx-auto">
                Join thousands of players using AI-powered analysis
              </p>
              <Link to="/auth">
                <Button className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-bold text-base h-12 px-8 rounded-2xl shadow-lg transition-all duration-300 hover:scale-105">
                  Get Started Now
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>

      {/* Bottom Navigation Bar - Enhanced center button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-bottom z-50">
        <div className="max-w-lg mx-auto px-6 py-3">
          <div className="flex items-center justify-around">
            <Link to={user ? "/progress" : "/auth"} className="flex flex-col items-center gap-1 py-2 px-4 transition-all hover:scale-110">
              <div className={`${location.pathname === '/progress' ? 'text-blue-600' : 'text-gray-400'}`}>
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${location.pathname === '/progress' ? 'text-blue-600' : 'text-gray-500'}`}>
                Progress
              </span>
            </Link>

            {/* LARGE ELEVATED RECORD BUTTON */}
            <Link to={user ? "/analysis" : "/auth"} className="flex flex-col items-center gap-1 -mt-8">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-white animate-pulse-soft hover:scale-110 transition-all">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <span className="text-xs font-bold text-gray-900 mt-1">
                Record
              </span>
            </Link>

            <Link to={user ? "/leaderboard" : "/auth"} className="flex flex-col items-center gap-1 py-2 px-4 transition-all hover:scale-110">
              <div className={`${location.pathname === '/leaderboard' ? 'text-blue-600' : 'text-gray-400'}`}>
                <Trophy className="w-5 h-5" />
              </div>
              <span className={`text-xs font-medium ${location.pathname === '/leaderboard' ? 'text-blue-600' : 'text-gray-500'}`}>
                Leaderboard
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
