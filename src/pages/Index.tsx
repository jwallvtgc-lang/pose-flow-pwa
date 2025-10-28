import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, TrendingUp, Award, Zap, Trophy, Play, Dumbbell, Users, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AppHeader } from '@/components/AppHeader';
import { SplashScreen } from '@/components/SplashScreen';
import { toast } from 'sonner';
import { drillsData } from '@/lib/drillsData';
import { motion } from 'framer-motion';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [weekSwingCount, setWeekSwingCount] = useState(0);
  
  // Only show splash on initial app load, not on navigation back
  const [showSplash, setShowSplash] = useState(() => {
    const hasShownSplash = sessionStorage.getItem('hasShownSplash');
    return !hasShownSplash;
  });
  
  const [assignmentCompleted, setAssignmentCompleted] = useState(false);
  
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
  const [assignedDrill, setAssignedDrill] = useState<{ id: string; drill_name: string; notes: string | null } | null>(null);
  const [aiInsight, setAiInsight] = useState<{ praise: string; issue: string; action: string; updated: string } | null>(null);
  const [aiInsightLoading, setAiInsightLoading] = useState(false);
  const [teamLeaderboard, setTeamLeaderboard] = useState<Array<{ name: string; initials: string; score: number }>>([]);
  const [teamLeaderboardLoading, setTeamLeaderboardLoading] = useState(false);

  // Minimum splash screen display time - only on first load
  useEffect(() => {
    if (showSplash) {
      const timer = setTimeout(() => {
        setShowSplash(false);
        sessionStorage.setItem('hasShownSplash', 'true');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [showSplash]);

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
      loadAssignedDrill().catch(err => console.error('loadAssignedDrill failed:', err));
      loadAiInsight().catch(err => console.error('loadAiInsight failed:', err));
      loadTeamLeaderboard().catch(err => console.error('loadTeamLeaderboard failed:', err));
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
    if (!user?.id) return;
    
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { data: swings, error } = await supabase
        .from('swings')
        .select(`
          id,
          sessions!inner(
            athlete_id,
            athletes!inner(
              user_id
            )
          )
        `)
        .gte('created_at', oneWeekAgo.toISOString())
        .eq('sessions.athletes.user_id', user.id);

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
    if (!user?.id) return;
    
    try {
      const { data: swings, error: swingsError } = await supabase
        .from('swings')
        .select(`
          id,
          created_at,
          score_phase1,
          sessions!inner(
            athlete_id,
            athletes!inner(
              user_id
            )
          )
        `)
        .eq('sessions.athletes.user_id', user.id)
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
    if (!user?.id) return;
    
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const { data: swings, error: swingsError } = await supabase
        .from('swings')
        .select(`
          score_phase1,
          bat_speed_peak,
          sessions!inner(
            athlete_id,
            athletes!inner(
              user_id
            )
          )
        `)
        .eq('sessions.athletes.user_id', user.id)
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
    if (!user?.id) return;
    
    try {
      const { data: swing, error } = await supabase
        .from('swings')
        .select(`
          id,
          created_at,
          score_phase1,
          cues,
          video_url,
          sessions!inner(
            athlete_id,
            athletes!inner(
              user_id
            )
          )
        `)
        .eq('sessions.athletes.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

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
    if (!user?.id) return;
    
    try {
      const { data: swings, error } = await supabase
        .from('swings')
        .select(`
          id,
          created_at,
          score_phase1,
          video_url,
          sessions!inner(
            athlete_id,
            athletes!inner(
              user_id
            )
          )
        `)
        .eq('sessions.athletes.user_id', user.id)
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
        .select(`
          id,
          score_phase1,
          created_at,
          sessions!inner(
            athlete_id,
            athletes!inner(
              user_id
            )
          )
        `)
        .eq('sessions.athletes.user_id', user.id)
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
    if (!user?.id) return;
    
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { data: swings, error } = await supabase
        .from('swings')
        .select(`
          drill_id,
          drill_data,
          sessions!inner(
            athlete_id,
            athletes!inner(
              user_id
            )
          )
        `)
        .eq('sessions.athletes.user_id', user.id)
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

  const loadAssignedDrill = async () => {
    if (!user?.id) return;
    
    try {
      // Get user's teams
      const { data: userTeams, error: teamsError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);

      if (teamsError) {
        console.error('Error loading teams:', teamsError);
        return;
      }

      const teamIds = (userTeams || []).map(t => t.team_id);

      // Get assigned drills for this player or their teams (only pending ones)
      let query = supabase
        .from('assigned_drills')
        .select('id, drill_name, notes, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      // Build the OR condition based on whether user has teams
      if (teamIds.length > 0) {
        query = query.or(`player_id.eq.${user.id},and(player_id.is.null,team_id.in.(${teamIds.join(',')}))`);
      } else {
        // User not on any teams, only check for direct player assignments
        query = query.eq('player_id', user.id);
      }

      const { data: drills, error: drillsError } = await query
        .limit(1)
        .maybeSingle();

      if (drillsError) {
        console.error('Error loading assigned drills:', drillsError);
        return;
      }

      if (drills) {
        setAssignedDrill({
          id: drills.id,
          drill_name: drills.drill_name,
          notes: drills.notes
        });
      }
    } catch (error) {
      console.error('Failed to load assigned drill:', error);
    }
  };

  const loadAiInsight = async () => {
    if (!user?.id) return;
    
    setAiInsightLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-coach-insight', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (error) {
        console.error('Error loading AI insight:', error);
        return;
      }

      if (data && !data.error && !data.fallback) {
        setAiInsight(data);
      }
    } catch (error) {
      console.error('Failed to load AI insight:', error);
    } finally {
      setAiInsightLoading(false);
    }
  };

  const loadTeamLeaderboard = async () => {
    if (!user?.id) return;
    
    setTeamLeaderboardLoading(true);
    try {
      // Get user's teams
      const { data: userTeams, error: teamsError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id);

      if (teamsError) {
        console.error('Error loading user teams:', teamsError);
        setTeamLeaderboardLoading(false);
        return;
      }

      if (!userTeams || userTeams.length === 0) {
        setTeamLeaderboardLoading(false);
        return;
      }

      const teamIds = userTeams.map(t => t.team_id);

      // Get all team members
      const { data: teamMembers, error: membersError } = await supabase
        .from('team_members')
        .select('user_id')
        .in('team_id', teamIds);

      if (membersError) {
        console.error('Error loading team members:', membersError);
        setTeamLeaderboardLoading(false);
        return;
      }

      if (!teamMembers || teamMembers.length === 0) {
        setTeamLeaderboardLoading(false);
        return;
      }

      const userIds = teamMembers.map(m => m.user_id);

      // Get profiles for all team members
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
        setTeamLeaderboardLoading(false);
        return;
      }

      // Get recent swings for all team members (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: swings, error: swingsError } = await supabase
        .from('swings')
        .select('user_id, score_phase1')
        .in('user_id', userIds)
        .gte('created_at', sevenDaysAgo.toISOString())
        .not('score_phase1', 'is', null)
        .gt('score_phase1', 0);

      if (swingsError) {
        console.error('Error loading swings:', swingsError);
        setTeamLeaderboardLoading(false);
        return;
      }

      // Calculate average scores per user
      const userScores: Record<string, { scores: number[]; name: string }> = {};
      
      profiles?.forEach(profile => {
        if (profile.full_name) {
          userScores[profile.id] = {
            scores: [],
            name: profile.full_name
          };
        }
      });

      swings?.forEach(swing => {
        if (swing.user_id && userScores[swing.user_id] && swing.score_phase1) {
          userScores[swing.user_id].scores.push(swing.score_phase1);
        }
      });

      // Calculate averages and create leaderboard
      const leaderboard = Object.entries(userScores)
        .filter(([_, data]) => data.scores.length > 0)
        .map(([, data]) => {
          const avgScore = data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length;
          const nameParts = data.name.split(' ');
          const initials = nameParts.length >= 2 
            ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
            : data.name.substring(0, 2).toUpperCase();
          
          return {
            name: data.name,
            initials,
            score: Math.round(avgScore)
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      setTeamLeaderboard(leaderboard);
    } catch (error) {
      console.error('Failed to load team leaderboard:', error);
    } finally {
      setTeamLeaderboardLoading(false);
    }
  };

  // Show loading state while authentication is being checked or minimum display time
  if (loading || showSplash) {
    return <SplashScreen />;
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
    <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black relative pb-28">
      {/* BRANDED HEADER BAR */}
      <AppHeader 
        onActionRight={() => navigate('/profile')}
        rightIcon="menu"
      />

      <div className="max-w-2xl mx-auto px-4 py-6 relative z-10">

        {/* 1. HERO HEADER / PERSONAL PANEL */}
        <div className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] p-5 mb-6 hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all duration-200">
          <div className="flex items-start gap-4">
            {/* Avatar with ambient glow */}
            <div className="relative flex-shrink-0">
              <div 
                className="absolute inset-0 rounded-full bg-emerald-500/20 blur-[40px] animate-[glowpulse_7s_ease-in-out_infinite]"
              />
              <Avatar className="relative z-10 w-14 h-14 border border-white/10">
                <AvatarImage src={userProfile?.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-cyan-500 text-white text-lg font-bold">
                  {user ? getFirstName()[0] : 'P'}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex-1">
              <p className="text-white/60 text-sm mb-1">Welcome back,</p>
              <h2 className="text-white font-semibold text-lg mb-3">
                {user ? getFirstName() : 'Player'}
              </h2>
              
              {hasSwings && !stats.isLoading ? (
                <>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-2xl font-bold text-emerald-400">{weekScore}</span>
                    {stats.improvement !== 0 && (
                      <span className={`text-sm font-semibold ml-2 ${stats.improvement > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        ({stats.improvement > 0 ? '+' : ''}{stats.improvement})
                      </span>
                    )}
                  </div>
                  <p className="text-white/50 text-sm">
                    {weekSwingCount} {weekSwingCount === 1 ? 'swing' : 'swings'} analyzed this week
                  </p>
                </>
              ) : (
                <p className="text-white/70 text-sm">Record your first swing to see your weekly score</p>
              )}
            </div>
          </div>
        </div>

        {/* 2. AI COACH INSIGHT CARD */}
        {hasSwings && user && (
          <div className="relative mb-4">
            {/* Radial glow background */}
            <div className="absolute -inset-px rounded-2xl bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.12),transparent_70%)] animate-pulseGlow pointer-events-none" />
            
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: "easeOut", delay: 0.1 }}
              className="relative rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] p-4 text-white backdrop-blur-sm"
            >
              {/* Subtitle */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3 h-3 text-green-400/70 animate-pulse" />
                <p className="text-[10px] uppercase tracking-wider text-green-400/60 font-semibold">
                  Personalized Analysis
                </p>
              </div>

              <h3 className="flex items-center gap-2 text-white font-semibold text-base mb-3">
                🤖 AI Coach Insight
              </h3>

              {aiInsightLoading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 py-4"
                >
                  <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-white/60">Analyzing your recent swings...</p>
                </motion.div>
              ) : aiInsight ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <motion.p
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    className="text-sm text-white leading-relaxed mb-2.5"
                  >
                    <span className="text-green-400 font-medium">✅ {getFirstName()}, {aiInsight.praise.split('.')[0]}.</span>
                    {' '}{aiInsight.praise.split('.').slice(1).join('.')}
                  </motion.p>

                  <motion.p
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.4 }}
                    className="text-sm text-white leading-relaxed mb-2.5"
                  >
                    <span className="text-yellow-400 font-medium">⚠ {aiInsight.issue.split('.')[0]}.</span>
                    {' '}{aiInsight.issue.split('.').slice(1).join('.')}
                  </motion.p>

                  <motion.p
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.5 }}
                    className="text-sm text-white leading-relaxed"
                  >
                    <span className="text-green-400 font-medium">🎯 Today:</span>
                    {' '}{aiInsight.action}
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.6 }}
                    className="flex items-center justify-between mt-3 pt-3 border-t border-white/5"
                  >
                    <p className="text-[11px] text-white/40">
                      Updated {aiInsight.updated}
                    </p>
                    <button
                      onClick={() => console.log('View full breakdown clicked')}
                      className="text-[11px] text-green-400/70 underline hover:text-green-400 transition-colors duration-200"
                    >
                      View full breakdown →
                    </button>
                  </motion.div>
                </motion.div>
              ) : (
                <p className="text-sm text-white/60 py-2">Record more swings to get personalized AI coaching insights.</p>
              )}
            </motion.div>
          </div>
        )}

        {/* 3. COACH ASSIGNMENT / TODAY'S FOCUS CARD */}
        {(() => {
          // Show coach assignment if there's an active pending drill assignment
          if (assignedDrill && !assignmentCompleted) {
            return (
              <div className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] p-5 mb-6">
                <h3 className="text-white font-semibold text-base mb-3">Coach Assignment</h3>
                <h4 className="text-green-400 font-semibold text-lg mb-2">{assignedDrill.drill_name}</h4>
                {assignedDrill.notes && (
                  <p className="text-white/70 text-sm mb-2">{assignedDrill.notes}</p>
                )}
                <p className="text-white/40 text-xs mb-3">From your coach</p>
                <button
                  onClick={async () => {
                    try {
                      if (!assignedDrill.id) return;
                      
                      const { error } = await supabase
                        .from('assigned_drills')
                        .update({ 
                          status: 'completed',
                          completed_at: new Date().toISOString()
                        })
                        .eq('id', assignedDrill.id);

                      if (error) throw error;
                      
                      setAssignmentCompleted(true);
                      toast.success('Assignment marked as done!');
                    } catch (error) {
                      console.error('Error marking assignment complete:', error);
                      toast.error('Failed to update assignment');
                    }
                  }}
                  className="rounded-xl bg-green-500 text-black font-semibold text-sm px-3 py-2 shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:bg-green-400 transition-all active:scale-95 min-h-[44px]"
                >
                  Mark Done
                </button>
              </div>
            );
          }

          // Fallback to "Today's Focus" with top drills
          if (topDrills.length > 0) {
            return (
              <div className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] p-5 mb-6 hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all duration-200">
                <h3 className="text-white font-semibold text-base mb-3">Today's Focus</h3>
                <div className="mb-4">
                  {assignedDrill ? (
                    <>
                      <h4 className="text-emerald-400 font-semibold text-lg mb-2">{assignedDrill.drill_name}</h4>
                      {assignedDrill.notes && (
                        <p className="text-white/70 text-sm mb-2">{assignedDrill.notes}</p>
                      )}
                      <p className="text-white/40 text-[11px]">From Coach</p>
                    </>
                  ) : (
                    <>
                      <h4 className="text-emerald-400 font-semibold text-lg mb-2">{topDrills[0].name}</h4>
                      <p className="text-white/70 text-sm">{topDrills[0].description}</p>
                    </>
                  )}
                </div>
                <Button 
                  onClick={() => {
                    const drillName = assignedDrill?.drill_name || topDrills[0]?.name;
                    // Try to find matching drill in drillsData
                    const matchingDrill = drillsData.find(d => 
                      d.name.toLowerCase().includes(drillName.toLowerCase()) || 
                      drillName.toLowerCase().includes(d.name.toLowerCase())
                    );
                    
                    if (matchingDrill) {
                      navigate(`/drills/${matchingDrill.id}`);
                    } else {
                      // Fallback to swing analysis if no matching drill found
                      navigate('/analysis');
                    }
                  }}
                  className="rounded-xl bg-emerald-500 text-black font-semibold text-sm px-4 py-2 hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                >
                  Start Drill
                </Button>
              </div>
            );
          }

          return null;
        })()}

        {/* 3. RECENT SWINGS CAROUSEL */}
        {recentSwings.length > 0 && (
          <div className="mb-6">
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
                  className="w-40 shrink-0 rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] overflow-hidden hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all duration-200"
                >
                  <div className="aspect-[4/3] bg-gradient-to-b from-white/10 to-transparent relative">
                    {swing.video_url ? (
                      <>
                        <video
                          src={`${swing.video_url}#t=0.1`}
                          className="w-full h-full object-cover"
                          preload="metadata"
                          playsInline
                          webkit-playsinline="true"
                          muted
                          disablePictureInPicture
                        />
                        {/* Play icon overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <Play className="w-8 h-8 text-white/60" />
                        </div>
                      </>
                    ) : (
                      <Play className="w-8 h-8 text-white/40 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    )}
                    {/* Dark gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  </div>
                  <div className="p-3">
                    <p className="text-emerald-400 font-semibold text-sm mb-1">
                      {swing.score_phase1 || '--'}
                    </p>
                    <p className="text-white/50 text-[11px]">
                      {swing.created_at ? formatDate(swing.created_at) : 'Recent'} · Analyzed
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <Link to="/recent-swings">
              <button className="text-emerald-400 text-sm font-medium mt-3 hover:opacity-80 transition-opacity">
                View All Swings →
              </button>
            </Link>
          </div>
        )}

        {/* 4. PROGRESS GRID */}
        {hasSwings && (
          <div className="mb-6">
            <div className="mb-3">
              <h3 className="text-white font-semibold text-base">Progress</h3>
              <p className="text-white/50 text-xs mt-1">What's changing in your swing</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Exit Velo */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all">
                <p className="text-white font-bold text-xl">
                  {monthlyStats.topBatSpeedThisMonth > 0 ? `${monthlyStats.topBatSpeedThisMonth} mph` : '--'}
                </p>
                <p className="text-white/60 text-xs">Exit Velo</p>
                {monthlyStats.topBatSpeedThisMonth > 0 && (
                  <p className="text-emerald-400 text-[10px] flex items-center justify-center gap-0.5 mt-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>Peak this month</span>
                  </p>
                )}
              </div>

              {/* Best Score */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all">
                <p className="text-white font-bold text-xl">
                  {stats.bestScore > 0 ? stats.bestScore : '--'}
                </p>
                <p className="text-white/60 text-xs">Best Score</p>
                {stats.bestScore > 0 && (
                  <p className="text-emerald-400 text-[10px] mt-1">Personal best</p>
                )}
              </div>

              {/* Streak */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all">
                <p className="text-white font-bold text-xl flex items-center justify-center gap-1">
                  {userProfile?.current_streak || 0}
                  <Zap className="w-4 h-4 text-yellow-400" />
                </p>
                <p className="text-white/60 text-xs">Day Streak</p>
                {(userProfile?.current_streak || 0) > 0 && (
                  <p className="text-emerald-400 text-[10px] mt-1">Keep it up!</p>
                )}
              </div>

              {/* Improvement */}
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3 text-center shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.3)] transition-all">
                <p className={`font-bold text-xl ${stats.improvement > 0 ? 'text-emerald-400' : stats.improvement < 0 ? 'text-red-400' : 'text-white'}`}>
                  {stats.improvement !== 0 ? `${stats.improvement > 0 ? '+' : ''}${stats.improvement}%` : '--'}
                </p>
                <p className="text-white/60 text-xs">Improvement</p>
                {stats.improvement > 0 && (
                  <p className="text-emerald-400 text-[10px] flex items-center justify-center gap-0.5 mt-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>vs last week</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5. TEAM HIGHLIGHTS */}
        {hasSwings && user && (
          <div className="mb-6 animate-fade-in">
            <div className="mb-3">
              <h3 className="text-white font-semibold text-base tracking-tight">
                🏆 Team Highlights
              </h3>
              <p className="text-white/50 text-xs mt-1">Where your team stands this week</p>
              <div className="bg-gradient-to-r from-green-500/60 to-transparent h-[1px] w-2/3 rounded-full mt-2" />
            </div>
            
            {teamLeaderboardLoading ? (
              <div className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_15px_rgba(16,185,129,0.1)] p-8 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : teamLeaderboard.length > 0 ? (
              <div className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_15px_rgba(16,185,129,0.1)] p-4 flex flex-col gap-3">
                <p className="text-white/70 text-xs uppercase tracking-wide text-center">
                  Top 3 Players — This Week
                </p>
                
                {teamLeaderboard.map((player, index) => {
                  const rankColors = [
                    { text: 'text-yellow-400', bg: 'from-yellow-400 to-yellow-600' },
                    { text: 'text-gray-300', bg: 'from-gray-300 to-gray-500' },
                    { text: 'text-orange-400', bg: 'from-orange-400 to-orange-600' }
                  ];
                  const colors = rankColors[index] || rankColors[2];
                  
                  return (
                    <div key={index} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-3 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <span className={`${colors.text} text-sm w-5 text-center font-bold`}>{index + 1}</span>
                        <div className={`h-8 w-8 rounded-full bg-gradient-to-br ${colors.bg} flex items-center justify-center border border-white/20`}>
                          <span className="text-white font-bold text-xs">{player.initials}</span>
                        </div>
                        <span className="text-white font-medium text-sm">{player.name}</span>
                      </div>
                      <div className="text-green-400 font-semibold text-sm">{player.score}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_15px_rgba(16,185,129,0.1)] p-6 text-center">
                <p className="text-white/50 text-sm">Join a team to see the leaderboard</p>
              </div>
            )}
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
          
          <Link to={user ? "/drills" : "/auth"} className="flex flex-col items-center gap-1 text-white/50 hover:text-white/70 transition-all duration-200">
            <Dumbbell className="w-5 h-5" />
            <span className="text-xs">Drills</span>
          </Link>
          
          {/* Centered Record Button */}
          <Link to={user ? "/analysis" : "/auth"} className="flex flex-col items-center gap-1 -mt-2">
            <div className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 shadow-[0_0_20px_rgba(16,185,129,0.6)] hover:shadow-[0_0_30px_rgba(16,185,129,0.8)] transition-all duration-300 flex items-center justify-center">
              <Camera className="h-7 w-7 text-black" />
            </div>
            <span className="text-xs text-white/80 font-medium">Record</span>
          </Link>
          
          <Link to={user ? "/teams" : "/auth"} className="flex flex-col items-center gap-1 text-white/50 hover:text-white/70 transition-all duration-200">
            <Users className="w-5 h-5" />
            <span className="text-xs">Teams</span>
          </Link>
          
          <Link to={user ? "/leaderboard" : "/auth"} className="flex flex-col items-center gap-1 text-white/50 hover:text-white/70 transition-all duration-200">
            <Trophy className="w-5 h-5" />
            <span className="text-xs">Leaderboard</span>
          </Link>
        </div>
      </div>

      <style>{`
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
