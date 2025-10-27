import { ArrowLeft, Share2, MoreVertical } from 'lucide-react';

interface AppHeaderProps {
  onBack?: () => void;
  onActionRight?: () => void;
  rightIcon?: 'share' | 'menu' | null;
}

export function AppHeader({ onBack, onActionRight, rightIcon }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-4 bg-black/50 backdrop-blur-md border-b border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
      {/* Left slot - Back button or spacer */}
      <div className="w-10 flex items-center justify-start shrink-0">
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

      {/* Center - Large horizontal wordmark stretched across header */}
      <div className="flex-1 flex justify-center items-center pointer-events-none select-none px-2 mx-2">
        <img
          src="/logo-horizontal.png"
          alt="SwingSense"
          className="h-10 sm:h-12 w-full max-w-none object-contain drop-shadow-[0_0_20px_rgba(16,185,129,0.6)] transition-all duration-300"
        />
      </div>

      {/* Right slot - Action button or spacer */}
      <div className="w-10 flex items-center justify-end shrink-0">
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
