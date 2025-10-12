import { useState, useEffect } from 'react';
import { CameraCapture } from '@/components/CameraCapture';
import { SwingAnalysisResults } from '@/components/SwingAnalysisResults';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Camera, BarChart3, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { evaluateSwing } from '@/lib/swing-evaluation';
import { saveSwing, saveMetrics, ensureSession } from '@/lib/persistence';
import { uploadVideo } from '@/lib/storage';
import { computePhase1Metrics } from '@/lib/metrics';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { poseWorkerClient, type PoseAnalysisResult } from '@/lib/poseWorkerClient';

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

      // Ensure we have a session
      const sessionId = await ensureSession({
        athlete_id: null,
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
          <div className="space-y-6 animate-fade-in-up">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse-soft">
                  <Camera className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Record Your Swing</h2>
                <p className="text-gray-600 text-base">
                  Position yourself sideways and record your baseball swing
                </p>
                {!isModelReady && (
                  <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                    <p className="text-sm font-semibold text-blue-700">
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
          <div className="bg-white rounded-2xl p-8 shadow-sm">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">No Video Recorded</h2>
              <p className="text-gray-600 mb-6">Please record a video to continue with analysis.</p>
              <Button 
                onClick={handleRetake} 
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95"
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
            <div className="space-y-6 animate-fade-in-up">
              <div className="bg-white rounded-2xl p-8 shadow-sm">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg animate-pulse-soft">
                    <BarChart3 className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 mb-2">Saving Analysis</h2>
                  <p className="text-gray-600 mb-6">
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
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600 font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-safe">
      {/* Gradient Header with Shimmer */}
      <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 pt-safe rounded-b-[2rem] pb-6 px-6 shadow-lg relative overflow-hidden shimmer-bg">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (currentStep === 'capture') {
                navigate('/');
              } else if (currentStep === 'score') {
                setCurrentStep('capture');
              } else if (currentStep === 'feedback') {
                setCurrentStep('score');
              }
            }}
            className="text-white hover:bg-white/20 h-10 w-10 p-0 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-3 animate-fade-in-up">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-xl">S</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">SwingSense</h1>
          </div>
          
          <div className="w-10"></div>
        </div>

        {/* Progress indicator inside header */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              currentStep === 'capture' 
                ? 'bg-white/30 backdrop-blur-sm scale-110' 
                : 'bg-white/10'
            }`}>
              <Camera className="w-5 h-5 text-white" />
            </div>
            <span className={`text-xs font-bold transition-all ${
              currentStep === 'capture' ? 'text-white' : 'text-white/60'
            }`}>Record</span>
          </div>
          
          <div className={`w-6 h-0.5 rounded transition-all ${
            currentStep === 'score' || currentStep === 'feedback' 
              ? 'bg-white/60' 
              : 'bg-white/20'
          }`}></div>
          
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              currentStep === 'score' 
                ? 'bg-white/30 backdrop-blur-sm scale-110' 
                : currentStep === 'feedback'
                ? 'bg-white/20'
                : 'bg-white/10'
            }`}>
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <span className={`text-xs font-bold transition-all ${
              currentStep === 'score' ? 'text-white' : 'text-white/60'
            }`}>Analyze</span>
          </div>
          
          <div className={`w-6 h-0.5 rounded transition-all ${
            currentStep === 'feedback' ? 'bg-white/60' : 'bg-white/20'
          }`}></div>
          
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              currentStep === 'feedback' 
                ? 'bg-white/30 backdrop-blur-sm scale-110' 
                : 'bg-white/10'
            }`}>
              <Target className="w-5 h-5 text-white" />
            </div>
            <span className={`text-xs font-bold transition-all ${
              currentStep === 'feedback' ? 'text-white' : 'text-white/60'
            }`}>Results</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="px-6 -mt-4">
        {renderStep()}
      </div>
    </div>
  );
}