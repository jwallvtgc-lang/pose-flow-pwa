import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Clock, Play, RotateCcw } from 'lucide-react';
import { poseWorkerClient, type PoseAnalysisResult } from '@/lib/poseWorkerClient';

interface SwingAnalysisResultsProps {
  videoBlob: Blob;
  onRetake?: () => void;
  onComplete?: (results: PoseAnalysisResult) => void;
}

export function SwingAnalysisResults({ videoBlob, onRetake, onComplete }: SwingAnalysisResultsProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('Starting analysis...');
  const [results, setResults] = useState<PoseAnalysisResult | null>(null);
  const [error, setError] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');

  useEffect(() => {
    // Create video URL for playback
    const url = URL.createObjectURL(videoBlob);
    setVideoUrl(url);

    // Start analysis
    analyzeSwing();

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [videoBlob]);

  const analyzeSwing = async () => {
    try {
      setIsAnalyzing(true);
      setProgress(0);
      setError('');

      const result = await poseWorkerClient.analyzeSwing(
        videoBlob,
        30, // Target 30fps
        (message) => {
          setProgressMessage(message);
          // Extract progress percentage if available
          const progressMatch = message.match(/(\d+\.?\d*)%/);
          if (progressMatch) {
            setProgress(parseFloat(progressMatch[1]));
          }
        }
      );

      setResults(result);
      setIsAnalyzing(false);
      setProgress(100);
      setProgressMessage('Analysis complete!');
      onComplete?.(result);

    } catch (err) {
      console.error('Swing analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setIsAnalyzing(false);
    }
  };

  const retryAnalysis = () => {
    setResults(null);
    setError('');
    analyzeSwing();
  };

  if (error) {
    return (
      <div className="space-y-4">
        <Card className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Analysis Failed</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={retryAnalysis} variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            {onRetake && (
              <Button onClick={onRetake}>
                Record New Swing
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-semibold">Analyzing Your Swing</h3>
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground">{progressMessage}</p>
            </div>
          </div>
        </Card>

        {/* Video Preview while analyzing */}
        <Card className="p-4">
          <video
            src={videoUrl}
            controls
            className="w-full rounded-lg"
            muted
          />
        </Card>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  const phases = poseWorkerClient.formatSwingPhase(results.events, results.keypointsByFrame);
  const hasLowConfidence = results.quality === 'low_confidence';

  return (
    <div className="space-y-6">
      {/* Quality Warning */}
      {hasLowConfidence && (
        <Card className="p-4 border-orange-200 bg-orange-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <div className="flex-1">
              <h4 className="font-medium text-orange-900">Low Confidence Detection</h4>
              <p className="text-sm text-orange-700">
                Some body parts weren't clearly visible. Consider recording from a different angle for better analysis.
              </p>
            </div>
            {onRetake && (
              <Button size="sm" variant="outline" onClick={onRetake}>
                Retake
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Video with Results */}
      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Swing Analysis Results</h3>
            <Badge variant="secondary">
              {results.keypointsByFrame.length} frames analyzed
            </Badge>
          </div>
          
          <video
            src={videoUrl}
            controls
            className="w-full rounded-lg"
            muted
          />
        </div>
      </Card>

      {/* Swing Phases */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Swing Phases Detected</h3>
        
        {phases.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No distinct swing phases could be detected. Try recording a more complete swing motion.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {phases.map((phase, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary w-8">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{phase.phase}</div>
                  <div className="text-sm text-muted-foreground">
                    {phase.description}
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div>Frame {phase.frameIndex}</div>
                  <div>{(phase.timestamp / 1000).toFixed(2)}s</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Analysis Summary */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Analysis Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total Frames:</span>
            <span className="ml-2 font-medium">{results.keypointsByFrame.length}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Duration:</span>
            <span className="ml-2 font-medium">
              {((results.keypointsByFrame[results.keypointsByFrame.length - 1]?.t || 0) / 1000).toFixed(2)}s
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Phases Found:</span>
            <span className="ml-2 font-medium">{phases.length} / 6</span>
          </div>
          <div>
            <span className="text-muted-foreground">Quality:</span>
            <span className="ml-2">
              <Badge variant={hasLowConfidence ? "destructive" : "secondary"}>
                {hasLowConfidence ? 'Low Confidence' : 'Good'}
              </Badge>
            </span>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        {onRetake && (
          <Button onClick={onRetake} variant="outline" className="flex-1">
            <RotateCcw className="w-4 h-4 mr-2" />
            Record Another Swing
          </Button>
        )}
        <Button onClick={retryAnalysis} variant="outline">
          <Play className="w-4 h-4 mr-2" />
          Re-analyze
        </Button>
      </div>
    </div>
  );
}