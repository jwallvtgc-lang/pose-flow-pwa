import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TrendingUp } from 'lucide-react';
import {
  IDEAL_SWING_KEYPOINTS,
  POSE_CONNECTIONS,
  PHASE_DESCRIPTIONS,
  type SwingPhase,
} from '@/lib/idealSwingData';
import { calculatePoseSimilarity, getDetailedSimilarity } from '@/lib/swingSimilarity';

interface FrameData {
  keypoints: Array<{ x: number; y: number; score: number; name?: string }>;
  t: number;
}

interface SwingOverlayCanvasProps {
  videoElement: HTMLVideoElement;
  keypointsByFrame: FrameData[];
  currentTime?: number;
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export function SwingOverlayCanvas({
  videoElement,
  keypointsByFrame,
  currentTime,
  canvasRef,
}: SwingOverlayCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPhase, setSelectedPhase] = useState<SwingPhase>('contact');
  const [autoProgressPhase, setAutoProgressPhase] = useState(true);
  const [showIdealPose, setShowIdealPose] = useState(true);
  const [showDetectedPose, setShowDetectedPose] = useState(true);
  const [idealOpacity, setIdealOpacity] = useState([70]);
  const [similarity, setSimilarity] = useState<number>(0);
  const [detailedScores, setDetailedScores] = useState<Record<string, number>>({});

  // Setup canvas dimensions - ensure they match video
  useEffect(() => {
    const setupCanvas = () => {
      if (!canvasRef.current || !videoElement) return;
      
      const canvas = canvasRef.current;
      if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        console.log('🎨 Canvas sized:', canvas.width, 'x', canvas.height);
      }
    };

    console.log('🔧 SwingOverlayCanvas mounted with', keypointsByFrame.length, 'frames');
    setupCanvas();
    videoElement.addEventListener('loadedmetadata', setupCanvas);

    return () => {
      videoElement.removeEventListener('loadedmetadata', setupCanvas);
    };
  }, [videoElement, canvasRef, keypointsByFrame]);

  // Get current swing phase based on video progress
  const getCurrentPhase = (): SwingPhase => {
    if (!videoElement || videoElement.duration === 0) return 'contact';
    
    const progress = videoElement.currentTime / videoElement.duration;
    const phases: SwingPhase[] = ['setup', 'load', 'stride', 'contact', 'extension', 'finish'];
    
    // Divide video into equal segments for each phase
    const phaseIndex = Math.min(Math.floor(progress * phases.length), phases.length - 1);
    return phases[phaseIndex];
  };

  // Get current frame based on video time
  const getCurrentFrame = (): FrameData | null => {
    if (!videoElement || keypointsByFrame.length === 0) {
      console.log('❌ No video or keypoints:', { hasVideo: !!videoElement, frameCount: keypointsByFrame.length });
      return null;
    }
    
    const currentTimeMs = (currentTime ?? videoElement.currentTime) * 1000;
    
    // Find closest frame
    let closestFrame = keypointsByFrame[0];
    let minDiff = Math.abs(closestFrame.t - currentTimeMs);
    
    for (const frame of keypointsByFrame) {
      const diff = Math.abs(frame.t - currentTimeMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestFrame = frame;
      }
    }
    
    console.log('🎯 Current frame at', currentTimeMs.toFixed(0), 'ms, frame t:', closestFrame.t, 'keypoints:', closestFrame.keypoints.length);
    return closestFrame;
  };

  // Draw skeleton on canvas
  const drawSkeleton = (
    ctx: CanvasRenderingContext2D,
    keypoints: Record<string, { x: number; y: number; score?: number }>,
    color: string,
    opacity: number,
    lineWidth: number = 3,
    isNormalized: boolean = true  // ideal poses are normalized, detected poses are pixel coords
  ) => {
    const canvas = ctx.canvas;
    
    // Draw connections
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = opacity;
    
    for (const [start, end] of POSE_CONNECTIONS) {
      const startPoint = keypoints[start];
      const endPoint = keypoints[end];
      
      if (!startPoint || !endPoint) continue;
      
      // Skip if detected pose has low confidence
      if (startPoint.score !== undefined && startPoint.score < 0.3) continue;
      if (endPoint.score !== undefined && endPoint.score < 0.3) continue;
      
      ctx.beginPath();
      // Only multiply by dimensions if keypoints are normalized (0-1 range)
      const startX = isNormalized ? startPoint.x * canvas.width : startPoint.x;
      const startY = isNormalized ? startPoint.y * canvas.height : startPoint.y;
      const endX = isNormalized ? endPoint.x * canvas.width : endPoint.x;
      const endY = isNormalized ? endPoint.y * canvas.height : endPoint.y;
      
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    
    // Draw keypoints
    ctx.fillStyle = color;
    for (const point of Object.values(keypoints)) {
      if (point.score !== undefined && point.score < 0.3) continue;
      
      const x = isNormalized ? point.x * canvas.width : point.x;
      const y = isNormalized ? point.y * canvas.height : point.y;
      
      ctx.beginPath();
      ctx.arc(x, y, lineWidth * 1.5, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    ctx.globalAlpha = 1;
  };

  // Convert detected keypoints array to object
  const convertDetectedKeypoints = (frame: FrameData) => {
    const keypointNames = [
      'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
      'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
      'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
      'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
    ];
    
    const result: Record<string, { x: number; y: number; score: number }> = {};
    
    frame.keypoints.forEach((kp, index) => {
      if (index < keypointNames.length) {
        result[keypointNames[index]] = {
          x: kp.x,
          y: kp.y,
          score: kp.score
        };
      }
    });
    
    // Log sample keypoint for debugging
    const sampleKp = result['nose'];
    console.log('👤 Converted keypoints sample (nose):', sampleKp, 'total points:', Object.keys(result).length);
    
    return result;
  };

  // Update canvas on frame change
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !videoElement) return;

    const updateCanvas = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Auto-progress phase based on video time if enabled
      const currentPhase = autoProgressPhase ? getCurrentPhase() : selectedPhase;
      
      // Draw ideal pose (normalized coordinates)
      if (showIdealPose) {
        const idealKeypoints = IDEAL_SWING_KEYPOINTS[currentPhase];
        drawSkeleton(ctx, idealKeypoints, '#22c55e', idealOpacity[0] / 100, 4, true);
      }
      
      // Draw detected pose (pixel coordinates)
      if (showDetectedPose) {
        const currentFrame = getCurrentFrame();
        if (currentFrame) {
          const detectedKeypoints = convertDetectedKeypoints(currentFrame);
          console.log('🔵 Drawing blue pose, keypoints:', Object.keys(detectedKeypoints).length);
          // Draw with pixel coordinates (not normalized), higher opacity and thicker lines
          drawSkeleton(ctx, detectedKeypoints, '#3b82f6', 0.9, 4, false);
          
          // Calculate similarity - normalize detected keypoints first
          const idealKeypoints = IDEAL_SWING_KEYPOINTS[currentPhase];
          // Normalize detected keypoints to 0-1 range for comparison
          const normalizedDetected: Record<string, { x: number; y: number; score?: number }> = {};
          Object.entries(detectedKeypoints).forEach(([key, point]) => {
            normalizedDetected[key] = {
              x: point.x / canvas.width,
              y: point.y / canvas.height,
              score: point.score
            };
          });
          
          const sim = calculatePoseSimilarity(normalizedDetected, idealKeypoints);
          console.log('📊 Similarity calculated:', sim, '%');
          setSimilarity(sim);
          
          const detailed = getDetailedSimilarity(normalizedDetected, idealKeypoints);
          console.log('🎯 Detailed scores:', detailed);
          setDetailedScores(detailed);
        } else {
          console.log('❌ No current frame found for drawing');
        }
      } else {
        console.log('👁️ Detected pose display is OFF');
      }
    };

    // Update on time change
    const handleTimeUpdate = () => {
      requestAnimationFrame(updateCanvas);
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('play', handleTimeUpdate);
    videoElement.addEventListener('pause', handleTimeUpdate);
    videoElement.addEventListener('seeked', handleTimeUpdate);
    
    // Initial draw and redraw when phase changes
    requestAnimationFrame(updateCanvas);

    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('play', handleTimeUpdate);
      videoElement.removeEventListener('pause', handleTimeUpdate);
      videoElement.removeEventListener('seeked', handleTimeUpdate);
    };
  }, [videoElement, selectedPhase, showIdealPose, showDetectedPose, idealOpacity, keypointsByFrame, currentTime]);

  const phases: SwingPhase[] = ['setup', 'load', 'stride', 'contact', 'extension', 'finish'];

  return (
    <div ref={containerRef}>
      {/* Controls */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Form Comparison</h3>
          {showDetectedPose && showIdealPose && (
            <Badge variant={similarity >= 80 ? "default" : similarity >= 60 ? "secondary" : "destructive"}>
              <TrendingUp className="w-3 h-3 mr-1" />
              {similarity}% Match
            </Badge>
          )}
        </div>

        {/* Auto-Progress Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-progress" className="text-sm">Auto-progress phases</Label>
          <Switch
            id="auto-progress"
            checked={autoProgressPhase}
            onCheckedChange={setAutoProgressPhase}
          />
        </div>

        {/* Phase Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Swing Phase {autoProgressPhase && "(Auto)"}
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {phases.map((phase) => (
              <Button
                key={phase}
                variant={selectedPhase === phase ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedPhase(phase);
                  setAutoProgressPhase(false);
                }}
                className="capitalize"
                disabled={autoProgressPhase}
              >
                {phase}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {PHASE_DESCRIPTIONS[autoProgressPhase ? getCurrentPhase() : selectedPhase]}
          </p>
        </div>

        {/* Toggle Controls */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <Label htmlFor="ideal-toggle" className="text-sm">Ideal Form</Label>
            </div>
            <Switch
              id="ideal-toggle"
              checked={showIdealPose}
              onCheckedChange={setShowIdealPose}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <Label htmlFor="detected-toggle" className="text-sm">Your Form</Label>
            </div>
            <Switch
              id="detected-toggle"
              checked={showDetectedPose}
              onCheckedChange={setShowDetectedPose}
            />
          </div>
        </div>

        {/* Opacity Slider */}
        {showIdealPose && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Ideal Form Opacity</Label>
            <Slider
              value={idealOpacity}
              onValueChange={setIdealOpacity}
              min={10}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground text-right">
              {idealOpacity[0]}%
            </div>
          </div>
        )}

        {/* Detailed Scores */}
        {showDetectedPose && showIdealPose && Object.keys(detailedScores).length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-sm font-medium">Body Part Analysis</Label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(detailedScores).map(([part, score]) => (
                <div key={part} className="flex justify-between items-center p-2 bg-muted rounded">
                  <span className="capitalize">{part.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <Badge variant={score >= 70 ? "default" : "secondary"} className="text-xs">
                    {score}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
