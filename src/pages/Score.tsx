import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { SwingScoring } from '@/components/SwingScoring';
import { CoachingFeedback } from '@/components/CoachingFeedback';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { CoachingCard } from '@/lib/cues';

export default function Score() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [score, setScore] = useState<number>(0);
  const [coachingCards, setCoachingCards] = useState<CoachingCard[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string>('');
  
  const swingId = searchParams.get('swingId');
  const recordedBlob = location.state?.recordedBlob;
  const poses = location.state?.poses || [];

  useEffect(() => {
    // Create video URL from blob for thumbnail/playback
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      setVideoUrl(url);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [recordedBlob]);

  const handleScoreComplete = (swingScore: number, cards: CoachingCard[]) => {
    setScore(swingScore);
    setCoachingCards(cards);
    setIsAnalyzing(false);
  };

  if (!recordedBlob) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-bold mb-4">No Recording Found</h2>
          <p className="text-muted-foreground mb-4">
            Please record a swing first to see your analysis.
          </p>
          <Link to="/analysis">
            <Button>Go Back to Record</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/analysis">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Swing Analysis</h1>
        </div>

        {/* Video Preview */}
        <Card className="p-4 mb-6">
          <div className="relative">
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg"
              poster="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='100%' height='100%' fill='%23f3f4f6'/><text x='50%' y='50%' text-anchor='middle' fill='%236b7280'>Recorded Swing</text></svg>"
            />
            <div className="absolute top-2 left-2">
              <Button size="sm" variant="secondary" className="gap-2">
                <Play className="w-3 h-3" />
                Play Recording
              </Button>
            </div>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            Swing ID: {swingId} • {poses.length > 0 ? 'Pose data available' : 'No pose data'}
          </div>
        </Card>

        {/* Analysis Section */}
        {isAnalyzing ? (
          <SwingScoring 
            poses={poses}
            onScoreComplete={handleScoreComplete}
          />
        ) : (
          <CoachingFeedback 
            score={score}
            cards={coachingCards}
          />
        )}

        {/* Action Buttons */}
        <div className="mt-8">
          <Link to="/analysis">
            <Button className="w-full" size="lg">
              Record Another Swing
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}