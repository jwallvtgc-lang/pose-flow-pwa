import { ReactNode } from 'react';
import wideLogo from '@/assets/swingsense-wide.png';

interface HeaderProps {
  leftAction?: ReactNode;
  rightAction?: ReactNode;
}

export function Header({ leftAction, rightAction }: HeaderProps) {
  return (
    <header className="relative w-full h-16 bg-gradient-to-b from-[#0F172A] to-black border-b border-white/10 flex-shrink-0 flex items-center justify-center">
      {/* Left Action */}
      {leftAction && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
          {leftAction}
        </div>
      )}

      {/* Wide Brand Logo - Centered and Prominent */}
      <img
        src={wideLogo}
        alt="SwingSense"
        className="h-20 w-auto max-w-[70%] drop-shadow-[0_0_30px_rgba(16,185,129,0.7)] animate-[glowpulse_6s_ease-in-out_infinite]"
      />

      {/* Right Action */}
      {rightAction && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
          {rightAction}
        </div>
      )}

      <style>{`
        @keyframes glowpulse {
          0%, 100% {
            filter: drop-shadow(0 0 18px rgba(16, 185, 129, 0.5));
          }
          50% {
            filter: drop-shadow(0 0 30px rgba(16, 185, 129, 0.8));
          }
        }
      `}</style>
    </header>
  );
}
