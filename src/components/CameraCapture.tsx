import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { trackCapture } from '@/lib/analytics';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Video, Loader2 } from 'lucide-react';

interface CameraCaptureProps {
  onPoseDetected?: (poses: any[]) => void;
  onCapture?: (videoData: Blob) => void;
}

export function CameraCapture({ onPoseDetected, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const poseWorkerRef = useRef<Worker | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();
  const frameIdRef = useRef<number>(0);
  
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [badAngle, setBadAngle] = useState(false);
  const [currentPoses, setCurrentPoses] = useState<any[]>([]);
  const [workerStatus, setWorkerStatus] = useState<string>('Initializing...');
  const [workerError, setWorkerError] = useState<string>('');
  
  const navigate = useNavigate();

  useEffect(() => {
    const setupCameraAndWorker = async () => {
      try {
        // Initialize pose detection worker
        poseWorkerRef.current = new Worker('/poseWorker.js');
        
        poseWorkerRef.current.onmessage = (e) => {
          const { type, keypoints, confidence, message, error } = e.data;
          
          switch (type) {
            case 'progress':
              setWorkerStatus(message);
              break;
              
            case 'initialized':
              setWorkerStatus('Pose detection ready');
              setIsInitialized(true);
              break;
              
            case 'poses':
              if (keypoints && keypoints.length > 0) {
                const poseData = [{ keypoints, score: confidence }];
                setCurrentPoses(poseData);
                onPoseDetected?.(poseData);
                checkAngle(keypoints);
                drawPoseOverlay(poseData);
              }
              break;
              
            case 'error':
              console.error('Pose worker error:', error);
              setWorkerError(message);
              setWorkerStatus('Pose detection failed');
              break;
          }
        };

        // Initialize the worker
        poseWorkerRef.current.postMessage({ type: 'initialize' });

        // Get camera stream with better error handling and fallbacks
        try {
          // Try back camera first
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              facingMode: 'environment',
              width: { ideal: 720, min: 480 },
              height: { ideal: 1280, min: 640 },
              frameRate: { ideal: 60, min: 15 }
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
        } catch (cameraError) {
          console.error('Back camera setup failed:', cameraError);
          // Try front camera as fallback
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: { 
                facingMode: 'user',
                width: { ideal: 720, min: 480 },
                height: { ideal: 1280, min: 640 },
                frameRate: { ideal: 60, min: 15 }
              },
              audio: false
            });
            setStream(fallbackStream);
            if (videoRef.current) {
              videoRef.current.srcObject = fallbackStream;
              // Apply mirroring for front camera
              videoRef.current.style.transform = 'scaleX(-1)';
              if (overlayCanvasRef.current) {
                overlayCanvasRef.current.style.transform = 'scaleX(-1)';
              }
              videoRef.current.onloadedmetadata = () => {
                startPoseDetectionLoop();
              };
            }
          } catch (frontCameraError) {
            console.error('Front camera fallback failed:', frontCameraError);
            // Try with minimal constraints as last resort
            try {
              const minimalStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
              });
              setStream(minimalStream);
              if (videoRef.current) {
                videoRef.current.srcObject = minimalStream;
                videoRef.current.onloadedmetadata = () => {
                  startPoseDetectionLoop();
                };
              }
            } catch (finalError) {
              setWorkerError('Camera access denied or not available');
              setWorkerStatus('Camera setup failed');
            }
          }
        }
        
      } catch (error) {
        console.error('Setup failed:', error);
        setWorkerError('Failed to initialize pose detection');
        setWorkerStatus('Setup failed');
      }
    };

    setupCameraAndWorker();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (poseWorkerRef.current) {
        poseWorkerRef.current.postMessage({ type: 'cleanup' });
        poseWorkerRef.current.terminate();
      }
    };
  }, []);

  const startPoseDetectionLoop = useCallback(() => {
    const processFrame = () => {
      if (!videoRef.current || !poseWorkerRef.current || !isInitialized) {
        animationFrameRef.current = requestAnimationFrame(processFrame);
        return;
      }

      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (!canvas) {
          animationFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }

        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          animationFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }

        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get image data for pose detection (throttle to ~30fps)
        if (frameIdRef.current % 2 === 0) { // Process every 2nd frame for 30fps from 60fps
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          poseWorkerRef.current.postMessage({
            type: 'processFrame',
            data: {
              imageData: imageData.data,
              width: canvas.width,
              height: canvas.height,
              frameId: frameIdRef.current
            }
          });
        }
        
        frameIdRef.current++;
      } catch (error) {
        console.error('Frame processing error:', error);
      }
      
      animationFrameRef.current = requestAnimationFrame(processFrame);
    };
    
    processFrame();
  }, [isInitialized]);

  const checkAngle = (keypoints: any[]) => {
    // Check shoulder width ratio to determine if user is facing sideways
    const leftShoulder = keypoints.find((kp: any) => kp.name === 'left_shoulder');
    const rightShoulder = keypoints.find((kp: any) => kp.name === 'right_shoulder');
    
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
    if (!isRecording && isInitialized && !workerError) {
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
          // Back camera doesn't need mirroring
        />
        
        {/* Hidden canvas for frame processing */}
        <canvas
          ref={canvasRef}
          className="hidden"
        />
        
        {/* Pose Overlay Canvas */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          // Back camera overlay doesn't need mirroring
        />
        
        {/* Worker Status */}
        {!isInitialized && (
          <div className="absolute top-4 left-4 right-4">
            <Badge variant="secondary" className="w-full justify-center py-2">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {workerStatus}
            </Badge>
          </div>
        )}
        
        {/* Worker Error */}
        {workerError && (
          <div className="absolute top-4 left-4 right-4">
            <Badge variant="destructive" className="w-full justify-center py-2">
              <AlertTriangle className="w-4 h-4 mr-2" />
              {workerError}
            </Badge>
          </div>
        )}
        
        {/* Bad Angle Warning */}
        {badAngle && isInitialized && !workerError && (
          <div className="absolute top-16 left-4 right-4">
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
          disabled={!isInitialized || !stream || !!workerError}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp} // Stop recording if finger leaves button
        >
          {isRecording ? 'STOP' : 'HOLD TO RECORD'}
        </Button>
        
        {!isInitialized && !workerError && (
          <p className="text-white text-sm text-center mt-2">
            {workerStatus}
          </p>
        )}
      </div>
    </div>
  );
}