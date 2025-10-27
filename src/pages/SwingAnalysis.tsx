import { useState, useEffect } from 'react';
import { CameraCapture } from '@/components/CameraCapture';
import { SwingAnalysisResults } from '@/components/SwingAnalysisResults';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Camera, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { evaluateSwing } from '@/lib/swing-evaluation';
import { saveSwing, saveMetrics, ensureSession } from '@/lib/persistence';
import { uploadVideo } from '@/lib/storage';
import { computePhase1Metrics } from '@/lib/metrics';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { poseWorkerClient, type PoseAnalysisResult } from '@/lib/poseWorkerClient';
import { AppHeader } from '@/components/AppHeader';
import { SplashScreen } from '@/components/SplashScreen';

type FlowStep = 'capture' | 'score' | 'feedback';

export default function SwingAnalysis() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  console.log('SwingAnalysis render - Auth state:', { 
    hasUser: !!user, 
    userEmail: user?.email, 
    loading 
  });
  
  const [currentStep, setCurrentStep] = useState<FlowStep>('capture');
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  
  // Check if user needs to be authenticated for this page
  useEffect(() => {
    console.log('SwingAnalysis component mounted');
    if (!loading && !user) {
      console.log('No user found, redirecting to auth...');
      // Redirect to auth if user is not authenticated
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Warm up the pose model in the background (non-blocking)
  useEffect(() => {
    console.log('Starting background model warming...');
    // Start warming up the model in the background without blocking the UI
    poseWorkerClient.checkReadiness().then((ready: boolean) => {
      console.log('Pose model ready:', ready);
      setIsModelReady(ready);
    }).catch((error: any) => {
      console.log('Pose model initialization deferred:', error);
      // Don't block UI - model will initialize when needed
    });
  }, []);

  const handleCapture = (blob: Blob) => {
    console.log('🎬 === VIDEO CAPTURED ===');
    console.log('🎬 Blob size:', blob.size);
    console.log('🎬 Blob type:', blob.type);
    console.log('🎬 Moving to score step...');
    setVideoBlob(blob);
    setCurrentStep('score');
  };

  const handleAnalysisComplete = async (
    result: PoseAnalysisResult, 
    batSpeedData?: { peak: number; avg: number } | null
  ) => {
    console.log('🟡 === ANALYSIS COMPLETE CALLED ===');
    console.log('🟡 Has result:', !!result);
    console.log('🟡 Has videoBlob:', !!videoBlob); 
    console.log('🟡 VideoBlob size:', videoBlob?.size);
    console.log('🟡 Current step:', currentStep);
    
    try {
      setIsSaving(true);
      console.log('🟢 Set saving to true');

      // Generate metrics from pose analysis data
      console.log('🟢 Computing metrics...');
      const metricsResult = computePhase1Metrics(
        result.keypointsByFrame,
        result.events,
        30 // fps
      );
      console.log('🟢 Metrics computed:', Object.keys(metricsResult.metrics));
      
      // Filter out null values for evaluation
      const validMetrics = Object.fromEntries(
        Object.entries(metricsResult.metrics).filter(([_, value]) => value !== null)
      ) as Record<string, number>;
      console.log('🟢 Valid metrics count:', Object.keys(validMetrics).length);
      
      // Evaluate the swing to get score and coaching cards
      console.log('🟢 Evaluating swing...');
      const evaluation = await evaluateSwing(validMetrics);
      console.log('🟢 Evaluation complete, score:', evaluation.score);

      // Save to database
      const clientRequestId = crypto.randomUUID();
      console.log('🟢 Generated client ID:', clientRequestId);
      
      // Upload video
      let videoUrl = null;
      if (videoBlob) {
        try {
          console.log('📤 === STARTING VIDEO UPLOAD ===');
          console.log('📤 Video blob size:', videoBlob.size);
          console.log('📤 Video blob type:', videoBlob.type);
          
          const uploadResult = await uploadVideo({
            blob: videoBlob,
            client_request_id: clientRequestId
          });
          
          console.log('✅ Upload result received:', uploadResult);
          videoUrl = uploadResult.urlOrPath;
          console.log('✅ Video uploaded successfully to:', videoUrl);
        } catch (uploadError) {
          console.error('❌ === VIDEO UPLOAD FAILED ===');
          console.error('❌ Upload error details:', uploadError);
          toast.error('Video upload failed, but analysis will still be saved');
        }
      } else {
        console.log('⚠️ No video blob available for upload');
      }

      // Get or create athlete for current user
      let athleteId = null;
      if (user?.id) {
        try {
          const { data: existingAthlete, error: athleteQueryError } = await supabase
            .from('athletes')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (athleteQueryError) {
            console.error('Error querying athlete:', athleteQueryError);
          }

          if (existingAthlete) {
            athleteId = existingAthlete.id;
            console.log('Found existing athlete:', athleteId);
          } else {
            // Create a new athlete for this user
            console.log('Creating new athlete for user:', user.id);
            const { data: newAthlete, error: athleteError } = await supabase
              .from('athletes')
              .insert({
                user_id: user.id,
                name: user.email?.split('@')[0] || 'Player'
              })
              .select('id')
              .single();

            if (athleteError) {
              console.error('Failed to create athlete:', athleteError);
              toast.error('Warning: Could not link swing to your profile');
            } else {
              athleteId = newAthlete.id;
              console.log('Created new athlete:', athleteId);
            }
          }
        } catch (error) {
          console.error('Athlete lookup/creation error:', error);
        }
      }

      // Ensure we have a session
      const sessionId = await ensureSession({
        athlete_id: athleteId,
        fps: 30,
        view: 'side'
      });

      // Save swing data with keypoints and bat speed
      const swingId = await saveSwing({
        session_id: sessionId,
        score: evaluation.score,
        cards: evaluation.cards,
        videoUrl,
        client_request_id: clientRequestId,
        keypointsData: {
          keypointsByFrame: result.keypointsByFrame,
          events: result.events
        },
        batSpeedPeak: batSpeedData?.peak,
        batSpeedAvg: batSpeedData?.avg
      });

      // Update user streak after successful swing analysis
      if (user?.id) {
        try {
          await supabase.rpc('update_user_streak', { user_id_param: user.id });
        } catch (error) {
          console.error('Failed to update user streak:', error);
        }
      }

      // Save metrics
      if (Object.keys(validMetrics).length > 0) {
        await saveMetrics({
          swing_id: swingId,
          values: validMetrics
        });
      }

      toast.success('Swing analysis saved successfully!');
      
      // Navigate to the detailed swing analysis page instead of showing basic feedback
      navigate(`/swing/${swingId}`);
    } catch (error) {
      console.error('Analysis save error:', error);
      toast.error('Failed to save analysis. Please try again.');
      // On error, stay on the score step so user can try again
      setCurrentStep('score');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetake = () => {
    setVideoBlob(null);
    setCurrentStep('capture');
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'capture':
        return (
          <div className="space-y-6">
            <div className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                  <Camera className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Record Your Swing</h2>
                <p className="text-white/60 text-base">
                  Position yourself sideways and record your baseball swing
                </p>
                {!isModelReady && (
                  <div className="mt-4 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                    <p className="text-sm font-semibold text-emerald-400">
                      💡 AI model warming up for faster analysis
                    </p>
                  </div>
                )}
              </div>
              <CameraCapture 
                onCapture={handleCapture}
              />
            </div>
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
          <div className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">No Video Recorded</h2>
              <p className="text-white/60 mb-6">Please record a video to continue with analysis.</p>
              <Button 
                onClick={handleRetake} 
                className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold px-8 py-3 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all"
              >
                Try Again
              </Button>
            </div>
          </div>
        );
      
      case 'feedback':
        // Only show saving state - successful completion navigates to SwingDetail page
        if (isSaving) {
          return (
            <div className="space-y-6">
              <div className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] p-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(16,185,129,0.4)] animate-pulse">
                    <BarChart3 className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Saving Analysis</h2>
                  <p className="text-white/60 mb-6">
                    Processing your swing data...
                  </p>
                  <Progress value={75} className="mt-4" />
                </div>
              </div>
            </div>
          );
        }
        
        // This case should not be reached in normal flow since we navigate away on success
        return null;
      
      default:
        return null;
    }
  };

  // Show loading screen while authentication is being checked
  if (loading) {
    return <SplashScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F172A] to-black pb-safe">
      {/* Header */}
      <AppHeader 
        onBack={() => {
          if (currentStep === 'capture') {
            navigate('/');
          } else if (currentStep === 'score') {
            setCurrentStep('capture');
          } else if (currentStep === 'feedback') {
            setCurrentStep('score');
          }
        }}
      />

      {/* Main content */}
      <div className="px-6 py-6">
        {renderStep()}
      </div>
    </div>
  );
}