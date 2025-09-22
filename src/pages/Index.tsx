import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, BarChart3, TrendingUp, Activity, Star, User, LogOut } from 'lucide-react';
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
    <div className="min-h-screen bg-white">
      <div className="container mx-auto px-4 py-8 max-w-lg">
        {/* Header with Auth Status */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-anton font-black tracking-wider uppercase" style={{ color: 'hsl(var(--sp-cyan))' }}>
            SWINGSENSE
          </h1>
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-gray-700 font-bold">
                <User className="w-4 h-4" />
                <span className="text-sm">Hey there!</span>
              </div>
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                className="border border-gray-300 rounded-lg font-medium"
              >
                <LogOut className="w-3 h-3 mr-1" />
                Sign Out
              </Button>
            </div>
          ) : (
            <span className="text-gray-600 text-sm">Hey there!</span>
          )}
        </div>

        {/* Tagline */}
        <div className="text-center mb-12">
          <p className="text-lg text-gray-600 leading-relaxed">
            Record your swing, get instant feedback, and improve your performance!
          </p>
        </div>

        {/* Stats Section - Three prominent cards */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          <div className="text-center">
            <div className="w-16 h-16 bg-sp-green rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-lg">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-black mb-1">68</div>
            <div className="text-sm text-gray-500 uppercase font-medium tracking-wide">Best Score</div>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-lg">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-black mb-1">12</div>
            <div className="text-sm text-gray-500 uppercase font-medium tracking-wide">Today</div>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-500 rounded-2xl flex items-center justify-center mb-4 mx-auto shadow-lg">
              <Star className="w-8 h-8 text-white" />
            </div>
            <div className="text-3xl font-bold text-black mb-1">64.7</div>
            <div className="text-sm text-gray-500 uppercase font-medium tracking-wide">Trending</div>
          </div>
        </div>

        {/* Main Capture Card */}
        <Link to={user ? "/analysis" : "/auth"} className="block mb-12">
          <Card className="p-10 text-center bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl hover:scale-105 transition-all duration-200 cursor-pointer shadow-xl">
            <div className="w-20 h-20 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mb-8 mx-auto">
              <Camera className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-3xl font-anton font-black mb-6 text-white uppercase tracking-wide">
              RECORD YOUR SWING
            </h3>
            <p className="text-white text-base mb-10 leading-relaxed max-w-sm mx-auto">
              Record your swing with AI pose detection for precise motion analysis
            </p>
            <Button className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-anton font-black uppercase text-lg h-14 px-12 rounded-2xl border-0 w-full max-w-sm mx-auto">
              {user ? 'START RECORDING →' : 'SIGN UP TO START →'} 
            </Button>
          </Card>
        </Link>

        {/* Bottom Progress and Swing History Section */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Progress Section */}
          <Link to={user ? "/progress" : "/auth"} className="block">
            <Card className="p-8 bg-white rounded-3xl shadow-lg border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <BarChart3 className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-anton font-black text-black uppercase mb-3">Progress</h3>
                <div className="text-sm text-gray-600 mb-2 font-medium">Track Your</div>
                <div className="text-sm text-gray-600 mb-4 font-medium">Improvement</div>
                <div className="text-xs text-gray-500 leading-relaxed">
                  View detailed metrics and performance trends over time
                </div>
              </div>
            </Card>
          </Link>

          {/* Swing History Section */}
          <Link to={user ? "/recent-swings" : "/auth"} className="block">
            <Card className="p-8 bg-white rounded-3xl shadow-lg border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <User className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-anton font-black text-black uppercase mb-3">Swing</h3>
                <h3 className="text-xl font-anton font-black text-black uppercase mb-3">History</h3>
                <div className="text-sm text-gray-600 mb-2 font-medium">Review Past Swings</div>
                <div className="text-xs text-gray-500 leading-relaxed">
                  Access your swing history with personalized coaching feedback
                </div>
              </div>
            </Card>
          </Link>
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
