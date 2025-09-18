import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Camera, BarChart3, Lightbulb, User, LogOut } from 'lucide-react';
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

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
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
        <div className="text-center mb-12">
          <h1 className="text-7xl font-anton font-black mb-6 text-black tracking-wider uppercase">
            SwingSense
          </h1>
          <p className="text-xl font-bold text-black mb-8 max-w-xl mx-auto">
            Record your swing, get instant feedback, and improve your performance!
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid gap-6 mb-12">
          <Link to={user ? "/analysis" : "/auth"}>
            <Card className="p-8 text-center bg-sp-royal-blue border-4 border-black rounded-2xl hover:scale-105 transition-all duration-200 cursor-pointer shadow-lg">
              <Camera className="w-16 h-16 mx-auto mb-6 text-white" />
              <h3 className="text-2xl font-anton font-black mb-4 text-white uppercase tracking-wide">Capture Your Swing</h3>
              <p className="text-white font-bold text-lg mb-6">
                Record your swing with AI pose detection for precise motion analysis
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-white font-anton text-xl uppercase">
                {user ? 'Start Recording' : 'Sign In to Start'} <ArrowRight className="w-6 h-6" />
              </div>
            </Card>
          </Link>
          
          <Card className="p-8 text-center bg-white border-4 border-black rounded-2xl shadow-lg">
            <BarChart3 className="w-16 h-16 mx-auto mb-6 text-black" />
            <h3 className="text-2xl font-anton font-black mb-4 text-black uppercase tracking-wide">Score</h3>
            <p className="text-black font-bold text-lg">
              Get detailed metrics and performance scores based on swing mechanics analysis
            </p>
          </Card>
          
          <Card className="p-8 text-center bg-sp-green border-4 border-black rounded-2xl shadow-lg">
            <Lightbulb className="w-16 h-16 mx-auto mb-6 text-white" />
            <h3 className="text-2xl font-anton font-black mb-4 text-white uppercase tracking-wide">Feedback</h3>
            <p className="text-white font-bold text-lg">
              Receive personalized coaching tips and drill recommendations
            </p>
          </Card>
        </div>

        {/* CTA Section */}
        {!user && (
          <div className="p-8 text-center mb-8">
            <h2 className="text-3xl font-anton font-black mb-6 text-black uppercase tracking-wide">Ready to improve your swing?</h2>
            <p className="text-black font-bold text-lg mb-6">
              Join thousands of players using AI-powered analysis to perfect their baseball swing.
            </p>
            <Link to="/auth">
              <Button className="bg-sp-royal-blue hover:bg-sp-blue text-white font-anton font-black uppercase text-xl h-14 px-8 rounded-xl border-2 border-black shadow-lg">
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
