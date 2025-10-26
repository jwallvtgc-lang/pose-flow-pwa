import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface DrillRatingProps {
  drillId: string;
  drillName: string;
  onRate?: (drillId: string, rating: 'helpful' | 'not-helpful') => void;
}

export function DrillRating({ drillId, drillName, onRate }: DrillRatingProps) {
  const [rated, setRated] = useState(false);

  const handleRating = (rating: 'helpful' | 'not-helpful') => {
    setRated(true);
    
    // Stub function for future database integration
    if (onRate) {
      onRate(drillId, rating);
    } else {
      console.log(`Drill "${drillName}" rated as: ${rating}`);
    }
  };

  if (rated) {
    return (
      <Card className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] text-white p-4 flex flex-col items-center gap-3">
        <p className="text-green-400 text-sm font-medium text-center">
          ✓ Thanks — got it!
        </p>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] text-white p-4 flex flex-col items-center gap-3">
      <h3 className="text-white font-semibold text-base text-center">
        Was this drill helpful?
      </h3>
      <p className="text-white/50 text-xs text-center">
        Your feedback helps tune future recommendations.
      </p>
      
      <div className="flex gap-3 w-full mt-2">
        <button
          onClick={() => handleRating('helpful')}
          className="flex flex-col items-center justify-center gap-1 rounded-xl bg-green-500 text-black font-semibold text-sm py-3 flex-1 shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-[0.97] transition-all"
        >
          <ThumbsUp className="w-6 h-6" />
          <span>Yes</span>
        </button>
        
        <button
          onClick={() => handleRating('not-helpful')}
          className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white/10 border border-white/20 text-white/80 text-sm py-3 flex-1 active:scale-[0.97] transition-all"
        >
          <ThumbsDown className="w-6 h-6" />
          <span>Not really</span>
        </button>
      </div>
    </Card>
  );
}
