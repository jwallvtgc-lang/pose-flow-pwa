import splashBg from '@/assets/splash-ios.png';

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
        <p className="text-white/70 text-sm animate-pulse">
          Training your swing data…
        </p>
      </div>
    </div>
  );
}
