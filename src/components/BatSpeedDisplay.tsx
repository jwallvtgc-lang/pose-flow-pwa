import { BatSpeedResult, BatSpeedEstimator } from '@/lib/batSpeedEstimator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Gauge, TrendingUp, Zap } from 'lucide-react';

interface BatSpeedDisplayProps {
  batSpeed: BatSpeedResult;
}

const LEVEL_COLORS: Record<BatSpeedResult['level'], string> = {
  'Youth': 'bg-blue-500',
  'Developing': 'bg-green-500',
  'High School': 'bg-yellow-500',
  'College': 'bg-orange-500',
  'Professional': 'bg-red-500'
};

const LEVEL_BENCHMARKS = [
  { label: 'Youth', max: 40, color: 'bg-blue-500/20' },
  { label: 'Developing', max: 55, color: 'bg-green-500/20' },
  { label: 'High School', max: 70, color: 'bg-yellow-500/20' },
  { label: 'College', max: 80, color: 'bg-orange-500/20' },
  { label: 'Professional', max: 100, color: 'bg-red-500/20' }
];

export function BatSpeedDisplay({ batSpeed }: BatSpeedDisplayProps) {
  const tips = BatSpeedEstimator.getImprovementTips(batSpeed.level);

  // Calculate position on the benchmark scale (0-100%)
  const getSpeedPosition = (mph: number) => {
    return Math.min((mph / 100) * 100, 100);
  };

  return (
    <div className="space-y-4">
      {/* Main Speed Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Bat Speed Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Large MPH Number with Badge */}
          <div className="text-center space-y-2">
            <div className="text-6xl font-bold text-primary">
              {batSpeed.peakSpeedMph.toFixed(1)}
              <span className="text-2xl ml-2 text-muted-foreground">MPH</span>
            </div>
            <Badge 
              className={`${LEVEL_COLORS[batSpeed.level]} text-white text-lg px-4 py-1`}
            >
              {batSpeed.level}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {batSpeed.levelDescription}
            </p>
          </div>

          {/* Speed Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="w-4 h-4" />
                Swing Duration
              </div>
              <div className="text-2xl font-semibold">
                {batSpeed.swingDurationMs.toFixed(0)}ms
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="w-4 h-4" />
                Acceleration Phase
              </div>
              <div className="text-2xl font-semibold">
                {batSpeed.accelerationPhaseMs.toFixed(0)}ms
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Gauge className="w-4 h-4" />
                Peak Wrist Speed
              </div>
              <div className="text-2xl font-semibold">
                {batSpeed.peakWristSpeedMph.toFixed(1)} MPH
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="w-4 h-4" />
                Average Bat Speed
              </div>
              <div className="text-2xl font-semibold">
                {batSpeed.avgSpeedMph.toFixed(1)} MPH
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Level Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {LEVEL_BENCHMARKS.map((benchmark, index) => {
              const prevMax = index > 0 ? LEVEL_BENCHMARKS[index - 1].max : 0;
              const isCurrentLevel = batSpeed.level === benchmark.label;
              const speedInRange = batSpeed.peakSpeedMph >= prevMax && batSpeed.peakSpeedMph < benchmark.max;

              return (
                <div key={benchmark.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className={isCurrentLevel ? 'font-semibold' : 'text-muted-foreground'}>
                      {benchmark.label}
                    </span>
                    <span className="text-muted-foreground">
                      {prevMax}-{benchmark.max} MPH
                    </span>
                  </div>
                  <div className="relative h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${benchmark.color} transition-all`}
                      style={{ width: '100%' }}
                    />
                    {speedInRange && (
                      <div
                        className="absolute top-0 h-full w-1 bg-primary"
                        style={{ left: `${((batSpeed.peakSpeedMph - prevMax) / (benchmark.max - prevMax)) * 100}%` }}
                      >
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full border-2 border-background" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Speed Position Indicator */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Your Speed</span>
              <span className="font-semibold">{batSpeed.peakSpeedMph.toFixed(1)} MPH</span>
            </div>
            <div className="relative h-2 bg-background rounded-full overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
                style={{ width: `${getSpeedPosition(batSpeed.peakSpeedMph)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tips to Improve */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tips to Improve Your Bat Speed</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {tips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{tip}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Technical Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Technical Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Calibration</span>
            <span className="font-mono">{batSpeed.pixelsPerFoot.toFixed(2)} px/ft</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Frames Analyzed</span>
            <span className="font-mono">{batSpeed.wristVelocities.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bat Tip Multiplier</span>
            <span className="font-mono">1.4x</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
