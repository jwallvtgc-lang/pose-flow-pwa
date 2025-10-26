import splashBg from '@/assets/splash-ios.png';
import headerLogo from '@/assets/swingsense-header.png';

export function SplashScreen() {
  return (
    <div 
      className="fixed inset-0 flex items-center justify-center bg-cover bg-center animate-in fade-in duration-500"
      style={{ backgroundImage: `url(${splashBg})` }}
    >
      {/* Translucent overlay */}
      <div className="absolute inset-0 bg-black/40" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        <img
          src={headerLogo}
          alt="SwingSense"
          className="h-16 md:h-20 w-auto drop-shadow-[0_0_20px_rgba(16,185,129,0.5)] animate-[glowpulse_7s_ease-in-out_infinite]"
        />
        <p className="text-white/70 text-sm mt-4 animate-pulse">
          Training your swing data…
        </p>
      </div>
    </div>
  );
}
