import { ArrowLeft, Share2, MoreVertical } from 'lucide-react';

interface AppHeaderProps {
  onBack?: () => void;
  onActionRight?: () => void;
  rightIcon?: 'share' | 'menu' | null;
}

export function AppHeader({ onBack, onActionRight, rightIcon }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-md border-b border-white/10 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
      {/* Left slot - Back button or spacer */}
      <div className="w-10 flex items-center justify-start">
        {onBack ? (
          <button
            aria-label="Back"
            onClick={onBack}
            className="h-9 w-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {/* Center - Logo integrated directly into header */}
      <div className="flex-1 flex justify-center items-center">
        <img
          src="/logo-horizontal.png"
          alt="SwingSense"
          className="h-10 sm:h-12 w-auto drop-shadow-[0_0_16px_rgba(16,185,129,0.4)] opacity-90"
        />
      </div>

      {/* Right slot - Action button or spacer */}
      <div className="w-10 flex items-center justify-end">
        {onActionRight && rightIcon ? (
          <button
            aria-label="Action"
            onClick={onActionRight}
            className="h-9 w-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
          >
            {rightIcon === 'share' ? (
              <Share2 className="h-4 w-4" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>
    </header>
  );
}
