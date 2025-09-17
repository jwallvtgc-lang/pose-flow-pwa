import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Camera, BarChart3, Lightbulb, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import AddToHomeScreen from "@/components/AddToHomeScreen";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            SwingSense
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            AI-powered baseball swing analysis using pose detection technology. 
            Record your swing, get instant feedback, and improve your performance.
          </p>
          
          <Link to="/analysis">
            <Button size="lg" className="gap-2 w-full mb-4">
              Start Analysis <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          
          <Link to="/progress">
            <Button size="lg" variant="outline" className="gap-2 w-full">
              View Progress <TrendingUp className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="grid gap-6 mb-12">
          <Card className="p-6 text-center">
            <Camera className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Capture</h3>
            <p className="text-muted-foreground">
              Record your swing with AI pose detection for precise motion analysis
            </p>
          </Card>
          
          <Card className="p-6 text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Score</h3>
            <p className="text-muted-foreground">
              Get detailed metrics and performance scores based on Phase 1 swing mechanics
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
          <p className="text-muted-foreground mb-6">
            Join thousands of players using AI-powered analysis to perfect their baseball swing
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/analysis" className="flex-1">
              <Button size="lg" variant="secondary" className="w-full">
                Start Your First Analysis
              </Button>
            </Link>
            <Link to="/progress" className="flex-1">
              <Button size="lg" variant="outline" className="w-full">
                Track Your Progress
              </Button>
            </Link>
          </div>
        </Card>

        <AddToHomeScreen />
      </div>
    </div>
  );
};

export default Index;
