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
          <h1 className="text-5xl font-great-vibes font-bold mb-4 text-hunters-green">
            SwingSense
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            AI-powered baseball swing analysis using pose detection technology. 
            Record your swing, get instant feedback, and improve your performance.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid gap-6 mb-12">
          <Link to="/analysis">
            <Card className="p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer">
              <Camera className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Capture Your Swing</h3>
              <p className="text-muted-foreground">
                Record your swing with AI pose detection for precise motion analysis
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-primary font-medium">
                Start Recording <ArrowRight className="w-4 h-4" />
              </div>
            </Card>
          </Link>
          
          <Card className="p-6 text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Score</h3>
            <p className="text-muted-foreground">
              Get detailed metrics and performance scores based on swing mechanics analysis
            </p>
          </Card>
          
          <Card className="p-6 text-center">
            <Lightbulb className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Feedback</h3>
            <p className="text-muted-foreground">
              Receive personalized coaching tips and drill recommendations
            </p>
          </Card>
        </div>

        {/* CTA Section */}
        <Card className="p-6 text-center bg-muted mb-8">
          <h2 className="text-2xl font-bold mb-4">Ready to improve your swing?</h2>
          <p className="text-muted-foreground">
            Join thousands of players using AI-powered analysis to perfect their baseball swing. Click "Capture Your Swing" above to get started.
          </p>
        </Card>

        <AddToHomeScreen />
      </div>
    </div>
  );
};

export default Index;
