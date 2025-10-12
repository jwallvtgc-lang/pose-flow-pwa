import { BatSpeedResult } from '@/lib/batSpeedEstimator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';

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

export function BatSpeedDisplay({ batSpeed }: BatSpeedDisplayProps) {
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
        </CardContent>
      </Card>
    </div>
  );
}
