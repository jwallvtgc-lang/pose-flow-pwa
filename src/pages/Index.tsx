import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, TrendingUp, Award, Zap, Trophy, Play, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import headerLogo from '@/assets/swingsense-header.png';

const Index = () => {
  const { user, loading } = useAuth();
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
  const [recentSwings, setRecentSwings] = useState<any[]>([]);
  const [topDrills, setTopDrills] = useState<Array<{name: string; count: number; description: string}>>([]);

  useEffect(() => {
    if (user) {
      loadStats().catch(err => console.error('loadStats failed:', err));
      loadMonthlyStats().catch(err => console.error('loadMonthlyStats failed:', err));
      loadUserProfile().catch(err => console.error('loadUserProfile failed:', err));
      loadLatestSwing().catch(err => console.error('loadLatestSwing failed:', err));
      loadRecentSwings().catch(err => console.error('loadRecentSwings failed:', err));
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

  const loadRecentSwings = async () => {
    try {
      const { data: swings, error } = await supabase
        .from('swings')
        .select('id, created_at, score_phase1, video_url')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error loading recent swings:', error);
        return;
      }

      setRecentSwings(swings || []);
    } catch (error) {
      console.error('Failed to load recent swings:', error);
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
        return;
      }

      const validSwings = userSwings.filter(swing => swing.score_phase1 && swing.score_phase1 > 0);
      
      if (validSwings.length === 0) {
        return;
      }

      const userAverageScore = validSwings.reduce((sum, swing) => sum + (swing.score_phase1 || 0), 0) / validSwings.length;
      
      // Leaderboard rank calculated but not stored (could be used for future features)
      console.log('User average score:', userAverageScore);
    } catch (error) {
      console.error('Failed to load leaderboard rank:', error);
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
      <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-black flex items-center justify-center p-4">
        <div className="text-center space-y-6 animate-fade-in-up">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-green-200/20 rounded-full mx-auto"></div>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-white tracking-tight">SwingSense</h1>
            <p className="text-lg font-medium text-white/60">Loading your experience...</p>
          </div>
        </div>
      </div>
    );
  }

  const getFirstName = () => {
    if (!userProfile?.full_name) return 'Player';
    return userProfile.full_name.split(' ')[0] || 'Player';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  const hasSwings = latestSwing !== null;
  const weekScore = Math.round(stats.trendingScore);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-black relative pb-32">
      {/* Vignette overlay */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />

      {/* Subtle shimmer background */}
      <div className="fixed inset-0 opacity-20 pointer-events-none" style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.05) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer-slow 30s linear infinite'
      }} />
      
      {/* BRANDED HEADER BAR */}
      <header className="relative w-full h-16 bg-gradient-to-b from-[#0F172A] to-black border-b border-white/10">
        {/* Centered Logo */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center">
          <img
            src={headerLogo}
            alt="SwingSense"
            className="h-8 w-auto animate-[logoentrance_0.5s_ease-out,glowpulse_7s_ease-in-out_infinite]"
          />
        </div>
        
        {/* Right Action - Profile Button */}
        <Link 
          to="/profile" 
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-200"
        >
          <User className="w-5 h-5" />
        </Link>
      </header>

      <div className="max-w-2xl mx-auto px-4 relative z-10">

        {/* 1. HERO HEADER / PERSONAL PANEL */}
        <div className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] p-5 mb-6 animate-fade-in">
          <div className="flex items-start gap-4">
            {/* Avatar with ambient glow */}
            <div className="relative flex-shrink-0">
              <div 
                className="absolute inset-0 -m-2 opacity-30"
                style={{
                  background: 'radial-gradient(circle, rgba(16, 185, 129, 0.5) 0%, transparent 70%)',
                  filter: 'blur(16px)',
                  animation: 'glow-breathe 7s ease-in-out infinite'
                }}
              />
              <Avatar className="relative z-10 w-14 h-14 border-2 border-white/10 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <AvatarImage src={userProfile?.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-cyan-500 text-white text-lg font-bold">
                  {user ? getFirstName()[0] : 'P'}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex-1">
              <p className="text-white/60 text-sm mb-1">Welcome back,</p>
              <h2 className="text-white font-semibold text-xl mb-3">
                {user ? getFirstName() : 'Player'}
              </h2>
              
              {hasSwings && !stats.isLoading ? (
                <>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-green-400 text-3xl font-bold">{weekScore}</span>
                    {stats.improvement !== 0 && (
                      <span className={`text-sm font-semibold ${stats.improvement > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        ({stats.improvement > 0 ? '+' : ''}{stats.improvement})
                      </span>
                    )}
                  </div>
                  <p className="text-white/50 text-sm">
                    {weekSwingCount} {weekSwingCount === 1 ? 'swing' : 'swings'} analyzed this week
                  </p>
                  {stats.improvement > 0 && (
                    <p className="text-green-400 text-xs mt-2">
                      🔥 You're trending up — +{stats.improvement} Swingscore this week
                    </p>
                  )}
                </>
              ) : (
                <p className="text-white/70 text-sm">Record your first swing to see your weekly score</p>
              )}
            </div>
          </div>
        </div>

        {/* 2. TODAY'S FOCUS CARD */}
        {topDrills.length > 0 && (
          <div className="rounded-2xl bg-white/5 border border-white/10 shadow-lg p-5 mb-6 hover:shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all duration-200 animate-fade-in">
            <h3 className="text-white font-semibold text-base mb-3">Today's Focus</h3>
            <div className="mb-4">
              <h4 className="text-green-400 font-semibold text-lg mb-2">{topDrills[0].name}</h4>
              <p className="text-white/70 text-sm">{topDrills[0].description}</p>
            </div>
            <Link to="/analysis">
              <Button className="rounded-xl bg-green-500 text-black font-semibold text-sm px-4 py-2 hover:bg-green-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                Start Drill
              </Button>
            </Link>
          </div>
        )}

        {/* 3. RECENT SWINGS CAROUSEL */}
        {recentSwings.length > 0 && (
          <div className="mb-6 animate-fade-in">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <h3 className="text-white font-semibold text-base">Your Recent Swings</h3>
                <p className="text-white/50 text-xs mt-1">Tap to review and compare</p>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {recentSwings.map((swing) => (
                <Link 
                  key={swing.id} 
                  to={`/swing/${swing.id}`}
                  className="w-40 shrink-0 rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] p-3 flex flex-col gap-2 transition-all duration-200"
                >
                  <div className="aspect-video rounded-xl bg-black relative overflow-hidden border border-white/10 group">
                    {swing.video_url ? (
                      <>
                        <video
                          src={swing.video_url}
                          className="w-full h-full object-cover"
                          preload="metadata"
                          playsInline
                          muted
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Play className="w-8 h-8 text-white/60" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{swing.score_phase1 || '--'}</p>
                    <p className="text-white/50 text-[11px]">{formatDate(swing.created_at)} · Analyzed</p>
                  </div>
                </Link>
              ))}
            </div>
            <Link to="/recent-swings">
              <button className="text-green-400 text-sm font-medium mt-3 hover:underline">
                View All Swings →
              </button>
            </Link>
          </div>
        )}

        {/* 4. PROGRESS GRID */}
        {hasSwings && (
          <div className="mb-6 animate-fade-in">
            <div className="mb-3">
              <h3 className="text-white font-semibold text-base">Progress</h3>
              <p className="text-white/50 text-xs mt-1">What's changing in your swing</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Exit Velo */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center flex flex-col gap-1 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all">
                <p className="text-white font-bold text-xl">
                  {monthlyStats.topBatSpeedThisMonth > 0 ? `${monthlyStats.topBatSpeedThisMonth} mph` : '--'}
                </p>
                <p className="text-white/60 text-xs">Exit Velo</p>
                {monthlyStats.topBatSpeedThisMonth > 0 && (
                  <p className="text-green-400 text-[10px] flex items-center justify-center gap-0.5">
                    <TrendingUp className="w-3 h-3" />
                    <span>Peak this month</span>
                  </p>
                )}
              </div>

              {/* Best Score */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center flex flex-col gap-1 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all">
                <p className="text-white font-bold text-xl">
                  {stats.bestScore > 0 ? stats.bestScore : '--'}
                </p>
                <p className="text-white/60 text-xs">Best Score</p>
                {stats.bestScore > 0 && (
                  <p className="text-green-400 text-[10px]">Personal best</p>
                )}
              </div>

              {/* Streak */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center flex flex-col gap-1 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all">
                <p className="text-white font-bold text-xl flex items-center justify-center gap-1">
                  {userProfile?.current_streak || 0}
                  <Zap className="w-4 h-4 text-yellow-400" />
                </p>
                <p className="text-white/60 text-xs">Day Streak</p>
                {(userProfile?.current_streak || 0) > 0 && (
                  <p className="text-green-400 text-[10px]">Keep it up!</p>
                )}
              </div>

              {/* Improvement */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center flex flex-col gap-1 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all">
                <p className={`font-bold text-xl ${stats.improvement > 0 ? 'text-green-400' : stats.improvement < 0 ? 'text-red-400' : 'text-white'}`}>
                  {stats.improvement !== 0 ? `${stats.improvement > 0 ? '+' : ''}${stats.improvement}%` : '--'}
                </p>
                <p className="text-white/60 text-xs">Improvement</p>
                {stats.improvement > 0 && (
                  <p className="text-green-400 text-[10px] flex items-center justify-center gap-0.5">
                    <TrendingUp className="w-3 h-3" />
                    <span>vs last week</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5. TEAM HIGHLIGHTS (Visual Mock) */}
        {hasSwings && user && (
          <div className="mb-6 animate-fade-in">
            <div className="mb-3">
              <h3 className="text-white font-semibold text-base tracking-tight">
                🏆 Team Highlights
              </h3>
              <p className="text-white/50 text-xs mt-1">Where your team stands this week</p>
              <div className="bg-gradient-to-r from-green-500/60 to-transparent h-[1px] w-2/3 rounded-full mt-2" />
            </div>
            
            <div className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_15px_rgba(16,185,129,0.1)] p-4 flex flex-col gap-3">
              <p className="text-white/70 text-xs uppercase tracking-wide text-center">
                Top 3 Players — This Week
              </p>
              
              {/* Rank 1 */}
              <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-3 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-200">
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400 text-sm w-5 text-center font-bold">1</span>
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center border border-white/20">
                    <span className="text-white font-bold text-xs">ER</span>
                  </div>
                  <span className="text-white font-medium text-sm">Evan R</span>
                </div>
                <div className="text-green-400 font-semibold text-sm">84</div>
              </div>
              
              {/* Rank 2 */}
              <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-3 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-200">
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 text-sm w-5 text-center font-bold">2</span>
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center border border-white/20">
                    <span className="text-white font-bold text-xs">MJ</span>
                  </div>
                  <span className="text-white font-medium text-sm">Mike J</span>
                </div>
                <div className="text-green-400 font-semibold text-sm">82</div>
              </div>
              
              {/* Rank 3 */}
              <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-3 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-200">
                <div className="flex items-center gap-3">
                  <span className="text-orange-400 text-sm w-5 text-center font-bold">3</span>
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center border border-white/20">
                    <span className="text-white font-bold text-xs">SL</span>
                  </div>
                  <span className="text-white font-medium text-sm">Sarah L</span>
                </div>
                <div className="text-green-400 font-semibold text-sm">79</div>
              </div>
            </div>
          </div>
        )}

        {/* Empty state for no swings */}
        {!hasSwings && user && (
          <div className="rounded-2xl bg-white/5 border border-white/10 shadow-lg p-8 text-center mb-6 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Camera className="w-10 h-10 text-white/40" />
            </div>
            <h3 className="text-white/80 font-semibold text-lg mb-2">No Swings Yet</h3>
            <p className="text-white/50 text-sm mb-6">
              Record your first swing to get instant AI-powered analysis and personalized coaching tips
            </p>
            <Link to="/analysis">
              <Button className="rounded-xl bg-green-500 hover:bg-green-600 text-black font-semibold px-8 py-3 shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all hover:scale-105">
                <Camera className="w-5 h-5 mr-2" />
                Record First Swing
              </Button>
            </Link>
          </div>
        )}

        {/* CTA for non-logged-in users */}
        {!user && (
          <div className="rounded-2xl bg-gradient-to-br from-green-500/10 to-cyan-500/10 border border-green-500/20 p-8 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-white font-bold text-xl mb-2">Ready to improve your swing?</h3>
            <p className="text-white/60 text-sm mb-6">
              Join thousands of players using AI-powered analysis
            </p>
            <Link to="/auth">
              <Button className="rounded-xl bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 text-black font-bold px-8 py-3 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all hover:scale-105">
                Get Started Now
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* BOTTOM NAVIGATION */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/40 backdrop-blur-md border-t border-white/10 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-around py-3 px-4">
          <Link to={user ? "/progress" : "/auth"} className="flex flex-col items-center gap-1 text-white/50 hover:text-white/70 transition-all duration-200">
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs">Progress</span>
          </Link>
          
          {/* Centered Record Button */}
          <Link to={user ? "/analysis" : "/auth"} className="flex flex-col items-center gap-1 -mt-2">
            <div className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 shadow-[0_0_20px_rgba(16,185,129,0.6)] hover:shadow-[0_0_30px_rgba(16,185,129,0.8)] transition-all duration-300 flex items-center justify-center">
              <Camera className="h-7 w-7 text-black" />
            </div>
            <span className="text-xs text-white/80 font-medium">Record</span>
          </Link>
          
          <Link to={user ? "/leaderboard" : "/auth"} className="flex flex-col items-center gap-1 text-white/50 hover:text-white/70 transition-all duration-200">
            <Trophy className="w-5 h-5" />
            <span className="text-xs">Leaderboard</span>
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes glowpulse {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.3));
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(16, 185, 129, 0.6));
          }
        }

        @keyframes logoentrance {
          0% {
            opacity: 0;
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes glow-breathe {
          0%, 100% {
            filter: blur(16px);
            opacity: 0.3;
          }
          50% {
            filter: blur(20px);
            opacity: 0.4;
          }
        }

        @keyframes shimmer-slow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default Index;
