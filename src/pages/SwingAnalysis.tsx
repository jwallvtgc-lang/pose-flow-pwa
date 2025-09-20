import { useState } from 'react';
import { CameraCapture } from '@/components/CameraCapture';
import { SwingAnalysisResults } from '@/components/SwingAnalysisResults';
import { CoachingFeedback } from '@/components/CoachingFeedback';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Camera, BarChart3, Target } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { evaluateSwing } from '@/lib/swing-evaluation';
import { saveSwing, saveMetrics, ensureSession } from '@/lib/persistence';
import { uploadVideo } from '@/lib/storage';
import { computePhase1Metrics } from '@/lib/metrics';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { PoseAnalysisResult } from '@/lib/poseWorkerClient';
import type { CoachingCard } from '@/lib/cues';

type FlowStep = 'capture' | 'score' | 'feedback';

export default function SwingAnalysis() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<FlowStep>('capture');
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [analysisResult, setAnalysisResult] = useState<PoseAnalysisResult | null>(null);
  const [swingScore, setSwingScore] = useState<number>(0);
  const [coachingCards, setCoachingCards] = useState<CoachingCard[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleCapture = (blob: Blob) => {
    setVideoBlob(blob);
    setCurrentStep('score');
  };

  const handleAnalysisComplete = async (result: PoseAnalysisResult) => {
    try {
      setAnalysisResult(result);
      setIsSaving(true);

      // Generate metrics from pose analysis data
      const { metrics } = computePhase1Metrics(
        result.keypointsByFrame,
        result.events,
        30 // fps
      );
      
      // Filter out null values for evaluation
      const validMetrics = Object.fromEntries(
        Object.entries(metrics).filter(([_, value]) => value !== null)
      ) as Record<string, number>;
      
      // Evaluate the swing to get score and coaching cards
      const evaluation = await evaluateSwing(validMetrics);
      setSwingScore(evaluation.score);
      setCoachingCards(evaluation.cards);

      // Save to database
      const clientRequestId = crypto.randomUUID();
      
      console.log('Starting save process:', {
        userIdExists: !!user?.id,
        validMetricsCount: Object.keys(validMetrics).length,
        evaluationScore: evaluation.score,
        cardsCount: evaluation.cards.length
      });
      
      // Upload video
      let videoUrl = null;
      if (videoBlob) {
        try {
          const uploadResult = await uploadVideo({
            blob: videoBlob,
            athlete_id: user?.id,
            client_request_id: clientRequestId
          });
          videoUrl = uploadResult.urlOrPath;
          console.log('Video upload successful:', videoUrl);
        } catch (uploadError) {
          console.error('Video upload failed:', uploadError);
          toast.error('Video upload failed, but analysis will still be saved');
        }
      }

      // Ensure we have a session
      console.log('Creating session...');
      const sessionId = await ensureSession({
        athlete_id: user?.id,
        fps: 30,
        view: 'side'
      });
      console.log('Session created:', sessionId);

      // Save swing data
      console.log('Saving swing data...');
      const swingId = await saveSwing({
        session_id: sessionId,
        score: evaluation.score,
        cards: evaluation.cards,
        videoUrl,
        client_request_id: clientRequestId
      });
      console.log('Swing saved with ID:', swingId);

      // Save metrics
      if (Object.keys(validMetrics).length > 0) {
        console.log('Saving metrics:', validMetrics);
        await saveMetrics({
          swing_id: swingId,
          values: validMetrics
        });
        console.log('Metrics saved successfully');
      } else {
        console.warn('No valid metrics to save');
      }

      toast.success('Swing analysis saved successfully!');
      setCurrentStep('feedback');
    } catch (error) {
      console.error('Failed to process swing analysis:', error);
      toast.error('Failed to save analysis. Please try again.');
      // Still show feedback even if saving failed
      setCurrentStep('feedback');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetake = () => {
    setVideoBlob(null);
    setAnalysisResult(null);
    setSwingScore(0);
    setCoachingCards([]);
    setCurrentStep('capture');
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
              onCapture={handleCapture}
            />
          </div>
        );
      
      case 'score':
        return videoBlob ? (
          <SwingAnalysisResults
            videoBlob={videoBlob}
            onRetake={handleRetake}
            onComplete={handleAnalysisComplete}
          />
        ) : (
          <div className="text-center">
            <p className="text-muted-foreground">No video recorded</p>
            <Button onClick={handleRetake} className="mt-4">
              Try Again
            </Button>
          </div>
        );
      
      case 'feedback':
        if (isSaving) {
          return (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">Saving Analysis</h1>
                <p className="text-muted-foreground">
                  Processing your swing data...
                </p>
                <Progress value={75} className="mt-4" />
              </div>
            </div>
          );
        }
        
        return analysisResult && coachingCards.length > 0 ? (
          <CoachingFeedback 
            score={swingScore}
            cards={coachingCards}
          />
        ) : (
          <div className="text-center space-y-4">
            <div>
              <h1 className="text-2xl font-bold mb-2">Your Results</h1>
              <p className="text-muted-foreground">
                Swing analysis complete with coaching feedback
              </p>
            </div>
            <p className="text-lg">Analysis completed successfully!</p>
            <div className="flex gap-4 justify-center">
              <Button onClick={handleRetake}>
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