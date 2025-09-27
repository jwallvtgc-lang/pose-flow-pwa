import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { trackCapture } from '@/lib/analytics';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, Play, Square, Star, Camera, ArrowLeft } from 'lucide-react';

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
  const [badAngle, setBadAngle] = useState(false);
  const [currentPoses, setCurrentPoses] = useState<any[]>([]);
  const [workerStatus, setWorkerStatus] = useState<string>('Initializing...');
  const [workerError, setWorkerError] = useState<string>('');
  
  const navigate = useNavigate();

  useEffect(() => {
    console.log('DEBUG: CameraCapture component mounted');
    const setupWorkerOnly = async () => {
      try {
        console.log('DEBUG: Starting worker initialization...');
        // Initialize pose detection worker (but not camera yet)
        poseWorkerRef.current = new Worker('/poseWorker.js');
        
        poseWorkerRef.current.onmessage = (e) => {
          const { type, keypoints, confidence, message, error } = e.data;
          
          switch (type) {
            case 'progress':
              setWorkerStatus(message);
              break;
              
            case 'initialized':
              setWorkerStatus('Ready to record');
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
        
      } catch (error) {
        console.error('Worker setup failed:', error);
        setWorkerError('Failed to initialize pose detection');
        setWorkerStatus('Setup failed');
      }
    };

    setupWorkerOnly();

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

  const setupCamera = useCallback(async () => {
    if (stream) {
      console.log('DEBUG: Camera stream already exists, skipping setup');
      return; // Already have camera stream
    }
    
    try {
      console.log('DEBUG: Starting camera setup...');
      console.log('DEBUG: Checking media devices support...');
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported in this browser');
      }
      
      console.log('DEBUG: Media devices supported, checking permissions...');
      
      // Check current permission state
      if (navigator.permissions) {
        try {
          const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          console.log('DEBUG: Camera permission state:', permission.state);
        } catch (permError) {
          console.log('DEBUG: Could not check permission state:', permError);
        }
      }
      
      console.log('DEBUG: Attempting to get back camera stream...');
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
      
      console.log('DEBUG: Back camera stream obtained successfully:', {
        tracks: mediaStream.getVideoTracks().length,
        active: mediaStream.active,
        settings: mediaStream.getVideoTracks()[0]?.getSettings()
      });
      
      setStream(mediaStream);
      setWorkerError(''); // Clear any previous errors
      
      if (videoRef.current) {
        console.log('DEBUG: Setting video source...');
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          console.log('DEBUG: Video metadata loaded, dimensions:', {
            videoWidth: videoRef.current?.videoWidth,
            videoHeight: videoRef.current?.videoHeight
          });
          startPoseDetectionLoop();
        };
        videoRef.current.onerror = (error) => {
          console.error('DEBUG: Video element error:', error);
          setWorkerError('Video playback failed');
        };
      }
    } catch (cameraError: any) {
      console.error('DEBUG: Back camera setup failed:', {
        name: cameraError?.name,
        message: cameraError?.message,
        stack: cameraError?.stack
      });
      
      // Try front camera as fallback
      try {
        console.log('DEBUG: Attempting front camera fallback...');
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user',
            width: { ideal: 720, min: 480 },
            height: { ideal: 1280, min: 640 },
            frameRate: { ideal: 60, min: 15 }
          },
          audio: false
        });
        
        console.log('DEBUG: Front camera stream obtained:', {
          tracks: fallbackStream.getVideoTracks().length,
          active: fallbackStream.active,
          settings: fallbackStream.getVideoTracks()[0]?.getSettings()
        });
        
        setStream(fallbackStream);
        setWorkerError(''); // Clear any previous errors
        
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          // Apply mirroring for front camera
          videoRef.current.style.transform = 'scaleX(-1)';
          if (overlayCanvasRef.current) {
            overlayCanvasRef.current.style.transform = 'scaleX(-1)';
          }
          videoRef.current.onloadedmetadata = () => {
            console.log('DEBUG: Front camera video metadata loaded');
            startPoseDetectionLoop();
          };
          videoRef.current.onerror = (error) => {
            console.error('DEBUG: Front camera video element error:', error);
            setWorkerError('Video playback failed');
          };
        }
      } catch (frontCameraError: any) {
        console.error('DEBUG: Front camera fallback failed:', {
          name: frontCameraError?.name,
          message: frontCameraError?.message
        });
        
        // Try with minimal constraints as last resort
        try {
          console.log('DEBUG: Attempting minimal constraints fallback...');
          const minimalStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
          
          console.log('DEBUG: Minimal constraints stream obtained:', {
            tracks: minimalStream.getVideoTracks().length,
            active: minimalStream.active
          });
          
          setStream(minimalStream);
          setWorkerError(''); // Clear any previous errors
          
          if (videoRef.current) {
            videoRef.current.srcObject = minimalStream;
            videoRef.current.onloadedmetadata = () => {
              console.log('DEBUG: Minimal constraints video metadata loaded');
              startPoseDetectionLoop();
            };
            videoRef.current.onerror = (error) => {
              console.error('DEBUG: Minimal constraints video element error:', error);
              setWorkerError('Video playback failed');
            };
          }
        } catch (finalError: any) {
          console.error('DEBUG: All camera setup attempts failed:', {
            name: finalError?.name,
            message: finalError?.message,
            stack: finalError?.stack
          });
          
          let errorMessage = 'Camera access denied or not available';
          if (finalError?.name === 'NotAllowedError') {
            errorMessage = 'Camera access denied - please allow camera permissions and refresh';
          } else if (finalError?.name === 'NotFoundError') {
            errorMessage = 'No camera found on this device';
          } else if (finalError?.name === 'NotReadableError') {
            errorMessage = 'Camera is being used by another application';
          }
          
          setWorkerError(errorMessage);
          setWorkerStatus('Camera setup failed');
        }
      }
    }
  }, [stream, startPoseDetectionLoop]);

  const startRecording = useCallback(async () => {
    console.log('DEBUG: Start recording requested');
    console.log('DEBUG: Current stream state:', stream ? 'exists' : 'null');
    console.log('DEBUG: Current video ref state:', videoRef.current ? 'exists' : 'null');
    console.log('DEBUG: Worker initialized:', isInitialized);
    console.log('DEBUG: Worker error:', workerError);
    
    // Setup camera first if not already done
    if (!stream) {
      console.log('DEBUG: No stream exists, setting up camera...');
      await setupCamera();
      // Wait a moment for camera to stabilize
      console.log('DEBUG: Waiting for camera to stabilize...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('DEBUG: After setup - stream:', stream ? 'exists' : 'null');
    console.log('DEBUG: After setup - video ref:', videoRef.current ? 'exists' : 'null');
    
    if (!stream || !videoRef.current) {
      console.error('DEBUG: No camera stream available for recording after setup');
      setWorkerError('Camera not available - please allow camera access and refresh the page');
      return;
    }
    
    console.log('DEBUG: Video element ready state:', videoRef.current.readyState);
    console.log('DEBUG: Video element dimensions:', {
      videoWidth: videoRef.current.videoWidth,
      videoHeight: videoRef.current.videoHeight
    });

    trackCapture.started();
    console.log('Recording started');
    
    // Determine the best supported mimeType
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/mp4';
    
    console.log('Using mimeType for recording:', mimeType);
    
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mediaRecorder;
    
    const chunks: Blob[] = [];
    recordingStartTimeRef.current = Date.now();
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
        console.log('Chunk received:', event.data.size, 'bytes');
      }
    };
    
    mediaRecorder.onstop = () => {
      const recordingDuration = Date.now() - recordingStartTimeRef.current;
      console.log(`Recording stopped after ${recordingDuration}ms, creating blob with`, chunks.length, 'chunks');
      
      if (chunks.length === 0) {
        console.error('No video chunks recorded!');
        setWorkerError('Recording failed - no video data captured');
        return;
      }
      
      const blob = new Blob(chunks, { type: mimeType });
      console.log('Created video blob:', { 
        size: blob.size, 
        type: blob.type, 
        duration: recordingDuration 
      });
      
      // More lenient validation
      if (blob.size === 0) {
        console.error('Created empty video blob!');
        setWorkerError('Recording failed - empty video file');
        return;
      }
      
      // Lower threshold for minimum size and ensure minimum recording duration
      if (blob.size < 100 || recordingDuration < 500) {
        console.error('Video blob too small or recording too short:', { size: blob.size, duration: recordingDuration });
        setWorkerError('Recording too short - please record for at least 1 second');
        return;
      }
      
      onCapture?.(blob);
    };

    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event);
      setWorkerError('Recording failed - please try again');
    };
    
    try {
      mediaRecorder.start(250); // Record in 250ms chunks for better compatibility
    } catch (error) {
      console.error('Failed to start recording:', error);
      setWorkerError('Failed to start recording - please try again');
      return;
    }
    setIsRecording(true);
  }, [stream, navigate, currentPoses, onCapture]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop the camera stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      
      // Clear video source
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [isRecording, stream]);

  const toggleRecording = () => {
    console.log('DEBUG: Toggle recording clicked', {
      isRecording,
      isInitialized,
      workerError,
      hasStream: !!stream
    });
    
    if (!isRecording && (isInitialized || !workerError)) {
      startRecording();
    } else if (isRecording) {
      stopRecording();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col p-4">
      {/* Header with Back Button */}
      <div className="flex items-center mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="mr-4"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">Record Your Swing</h1>
      </div>

      {/* Video Recording Area */}
      <div className="relative bg-slate-800 rounded-2xl overflow-hidden mb-6" style={{ height: '240px' }}>
        {(!stream && !isInitialized) || workerError ? (
          <div className="flex items-center justify-center h-full text-white">
            <div className="flex flex-col items-center">
              <div className="bg-gray-600 rounded-full p-6 mb-4">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Ready to Record</h3>
                <p className="text-sm text-gray-300">
                  Tap the record button to start your swing analysis
                </p>
                {!isInitialized && !workerError && (
                  <div className="flex items-center justify-center mt-4">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span className="text-sm">{workerStatus}</span>
                  </div>
                )}
                {workerError && (
                  <div className="flex flex-col items-center mt-4">
                    <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
                    <p className="text-center text-sm text-red-400">{workerError}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* Hidden canvas for frame processing */}
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Pose Overlay Canvas */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            />
            
            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-4 left-4">
                <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center">
                  <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                  REC
                </div>
              </div>
            )}
            
            {/* Status overlay for recording state - semi-transparent */}
            {isRecording && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="text-center text-white">
                  <h3 className="text-xl font-semibold mb-2">Recording...</h3>
                  <p className="text-sm opacity-80">AI analyzing your swing mechanics</p>
                  <div className="flex justify-center mt-4 space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <div 
                        key={i} 
                        className="w-2 h-6 bg-blue-400 rounded animate-pulse"
                        style={{ animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Bad Angle Warning */}
            {badAngle && !isRecording && (
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-red-500/90 text-white px-3 py-2 rounded-lg text-xs flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Turn sideways for better swing analysis
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Recording Button */}
      <div className="flex justify-center mb-8">
        <Button
          size="lg"
          className={`w-20 h-20 rounded-full transition-all duration-200 ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
          disabled={(!isInitialized && !workerError) || (!stream && !workerError)}
          onClick={toggleRecording}
        >
          {isRecording ? (
            <Square className="w-6 h-6" fill="currentColor" />
          ) : (
            <Play className="w-8 h-8 ml-1" fill="currentColor" />
          )}
        </Button>
      </div>

      {/* Pro Recording Tips */}
      <div className="bg-blue-50 rounded-2xl p-6">
        <div className="flex items-center mb-4">
          <div className="bg-blue-100 rounded-lg p-2 mr-3">
            <Star className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Pro Recording Tips</h3>
        </div>
        <ul className="space-y-3">
          <li className="flex items-start">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0" />
            <span className="text-gray-700">Position camera at waist height, 10 feet away</span>
          </li>
          <li className="flex items-start">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0" />
            <span className="text-gray-700">Ensure your entire body is visible in frame</span>
          </li>
          <li className="flex items-start">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0" />
            <span className="text-gray-700">Record in good lighting for best AI analysis</span>
          </li>
        </ul>
      </div>
    </div>
  );
}