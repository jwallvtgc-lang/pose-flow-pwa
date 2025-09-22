import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Camera, BarChart3, TrendingUp, Activity, Star, User, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AddToHomeScreen from "@/components/AddToHomeScreen";

const Index = () => {
  const { user, signOut, loading } = useAuth();

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

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-lg">
        {/* Auth Status Header */}
        {user && (
          <div className="flex justify-end mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-gray-700 font-bold">
                <User className="w-5 h-5" />
                <span>Welcome back!</span>
              </div>
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                className="border-2 border-black rounded-xl font-anton font-black uppercase"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-anton font-black mb-4 tracking-wider uppercase" style={{ color: 'hsl(var(--sp-cyan))' }}>
            SWINGSENSE
          </h1>
          <p className="text-base text-gray-600 mb-8 max-w-sm mx-auto leading-relaxed">
            Level up your swing game ⚾
          </p>
        </div>

        {/* Main Capture Card */}
        <Link to={user ? "/analysis" : "/auth"} className="block mb-6">
          <Card className="p-8 text-center bg-gradient-to-br from-blue-500 to-cyan-400 rounded-3xl hover:scale-105 transition-all duration-200 cursor-pointer shadow-lg">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-anton font-black mb-4 text-white uppercase tracking-wide">
              RECORD YOUR SWING
            </h3>
            <p className="text-white text-sm mb-8 leading-relaxed">
              AI analyzes your form in real-time<br />
              Get instant feedback & level up!
            </p>
            <Button className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-anton font-black uppercase text-lg h-12 px-8 rounded-xl border-0 w-full">
              {user ? 'START RECORDING' : 'SIGN IN TO START'} 
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Card>
        </Link>

        {/* Bottom Stats and Feedback Section */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Stats Section */}
          <div className="bg-white rounded-3xl p-6 shadow-lg">
            <h3 className="text-lg font-anton font-black mb-4 text-black uppercase text-center">Stats</h3>
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-8 h-8 bg-sp-green rounded-lg flex items-center justify-center mb-1 mx-auto">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <div className="text-xl font-bold" style={{ color: 'hsl(var(--sp-cyan))' }}>68</div>
                <div className="text-xs text-gray-600 uppercase font-bold">Best Score</div>
              </div>
              
              <div className="text-center">
                <div className="w-8 h-8 bg-sp-royal-blue rounded-lg flex items-center justify-center mb-1 mx-auto">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div className="text-xl font-bold" style={{ color: 'hsl(var(--sp-cyan))' }}>12</div>
                <div className="text-xs text-gray-600 uppercase font-bold">Today</div>
              </div>
              
              <div className="text-center">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center mb-1 mx-auto">
                  <Star className="w-4 h-4 text-white" />
                </div>
                <div className="text-xl font-bold" style={{ color: 'hsl(var(--sp-cyan))' }}>+6.7</div>
                <div className="text-xs text-gray-600 uppercase font-bold">Trending</div>
              </div>
            </div>
          </div>

          {/* Quick Actions Section */}
          <div className="bg-white rounded-3xl p-6 shadow-lg">
            <h3 className="text-lg font-anton font-black mb-4 text-black uppercase text-center">Quick Access</h3>
            <div className="space-y-3">
              <Link to={user ? "/progress" : "/auth"} className="block">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="w-8 h-8 bg-sp-royal-blue bg-opacity-10 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-sp-royal-blue" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-black">Progress</div>
                    <div className="text-xs text-gray-600">View metrics</div>
                  </div>
                </div>
              </Link>
              
              <Link to={user ? "/recent-swings" : "/auth"} className="block">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="w-8 h-8 bg-sp-green bg-opacity-10 rounded-lg flex items-center justify-center">
                    <Activity className="w-4 h-4 text-sp-green" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-black">Recent</div>
                    <div className="text-xs text-gray-600">Swing history</div>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        {!user && (
          <div className="p-6 text-center mb-8">
            <h2 className="text-2xl font-anton font-black mb-4 text-black uppercase tracking-wide">
              Ready to improve your swing?
            </h2>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              Join thousands of players using AI-powered analysis to perfect their baseball swing.
            </p>
            <Link to="/auth">
              <Button className="bg-sp-royal-blue hover:bg-sp-blue text-white font-anton font-black uppercase text-lg h-12 px-8 rounded-xl border-0 shadow-lg w-full">
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
