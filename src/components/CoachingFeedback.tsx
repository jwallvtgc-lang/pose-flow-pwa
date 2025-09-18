import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DrillCard } from '@/components/DrillCard';
import { trackCapture } from '@/lib/analytics';
import { Home } from 'lucide-react';
import type { CoachingCard } from '@/lib/cues';

interface CoachingFeedbackProps {
  score: number;
  cards: CoachingCard[];
}

export function CoachingFeedback({ score, cards }: CoachingFeedbackProps) {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (cards.length > 0) {
      trackCapture.drillShown();
    }
  }, [cards]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getScoreText = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Work';
  };

  return (
    <div className="space-y-6">
      {/* Score Display */}
      <Card className="p-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Swing Score</h2>
        <div className="relative inline-block">
          <div className={`w-24 h-24 rounded-full ${getScoreColor(score)} flex items-center justify-center text-white text-2xl font-bold`}>
            {score}
          </div>
          <Badge 
            variant="secondary" 
            className="absolute -bottom-2 left-1/2 transform -translate-x-1/2"
          >
            {getScoreText(score)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          Based on Phase 1 swing mechanics analysis
        </p>
      </Card>

      {/* Coaching Cards */}
      {cards.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Recommended Improvements</h3>
          <div className="grid gap-4">
            {cards.map((card, index) => (
              <DrillCard key={index} card={card} />
            ))}
          </div>
        </div>
      )}

      {/* Next Steps */}
      <Card className="p-4 bg-muted">
        <h4 className="font-medium mb-2">Next Steps</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Practice the recommended drills</li>
          <li>• Record another swing to track progress</li>
          <li>• Focus on the weakest metrics first</li>
          <li>• Work with a coach for personalized feedback</li>
        </ul>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex gap-4 pt-4">
        <Button 
          variant="outline" 
          onClick={() => navigate('/')}
          className="flex-1"
        >
          <Home className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
        <Button 
          onClick={() => navigate('/analysis')}
          className="flex-1"
        >
          Record Another Swing
        </Button>
      </div>
    </div>
  );
}