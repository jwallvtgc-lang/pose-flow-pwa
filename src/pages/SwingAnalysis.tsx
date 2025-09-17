import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraCapture } from '@/components/CameraCapture';
import { SwingScoring } from '@/components/SwingScoring';
import { CoachingFeedback } from '@/components/CoachingFeedback';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { CoachingCard } from '@/lib/cues';

type FlowStep = 'capture' | 'score' | 'feedback';

export default function SwingAnalysis() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<FlowStep>('capture');
  const [poses, setPoses] = useState<any[]>([]);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [score, setScore] = useState<number>(0);
  const [coachingCards, setCoachingCards] = useState<CoachingCard[]>([]);

  const handlePoseDetected = (detectedPoses: any[]) => {
    setPoses(detectedPoses);
  };

  const handleCapture = (blob: Blob) => {
    setVideoBlob(blob);
    // Navigate to score page with video blob and fps
    navigate('/score?swingId=NEW', { 
      state: { 
        videoBlob: blob, 
        fps: 30, // Pass fps for analysis
        poses: poses 
      } 
    });
  };

  const handleScoreComplete = (swingScore: number, cards: CoachingCard[]) => {
    setScore(swingScore);
    setCoachingCards(cards);
    setCurrentStep('feedback');
  };

  const resetFlow = () => {
    setCurrentStep('capture');
    setPoses([]);
    setVideoBlob(null);
    setScore(0);
    setCoachingCards([]);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'capture':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Record Your Swing</h1>
              <p className="text-muted-foreground">
                Position yourself sideways and record your baseball swing
              </p>
            </div>
            <CameraCapture 
              onPoseDetected={handlePoseDetected}
              onCapture={handleCapture}
            />
          </div>
        );
      
      case 'score':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Analyzing Your Swing</h1>
              <p className="text-muted-foreground">
                AI is evaluating your swing mechanics
              </p>
            </div>
            <SwingScoring 
              poses={poses}
              onScoreComplete={handleScoreComplete}
            />
          </div>
        );
      
      case 'feedback':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Your Results</h1>
              <p className="text-muted-foreground">
                Personalized coaching feedback and drills
              </p>
            </div>
            <CoachingFeedback 
              score={score}
              cards={coachingCards}
            />
            <div className="flex gap-4">
              <Button 
                onClick={resetFlow}
                className="flex-1"
              >
                Record Another Swing
              </Button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          {currentStep !== 'capture' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (currentStep === 'score') setCurrentStep('capture');
                if (currentStep === 'feedback') setCurrentStep('score');
              }}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          
          {/* Progress indicator */}
          <div className="flex-1 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              currentStep === 'capture' ? 'bg-primary' : 'bg-muted'
            }`} />
            <div className={`w-2 h-2 rounded-full ${
              currentStep === 'score' ? 'bg-primary' : 'bg-muted'
            }`} />
            <div className={`w-2 h-2 rounded-full ${
              currentStep === 'feedback' ? 'bg-primary' : 'bg-muted'
            }`} />
          </div>
        </div>

        {/* Main content */}
        {renderStep()}
      </div>
    </div>
  );
}