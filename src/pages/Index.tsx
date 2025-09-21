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
    <div className="min-h-screen bg-background">
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
          <h1 className="text-5xl font-anton font-black mb-4 text-black tracking-wider uppercase">
            SWINGSENSE
          </h1>
          <p className="text-base text-gray-600 mb-8 max-w-sm mx-auto leading-relaxed">
            Record your swing, get instant feedback, and improve your performance with AI-powered analysis
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-sp-green rounded-xl flex items-center justify-center mb-2 mx-auto">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-black">68</div>
            <div className="text-sm text-gray-600">Best Score</div>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-sp-royal-blue rounded-xl flex items-center justify-center mb-2 mx-auto">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-black">12</div>
            <div className="text-sm text-gray-600">Swings Today</div>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center mb-2 mx-auto">
              <Star className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-black">47.9</div>
            <div className="text-sm text-gray-600">Avg Score</div>
          </div>
        </div>

        {/* Main Capture Card */}
        <Link to={user ? "/analysis" : "/auth"} className="block mb-6">
          <Card className="p-8 text-center bg-sp-royal-blue rounded-3xl hover:scale-105 transition-all duration-200 cursor-pointer shadow-lg">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-anton font-black mb-4 text-white uppercase tracking-wide">
              CAPTURE YOUR SWING
            </h3>
            <p className="text-white text-sm mb-8 leading-relaxed">
              Record your swing with AI pose detection for precise motion analysis and instant feedback on your mechanics
            </p>
            <Button className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-anton font-black uppercase text-lg h-12 px-8 rounded-xl border-0 w-full">
              {user ? 'START RECORDING' : 'SIGN IN TO START'} 
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Card>
        </Link>

        {/* Progress Card */}
        <Link to={user ? "/progress" : "/auth"} className="block mb-6">
          <Card className="p-6 bg-white rounded-3xl shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer border-0">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-sp-royal-blue bg-opacity-10 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-sp-royal-blue" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-anton font-black mb-2 text-black uppercase">
                  VIEW PROGRESS
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Get detailed metrics and performance scores based on swing mechanics analysis and track your improvement over time
                </p>
              </div>
            </div>
          </Card>
        </Link>

        {/* Recent Swings Card */}
        <Link to={user ? "/recent-swings" : "/auth"} className="block mb-8">
          <Card className="p-6 bg-white rounded-3xl shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer border-0">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-sp-green bg-opacity-10 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-sp-green" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-anton font-black mb-2 text-black uppercase">
                  RECENT SWINGS
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Review your swing history and get personalized coaching tips to improve your technique
                </p>
              </div>
            </div>
          </Card>
        </Link>

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
