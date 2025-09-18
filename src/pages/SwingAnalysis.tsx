import { useState } from 'react';
import { CameraCapture } from '@/components/CameraCapture';
import { SwingScoring } from '@/components/SwingScoring';
import { CoachingFeedback } from '@/components/CoachingFeedback';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Camera, BarChart3, Target } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { CoachingCard } from '@/lib/cues';

type FlowStep = 'capture' | 'score' | 'feedback';

export default function SwingAnalysis() {
  const isMobile = useIsMobile();
  const [currentStep, setCurrentStep] = useState<FlowStep>('capture');
  const [poses, setPoses] = useState<any[]>([]);
  const [score, setScore] = useState<number>(0);
  const [coachingCards, setCoachingCards] = useState<CoachingCard[]>([]);

  const handlePoseDetected = (detectedPoses: any[]) => {
    setPoses(detectedPoses);
  };

  const handleCapture = (_blob: Blob) => {
    setCurrentStep('score');
  };

  const handleScoreComplete = (swingScore: number, cards: CoachingCard[]) => {
    setScore(swingScore);
    setCoachingCards(cards);
    setCurrentStep('feedback');
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
          <div className="flex-1">
            {isMobile ? (
              // Mobile: Simple progress bar with current step
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  {currentStep === 'capture' && <Camera className="w-4 h-4 text-primary" />}
                  {currentStep === 'score' && <BarChart3 className="w-4 h-4 text-primary" />}
                  {currentStep === 'feedback' && <Target className="w-4 h-4 text-primary" />}
                  <span className="text-sm font-medium">
                    {currentStep === 'capture' && 'Record'}
                    {currentStep === 'score' && 'Analyze'}
                    {currentStep === 'feedback' && 'Results'}
                  </span>
                </div>
                <Progress 
                  value={
                    currentStep === 'capture' ? 33 : 
                    currentStep === 'score' ? 66 : 100
                  } 
                  className="h-1"
                />
              </div>
            ) : (
              // Desktop: Full step indicator
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
                    currentStep === 'capture' ? 'bg-primary' : 'bg-muted'
                  }`}>
                    <Camera className="w-2 h-2 text-background" />
                  </div>
                  <span className={`text-sm ${
                    currentStep === 'capture' ? 'text-primary font-medium' : 'text-muted-foreground'
                  }`}>Record</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
                    currentStep === 'score' ? 'bg-primary' : 'bg-muted'
                  }`}>
                    <BarChart3 className="w-2 h-2 text-background" />
                  </div>
                  <span className={`text-sm ${
                    currentStep === 'score' ? 'text-primary font-medium' : 'text-muted-foreground'
                  }`}>Analyze</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full flex items-center justify-center ${
                    currentStep === 'feedback' ? 'bg-primary' : 'bg-muted'
                  }`}>
                    <Target className="w-2 h-2 text-background" />
                  </div>
                  <span className={`text-sm ${
                    currentStep === 'feedback' ? 'text-primary font-medium' : 'text-muted-foreground'
                  }`}>Results</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        {renderStep()}
      </div>
    </div>
  );
}