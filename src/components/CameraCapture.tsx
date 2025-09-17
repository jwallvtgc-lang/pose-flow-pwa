import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { initializeTensorFlow, detectPoses } from '@/lib/tf';
import { trackCapture } from '@/lib/analytics';

interface CameraCaptureProps {
  onPoseDetected: (poses: any[]) => void;
  onCapture: (videoData: Blob) => void;
}

export function CameraCapture({ onPoseDetected, onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

  useEffect(() => {
    const setupCamera = async () => {
      try {
        // Initialize TensorFlow
        await initializeTensorFlow();
        setIsInitialized(true);

        // Get camera stream
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
        
        setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
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
    };
  }, []);

  const startRecording = async () => {
    if (!stream || !videoRef.current) return;

    trackCapture.started();
    
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    
    const chunks: Blob[] = [];
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      onCapture(blob);
      setRecordedChunks([]);
    };
    
    mediaRecorder.start();
    setIsRecording(true);
    
    // Start pose detection
    detectPosesLoop();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const detectPosesLoop = async () => {
    if (!videoRef.current || !isRecording) return;
    
    try {
      const poses = await detectPoses(videoRef.current);
      
      if (poses.length > 0) {
        trackCapture.poseOk();
        onPoseDetected(poses);
        
        // Draw poses on canvas
        drawPoses(poses);
      }
    } catch (error) {
      console.error('Pose detection error:', error);
    }
    
    if (isRecording) {
      requestAnimationFrame(detectPosesLoop);
    }
  };

  const drawPoses = (poses: any[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    poses.forEach(pose => {
      pose.keypoints.forEach((keypoint: any) => {
        if (keypoint.score > 0.3) {
          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = 'red';
          ctx.fill();
        }
      });
    });
  };

  return (
    <Card className="p-4">
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto rounded-lg"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-auto pointer-events-none"
        />
      </div>
      
      <div className="mt-4 flex justify-center gap-4">
        {!isRecording ? (
          <Button 
            onClick={startRecording}
            disabled={!isInitialized || !stream}
            size="lg"
            className="w-full"
          >
            {isInitialized ? 'Start Recording' : 'Initializing...'}
          </Button>
        ) : (
          <Button 
            onClick={stopRecording}
            variant="destructive"
            size="lg"
            className="w-full"
          >
            Stop Recording
          </Button>
        )}
      </div>
    </Card>
  );
}