import { ReactNode } from 'react';
import wideLogo from '@/assets/swingsense-wide.png';

interface AppHeaderProps {
  leftAction?: ReactNode;
  rightAction?: ReactNode;
}

export function AppHeader({ leftAction, rightAction }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-4 bg-black/50 backdrop-blur-md border-b border-white/10">
      {/* Left action slot */}
      <div className="w-10 flex items-center justify-start shrink-0">
        {leftAction}
      </div>

      {/* Logo - Larger and more dominant on mobile */}
      <div className="flex-1 flex justify-center items-center pointer-events-none select-none px-3">
        <img
          src={wideLogo}
          alt="SwingSense"
          className="h-12 sm:h-14 md:h-16 w-auto max-w-[200px] sm:max-w-[240px] drop-shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all duration-300"
        />
      </div>

      {/* Right action slot */}
      <div className="w-10 flex items-center justify-end shrink-0">
        {rightAction}
      </div>
    </header>
  );
}
