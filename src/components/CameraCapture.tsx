import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { initializeTensorFlow, detectPoses } from '@/lib/tf';
import { trackCapture } from '@/lib/analytics';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Video, Clock } from 'lucide-react';

interface CameraCaptureProps {
  onPoseDetected?: (poses: any[]) => void;
  onCapture?: (videoData: Blob) => void;
}

export function CameraCapture({ onPoseDetected, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [badAngle, setBadAngle] = useState(false);
  const [currentPoses, setCurrentPoses] = useState<any[]>([]);
  
  const navigate = useNavigate();

  useEffect(() => {
    const setupCamera = async () => {
      try {
        // Initialize TensorFlow
        await initializeTensorFlow();
        setIsInitialized(true);

        // Get camera stream with portrait orientation
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user',
            width: { ideal: 720 },
            height: { ideal: 1280 },
            frameRate: { ideal: 60, min: 30 }
          },
          audio: false
        });
        
        setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.onloadedmetadata = () => {
            startPoseDetectionLoop();
          };
        }
      } catch (error) {
        console.error('Camera setup failed:', error);
      }
    };

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const startPoseDetectionLoop = useCallback(async () => {
    if (!videoRef.current || !isInitialized) return;
    
    try {
      const poses = await detectPoses(videoRef.current);
      setCurrentPoses(poses);
      
      if (poses.length > 0) {
        onPoseDetected?.(poses);
        
        // Check for bad angle (frontal vs side view)
        const pose = poses[0];
        if (pose.keypoints) {
          checkAngle(pose);
        }
        
        // Draw pose overlay
        drawPoseOverlay(poses);
      }
    } catch (error) {
      console.error('Pose detection error:', error);
    }
    
    animationFrameRef.current = requestAnimationFrame(startPoseDetectionLoop);
  }, [isInitialized, onPoseDetected]);

  const checkAngle = (pose: any) => {
    // Check shoulder width ratio to determine if user is facing sideways
    const leftShoulder = pose.keypoints.find((kp: any) => kp.part === 'leftShoulder' || kp.name === 'left_shoulder');
    const rightShoulder = pose.keypoints.find((kp: any) => kp.part === 'rightShoulder' || kp.name === 'right_shoulder');
    
    if (leftShoulder && rightShoulder && leftShoulder.score > 0.5 && rightShoulder.score > 0.5) {
      const shoulderDistance = Math.abs(leftShoulder.x - rightShoulder.x);
      const videoWidth = videoRef.current?.videoWidth || 720;
      const shoulderRatio = shoulderDistance / videoWidth;
      
      // If shoulders are too wide apart, user is likely facing forward (bad angle)
      setBadAngle(shoulderRatio > 0.15);
    }
  };

  const drawPoseOverlay = (poses: any[]) => {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw side-view silhouette guide
    drawSilhouetteGuide(ctx, canvas.width, canvas.height);
    
    // Draw detected poses
    poses.forEach(pose => {
      if (pose.keypoints) {
        pose.keypoints.forEach((keypoint: any) => {
          const confidence = keypoint.score || keypoint.confidence || 0;
          if (confidence > 0.3) {
            ctx.beginPath();
            ctx.arc(keypoint.x, keypoint.y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = badAngle ? '#ef4444' : '#10b981';
            ctx.fill();
          }
        });
      }
    });
  };

  const drawSilhouetteGuide = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    // Draw a simple side-view baseball stance silhouette guide
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const scale = Math.min(width, height) * 0.3;
    
    ctx.beginPath();
    // Head
    ctx.arc(centerX - scale * 0.1, centerY - scale * 0.4, scale * 0.08, 0, 2 * Math.PI);
    // Body
    ctx.moveTo(centerX - scale * 0.1, centerY - scale * 0.32);
    ctx.lineTo(centerX - scale * 0.1, centerY + scale * 0.1);
    // Arms (batting stance)
    ctx.moveTo(centerX - scale * 0.1, centerY - scale * 0.2);
    ctx.lineTo(centerX - scale * 0.25, centerY - scale * 0.15);
    ctx.moveTo(centerX - scale * 0.1, centerY - scale * 0.1);
    ctx.lineTo(centerX + scale * 0.15, centerY - scale * 0.05);
    // Legs
    ctx.moveTo(centerX - scale * 0.1, centerY + scale * 0.1);
    ctx.lineTo(centerX - scale * 0.2, centerY + scale * 0.4);
    ctx.moveTo(centerX - scale * 0.1, centerY + scale * 0.1);
    ctx.lineTo(centerX + scale * 0.05, centerY + scale * 0.4);
    ctx.stroke();
  };

  const startRecording = useCallback(() => {
    if (!stream || !videoRef.current) return;

    trackCapture.started();
    
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
    });
    mediaRecorderRef.current = mediaRecorder;
    
    const chunks: Blob[] = [];
    recordingStartTimeRef.current = Date.now();
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      setRecordedBlob(blob);
      onCapture?.(blob);
      
      // Navigate to score page with blob
      navigate('/score?swingId=NEW', { 
        state: { recordedBlob: blob, poses: currentPoses } 
      });
    };
    
    mediaRecorder.start(100); // Record in 100ms chunks for smooth recording
    setIsRecording(true);
    
    // Update duration display
    const updateDuration = () => {
      if (isRecording) {
        setRecordingDuration(Date.now() - recordingStartTimeRef.current);
        requestAnimationFrame(updateDuration);
      }
    };
    updateDuration();
  }, [stream, navigate, currentPoses, onCapture, isRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const handlePointerDown = () => {
    if (!isRecording) {
      startRecording();
    }
  };

  const handlePointerUp = () => {
    if (isRecording) {
      stopRecording();
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative min-h-screen bg-black">
      {/* Camera Preview */}
      <div className="relative w-full h-screen overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }} // Mirror for selfie mode
        />
        
        {/* Pose Overlay Canvas */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ transform: 'scaleX(-1)' }}
        />
        
        {/* Bad Angle Warning */}
        {badAngle && (
          <div className="absolute top-4 left-4 right-4">
            <Badge variant="destructive" className="w-full justify-center py-2">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Bad angle - Turn sideways for better swing analysis
            </Badge>
          </div>
        )}
        
        {/* Guidance Text */}
        <div className="absolute top-20 left-4 right-4 text-center">
          <p className="text-white text-sm bg-black/50 rounded px-3 py-1">
            Stand sideways and hold the record button during your swing
          </p>
        </div>
        
        {/* Recording Status */}
        {isRecording && (
          <div className="absolute top-4 right-4">
            <Badge variant="destructive" className="animate-pulse">
              <Video className="w-4 h-4 mr-1" />
              REC {formatDuration(recordingDuration)}
            </Badge>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <Button
          size="lg"
          className={`w-24 h-24 rounded-full text-white font-bold text-lg ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
              : 'bg-primary hover:bg-primary/90'
          }`}
          disabled={!isInitialized || !stream}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp} // Stop recording if finger leaves button
        >
          {isRecording ? 'STOP' : 'HOLD TO RECORD'}
        </Button>
        
        {!isInitialized && (
          <p className="text-white text-sm text-center mt-2">
            Initializing camera...
          </p>
        )}
      </div>
    </div>
  );
}