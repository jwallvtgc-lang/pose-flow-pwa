import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TrendingUp } from 'lucide-react';
import {
  POSE_CONNECTIONS,
  PHASE_DESCRIPTIONS,
  getAdjustedIdealPose,
  type SwingPhase,
  type CameraView,
  type Handedness,
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
  showIdealPose?: boolean;
  showDetectedPose?: boolean;
  idealOpacity?: number;
  selectedPhase?: SwingPhase;
  autoProgress?: boolean;
  cameraView?: CameraView;
  handedness?: Handedness;
  hideControls?: boolean;
}

export function SwingOverlayCanvas({
  videoElement,
  keypointsByFrame,
  currentTime,
  canvasRef,
  showIdealPose: externalShowIdeal,
  showDetectedPose: externalShowDetected,
  idealOpacity: externalIdealOpacity,
  selectedPhase: externalSelectedPhase,
  autoProgress: externalAutoProgress,
  cameraView = 'front',
  handedness = 'right',
  hideControls = false,
}: SwingOverlayCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPhase, setSelectedPhase] = useState<SwingPhase>('contact');
  const [autoProgressPhase, setAutoProgressPhase] = useState(true);
  const [showIdealPose, setShowIdealPose] = useState(true);
  const [showDetectedPose, setShowDetectedPose] = useState(true);
  const [idealOpacity, setIdealOpacity] = useState([70]);
  const [similarity, setSimilarity] = useState<number>(0);
  const [detailedScores, setDetailedScores] = useState<Record<string, number>>({});
  const [frameHistory, setFrameHistory] = useState<FrameData[]>([]);
  const [showDifferenceHighlight, setShowDifferenceHighlight] = useState(true);
  const [showMotionTrails, setShowMotionTrails] = useState(true);
  
  // Use external props if provided, otherwise use internal state
  const effectiveShowIdeal = externalShowIdeal ?? showIdealPose;
  const effectiveShowDetected = externalShowDetected ?? showDetectedPose;
  const effectiveIdealOpacity = externalIdealOpacity !== undefined ? externalIdealOpacity * 100 : idealOpacity[0];
  const effectiveSelectedPhase = externalSelectedPhase ?? selectedPhase;
  const effectiveAutoProgress = externalAutoProgress ?? autoProgressPhase;

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
    
    // Map progress to phases with smoother transitions
    // Stay on each phase a bit longer to better match typical swing timing
    if (progress < 0.15) return 'setup';
    if (progress < 0.30) return 'load';
    if (progress < 0.45) return 'stride';
    if (progress < 0.60) return 'contact';
    if (progress < 0.80) return 'extension';
    return 'finish';
  };

  // Get frame for a specific phase (when manually selecting phases)
  const getFrameForPhase = (phase: SwingPhase): FrameData | null => {
    if (!videoElement || keypointsByFrame.length === 0 || videoElement.duration === 0) {
      return null;
    }
    
    const phases: SwingPhase[] = ['setup', 'load', 'stride', 'contact', 'extension', 'finish'];
    const phaseIndex = phases.indexOf(phase);
    
    // Calculate the midpoint time for this phase
    const phaseProgress = (phaseIndex + 0.5) / phases.length;
    const targetTimeMs = phaseProgress * videoElement.duration * 1000;
    
    // Find closest frame to this time
    let closestFrame = keypointsByFrame[0];
    let minDiff = Math.abs(closestFrame.t - targetTimeMs);
    
    for (const frame of keypointsByFrame) {
      const diff = Math.abs(frame.t - targetTimeMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestFrame = frame;
      }
    }
    
    console.log('🎯 Frame for phase', phase, 'at', targetTimeMs.toFixed(0), 'ms, frame t:', closestFrame.t);
    return closestFrame;
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

  // Scale and align ideal pose to match detected pose
  const scaleIdealPoseToDetected = (
    idealKeypoints: Record<string, { x: number; y: number }>,
    detectedKeypoints: Record<string, { x: number; y: number; score?: number }>,
    canvas: HTMLCanvasElement
  ): Record<string, { x: number; y: number }> => {
    // Calculate bounding boxes
    const getBox = (kps: Record<string, { x: number; y: number }>) => {
      const points = Object.values(kps);
      if (points.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1, centerX: 0.5, centerY: 0.5 };
      
      const xs = points.map(p => p.x);
      const ys = points.map(p => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      
      return {
        minX, maxX, minY, maxY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2,
        width: maxX - minX,
        height: maxY - minY
      };
    };
    
    // Get detected pose box (in normalized coords)
    const normalizedDetected: Record<string, { x: number; y: number }> = {};
    Object.entries(detectedKeypoints).forEach(([key, point]) => {
      if (point.score === undefined || point.score >= 0.3) {
        normalizedDetected[key] = {
          x: point.x / canvas.width,
          y: point.y / canvas.height
        };
      }
    });
    
    const detectedBox = getBox(normalizedDetected);
    const idealBox = getBox(idealKeypoints);
    
    // Scale X and Y independently to match detected pose dimensions
    const scaleX = (detectedBox.width || 1) / (idealBox.width || 1);
    const scaleY = (detectedBox.height || 1) / (idealBox.height || 1);
    
    // Scale and translate ideal pose to match detected pose
    const scaled: Record<string, { x: number; y: number }> = {};
    Object.entries(idealKeypoints).forEach(([key, point]) => {
      // Center at origin, scale independently on X and Y, then move to detected position
      const centeredX = (point.x - idealBox.centerX) * scaleX;
      const centeredY = (point.y - idealBox.centerY) * scaleY;
      
      scaled[key] = {
        x: centeredX + detectedBox.centerX,
        y: centeredY + detectedBox.centerY
      };
    });
    
    return scaled;
  };

  // Get color based on similarity score
  const getColorForSimilarity = (similarity: number): string => {
    if (similarity >= 85) return '#22c55e'; // green - good match
    if (similarity >= 70) return '#eab308'; // yellow - fair match
    return '#ef4444'; // red - needs work
  };

  // Draw skeleton with difference highlighting
  const drawSkeletonWithDifference = (
    ctx: CanvasRenderingContext2D,
    detectedKeypoints: Record<string, { x: number; y: number; score?: number }>,
    idealKeypoints: Record<string, { x: number; y: number }>,
    opacity: number,
    lineWidth: number = 3
  ) => {
    const canvas = ctx.canvas;
    
    // Calculate per-joint distances for color coding
    const jointDistances: Record<string, number> = {};
    Object.keys(detectedKeypoints).forEach(key => {
      if (idealKeypoints[key] && detectedKeypoints[key]) {
        const dx = detectedKeypoints[key].x - idealKeypoints[key].x;
        const dy = detectedKeypoints[key].y - idealKeypoints[key].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        jointDistances[key] = dist;
      }
    });
    
    // Normalize distances to 0-100 scale (0 = perfect match, 100 = max difference)
    const maxDist = Math.max(...Object.values(jointDistances), 0.1);
    const normalizedDistances: Record<string, number> = {};
    Object.entries(jointDistances).forEach(([key, dist]) => {
      normalizedDistances[key] = 100 - (dist / maxDist) * 100;
    });
    
    ctx.globalAlpha = opacity;
    ctx.lineWidth = lineWidth;
    
    // Draw connections with color-coded similarity
    for (const [start, end] of POSE_CONNECTIONS) {
      const startPoint = detectedKeypoints[start];
      const endPoint = detectedKeypoints[end];
      
      if (!startPoint || !endPoint) continue;
      if (startPoint.score !== undefined && startPoint.score < 0.3) continue;
      if (endPoint.score !== undefined && endPoint.score < 0.3) continue;
      
      // Use average similarity of both joints
      const avgSimilarity = ((normalizedDistances[start] || 50) + (normalizedDistances[end] || 50)) / 2;
      ctx.strokeStyle = getColorForSimilarity(avgSimilarity);
      
      ctx.beginPath();
      const startX = startPoint.x * canvas.width;
      const startY = startPoint.y * canvas.height;
      const endX = endPoint.x * canvas.width;
      const endY = endPoint.y * canvas.height;
      
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    
    // Draw keypoints with color-coded similarity
    Object.entries(detectedKeypoints).forEach(([key, point]) => {
      if (point.score !== undefined && point.score < 0.3) return;
      
      const similarity = normalizedDistances[key] || 50;
      ctx.fillStyle = getColorForSimilarity(similarity);
      
      const x = point.x * canvas.width;
      const y = point.y * canvas.height;
      
      ctx.beginPath();
      ctx.arc(x, y, lineWidth * 1.5, 0, 2 * Math.PI);
      ctx.fill();
    });
    
    ctx.globalAlpha = 1;
  };

  // Draw standard skeleton (for ideal pose)
  const drawSkeleton = (
    ctx: CanvasRenderingContext2D,
    keypoints: Record<string, { x: number; y: number; score?: number }>,
    color: string,
    opacity: number,
    lineWidth: number = 3,
    isNormalized: boolean = true
  ) => {
    const canvas = ctx.canvas;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = opacity;
    
    for (const [start, end] of POSE_CONNECTIONS) {
      const startPoint = keypoints[start];
      const endPoint = keypoints[end];
      
      if (!startPoint || !endPoint) continue;
      if (startPoint.score !== undefined && startPoint.score < 0.3) continue;
      if (endPoint.score !== undefined && endPoint.score < 0.3) continue;
      
      ctx.beginPath();
      const startX = isNormalized ? startPoint.x * canvas.width : startPoint.x;
      const startY = isNormalized ? startPoint.y * canvas.height : startPoint.y;
      const endX = isNormalized ? endPoint.x * canvas.width : endPoint.x;
      const endY = isNormalized ? endPoint.y * canvas.height : endPoint.y;
      
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    
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

  // Draw motion trails for key points
  const drawMotionTrails = (
    ctx: CanvasRenderingContext2D,
    frames: FrameData[],
    keyPointNames: string[]
  ) => {
    if (frames.length < 2) return;
    
    const trailLength = Math.min(5, frames.length);
    
    keyPointNames.forEach(keypointName => {
      const keypointIndex = ['nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
        'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
        'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
        'left_knee', 'right_knee', 'left_ankle', 'right_ankle'].indexOf(keypointName);
      
      if (keypointIndex === -1) return;
      
      // Draw trail from oldest to newest
      for (let i = frames.length - trailLength; i < frames.length - 1; i++) {
        if (i < 0) continue;
        
        const frame = frames[i];
        const nextFrame = frames[i + 1];
        
        if (!frame.keypoints[keypointIndex] || !nextFrame.keypoints[keypointIndex]) continue;
        
        const kp1 = frame.keypoints[keypointIndex];
        const kp2 = nextFrame.keypoints[keypointIndex];
        
        if (kp1.score < 0.3 || kp2.score < 0.3) continue;
        
        // Fade based on age (older frames more transparent)
        const age = frames.length - 1 - i;
        const opacity = Math.max(0.1, 1 - (age / trailLength));
        
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = '#8b5cf6'; // purple for trails
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(kp1.x, kp1.y);
        ctx.lineTo(kp2.x, kp2.y);
        ctx.stroke();
      }
    });
    
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
      const currentPhase = effectiveAutoProgress ? getCurrentPhase() : effectiveSelectedPhase;
      
      // Get current frame first to scale ideal pose properly
      const currentFrame = effectiveAutoProgress ? getCurrentFrame() : getFrameForPhase(currentPhase);
      
      if (!currentFrame) return;
      
      // Update frame history for motion trails
      setFrameHistory(prev => {
        const newHistory = [...prev, currentFrame];
        return newHistory.slice(-5); // Keep last 5 frames
      });
      
      const detectedKeypoints = convertDetectedKeypoints(currentFrame);
      
      // Normalize detected keypoints
      const normalizedDetected: Record<string, { x: number; y: number; score?: number }> = {};
      Object.entries(detectedKeypoints).forEach(([key, point]) => {
        normalizedDetected[key] = {
          x: point.x / canvas.width,
          y: point.y / canvas.height,
          score: point.score
        };
      });
      
      const rawIdealKeypoints = getAdjustedIdealPose(currentPhase, cameraView, handedness);
      const scaledIdealKeypoints = scaleIdealPoseToDetected(rawIdealKeypoints, detectedKeypoints, canvas);
      
      // Draw motion trails first (underneath everything)
      if (showMotionTrails && frameHistory.length >= 2) {
        drawMotionTrails(ctx, frameHistory, ['left_wrist', 'right_wrist', 'left_hip', 'right_hip', 'left_shoulder', 'right_shoulder']);
      }
      
      // Draw ideal pose (scaled and aligned to detected pose)
      if (effectiveShowIdeal) {
        drawSkeleton(ctx, scaledIdealKeypoints, '#22c55e', effectiveIdealOpacity / 100, 3, true);
      }
      
      // Draw detected pose with difference highlighting
      if (effectiveShowDetected) {
        if (showDifferenceHighlight && effectiveShowIdeal) {
          // Normalize ideal keypoints for comparison
          const normalizedIdeal: Record<string, { x: number; y: number }> = {};
          Object.entries(scaledIdealKeypoints).forEach(([key, point]) => {
            normalizedIdeal[key] = { x: point.x, y: point.y };
          });
          
          drawSkeletonWithDifference(ctx, normalizedDetected, normalizedIdeal, 0.9, 4);
        } else {
          // Standard blue skeleton
          drawSkeleton(ctx, normalizedDetected, '#3b82f6', 0.9, 4, true);
        }
      }
      
      // Calculate similarity
      const sim = calculatePoseSimilarity(normalizedDetected, rawIdealKeypoints);
      setSimilarity(sim);
      
      const detailed = getDetailedSimilarity(normalizedDetected, rawIdealKeypoints);
      setDetailedScores(detailed);
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
  }, [videoElement, selectedPhase, showIdealPose, showDetectedPose, idealOpacity, keypointsByFrame, currentTime, effectiveShowIdeal, effectiveShowDetected, effectiveIdealOpacity, effectiveSelectedPhase, effectiveAutoProgress, cameraView, handedness]);

  const phases: SwingPhase[] = ['setup', 'load', 'stride', 'contact', 'extension', 'finish'];

  // If hideControls is true, only show body analysis metrics
  if (hideControls) {
    return (
      <div ref={containerRef}>
        {showDetectedPose && showIdealPose && Object.keys(detailedScores).length > 0 && (
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Form Comparison</h3>
                <Badge variant={similarity >= 80 ? "default" : similarity >= 60 ? "secondary" : "destructive"}>
                  <TrendingUp className="w-3 h-3 mr-1" />
                  {similarity}% Match
                </Badge>
              </div>
              
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
            </div>
          </Card>
        )}
      </div>
    );
  }

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

        {/* Visual Enhancement Toggles */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <Label htmlFor="difference-highlight" className="text-sm">Difference Highlighting</Label>
            <Switch
              id="difference-highlight"
              checked={showDifferenceHighlight}
              onCheckedChange={setShowDifferenceHighlight}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="motion-trails" className="text-sm">Motion Trails</Label>
            <Switch
              id="motion-trails"
              checked={showMotionTrails}
              onCheckedChange={setShowMotionTrails}
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
        
        {/* Legend for difference highlighting */}
        {showDifferenceHighlight && showDetectedPose && showIdealPose && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-sm font-medium">Color Guide</Label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Good</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span>Fair</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>Focus</span>
              </div>
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
