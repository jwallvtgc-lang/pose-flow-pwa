import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, BarChart3, TrendingUp, Activity, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AddToHomeScreen from "@/components/AddToHomeScreen";
import { HamburgerMenu } from "@/components/HamburgerMenu";

const Index = () => {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState({
    bestScore: 0,
    todayCount: 0,
    trendingScore: 0,
    isLoading: true
  });
  
  const [userProfile, setUserProfile] = useState<{ full_name: string | null } | null>(null);
  const [latestSwing, setLatestSwing] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadStats();
      loadUserProfile();
      loadLatestSwing();
    } else {
      // Show placeholder data for non-authenticated users
      setStats({
        bestScore: 68,
        todayCount: 12,
        trendingScore: 64.7,
        isLoading: false
      });
    }
  }, [user]);

  const loadStats = async () => {
    try {
      // Get all user swings
      const { data: swings, error: swingsError } = await supabase
        .from('swings')
        .select('id, created_at, score_phase1')
        .order('created_at', { ascending: false });

      if (swingsError) {
        console.error('Error loading swings:', swingsError);
        return;
      }

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
        .select('full_name')
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

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-sp-royal-blue border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="space-y-2">
            <p className="text-xl font-anton font-black text-black uppercase">SwingSense</p>
            <p className="text-lg font-bold text-gray-600">Loading your experience...</p>
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
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-4 max-w-lg">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <HamburgerMenu />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-teal-500 rounded-2xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">SS</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-800">SwingSense</h1>
          </div>
          <Bell className="w-6 h-6 text-gray-600" />
        </div>

        {/* Welcome Section */}
        <Card className="p-6 bg-gradient-to-br from-blue-600 to-purple-700 rounded-3xl mb-6 text-white relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                Welcome back,
              </h2>
              <h2 className="text-2xl font-bold mb-4">
                {user ? getFirstName() : 'Player'}!
              </h2>
              <p className="text-blue-100 text-sm mb-6">
                Your swing is improving every day
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold mb-1">
                {stats.isLoading ? '...' : stats.bestScore}
              </div>
              <div className="text-blue-200 text-sm">
                Personal<br />Best
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Link to={user ? "/analysis" : "/auth"}>
              <Button className="w-full bg-white/20 hover:bg-white/30 text-white border-0 rounded-2xl h-14 backdrop-blur-sm">
                <Camera className="w-5 h-5 mr-2" />
                Quick Record
              </Button>
            </Link>
            <Link to={user ? "/progress" : "/auth"}>
              <Button className="w-full bg-white/20 hover:bg-white/30 text-white border-0 rounded-2xl h-14 backdrop-blur-sm">
                <BarChart3 className="w-5 h-5 mr-2" />
                View Analytics
              </Button>
            </Link>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Current Streak */}
          <Card className="p-4 bg-white rounded-2xl border-l-4 border-yellow-400">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="text-xs text-green-600 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                ↑ 2
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {stats.isLoading ? '...' : stats.todayCount}
            </div>
            <div className="text-sm text-gray-600 mb-1">Current Streak</div>
            <div className="text-xs text-gray-500">consecutive sessions</div>
          </Card>

          {/* Weekly Average */}
          <Card className="p-4 bg-white rounded-2xl border-l-4 border-green-400">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-xs text-green-600 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                ↑ 6.7
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {stats.isLoading ? '...' : stats.trendingScore.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600 mb-1">Weekly Avg</div>
            <div className="text-xs text-gray-500">points</div>
          </Card>
        </div>

        {/* Latest Analysis Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xl font-bold text-gray-900">Latest Analysis</h3>
            <Link to={user ? "/recent-swings" : "/auth"} className="text-blue-600 text-sm font-medium">
              View All
            </Link>
          </div>
          
          {user && latestSwing ? (
            <Card className="p-4 bg-white rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">
                    {latestSwing.score_phase1}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm text-gray-600">
                      {formatDate(latestSwing.created_at)}
                    </div>
                    <div className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">
                      Latest
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-900 mb-2">
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
                  
                  <Link to={user ? "/recent-swings" : "/auth"} className="inline-flex items-center text-blue-600 text-sm font-medium mt-3 hover:text-blue-700">
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

        {/* CTA Section for non-authenticated users */}
        {!user && (
          <div className="p-6 text-center mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">
              Ready to improve your swing?
            </h2>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              Join thousands of players using AI-powered analysis to perfect their baseball swing.
            </p>
            <Link to="/auth">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg h-12 px-8 rounded-xl shadow-lg w-full">
                Get Started Now
              </Button>
            </Link>
          </div>
        )}

        <AddToHomeScreen />
      </div>
    </div>
  );
};

export default Index;
