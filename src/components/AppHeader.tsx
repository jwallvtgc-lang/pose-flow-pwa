import { ReactNode } from 'react';
import wideLogo from '@/assets/swingsense-wide.png';

interface AppHeaderProps {
  leftAction?: ReactNode;
  rightAction?: ReactNode;
}

export function AppHeader({ leftAction, rightAction }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-black/50 backdrop-blur-md border-b border-white/10">
      {/* Left action slot */}
      <div className="w-10 flex items-center justify-start">
        {leftAction}
      </div>

      {/* Logo */}
      <div className="flex-1 flex justify-center pointer-events-none select-none">
        <img
          src={wideLogo}
          alt="SwingSense"
          className="h-8 sm:h-10 w-auto drop-shadow-[0_0_12px_rgba(16,185,129,0.4)]"
        />
      </div>

      {/* Right action slot */}
      <div className="w-10 flex items-center justify-end">
        {rightAction}
      </div>
    </header>
  );
}
