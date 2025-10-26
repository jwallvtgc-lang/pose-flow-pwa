import { ReactNode } from 'react';
import headerLogo from '@/assets/swingsense-header.png';

interface HeaderProps {
  leftAction?: ReactNode;
  rightAction?: ReactNode;
}

export function Header({ leftAction, rightAction }: HeaderProps) {
  return (
    <header className="relative w-full h-16 bg-gradient-to-b from-[#0F172A] to-black border-b border-white/10">
      {/* Left Action */}
      {leftAction && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
          {leftAction}
        </div>
      )}

      {/* Centered Logo */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center">
        <img
          src={headerLogo}
          alt="SwingSense"
          className="h-10 md:h-12 w-auto drop-shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-[glowpulse_7s_ease-in-out_infinite]"
        />
      </div>

      {/* Right Action */}
      {rightAction && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
          {rightAction}
        </div>
      )}

      <style>{`
        @keyframes glowpulse {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.3));
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(16, 185, 129, 0.6));
          }
        }
      `}</style>
    </header>
  );
}
