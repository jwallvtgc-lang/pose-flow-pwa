import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Camera, BarChart3, Lightbulb } from 'lucide-react';
import { Link } from 'react-router-dom';
import AddToHomeScreen from "@/components/AddToHomeScreen";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-fredoka font-bold mb-6 text-sp-blue drop-shadow-lg">
            SwingSense
          </h1>
          <p className="text-xl font-bold text-gray-800 mb-8 max-w-xl mx-auto">
            AI-powered baseball swing analysis using pose detection technology. 
            Record your swing, get instant feedback, and improve your performance!
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid gap-6 mb-12">
          <Link to="/analysis">
            <Card className="p-8 text-center bg-sp-blue border-4 border-gray-800 rounded-2xl hover:scale-105 transition-all duration-200 cursor-pointer shadow-lg">
              <Camera className="w-16 h-16 mx-auto mb-6 text-white" />
              <h3 className="text-2xl font-fredoka font-bold mb-4 text-white">Capture Your Swing</h3>
              <p className="text-white font-bold text-lg mb-6">
                Record your swing with AI pose detection for precise motion analysis
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-white font-fredoka text-xl">
                Start Recording <ArrowRight className="w-6 h-6" />
              </div>
            </Card>
          </Link>
          
          <Card className="p-8 text-center bg-sp-orange border-4 border-gray-800 rounded-2xl shadow-lg">
            <BarChart3 className="w-16 h-16 mx-auto mb-6 text-white" />
            <h3 className="text-2xl font-fredoka font-bold mb-4 text-white">Score</h3>
            <p className="text-white font-bold text-lg">
              Get detailed metrics and performance scores based on swing mechanics analysis
            </p>
          </Card>
          
          <Card className="p-8 text-center bg-sp-green border-4 border-gray-800 rounded-2xl shadow-lg">
            <Lightbulb className="w-16 h-16 mx-auto mb-6 text-white" />
            <h3 className="text-2xl font-fredoka font-bold mb-4 text-white">Feedback</h3>
            <p className="text-white font-bold text-lg">
              Receive personalized coaching tips and drill recommendations
            </p>
          </Card>
        </div>

        {/* CTA Section */}
        <Card className="p-8 text-center bg-sp-yellow border-4 border-gray-800 rounded-2xl mb-8 shadow-lg">
          <h2 className="text-3xl font-fredoka font-bold mb-6 text-gray-800">Ready to improve your swing?</h2>
          <p className="text-gray-800 font-bold text-lg">
            Join thousands of players using AI-powered analysis to perfect their baseball swing. Click "Capture Your Swing" above to get started!
          </p>
        </Card>

        <AddToHomeScreen />
      </div>
    </div>
  );
};

export default Index;
