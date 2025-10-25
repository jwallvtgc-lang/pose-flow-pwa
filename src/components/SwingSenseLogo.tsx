import { useEffect, useState } from 'react';
import logoMark from '@/assets/swingsense-logo-mark.png';

interface SwingSenseLogoProps {
  className?: string;
}

export function SwingSenseLogo({ className = '' }: SwingSenseLogoProps) {
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    setHasAnimated(true);
  }, []);

  return (
    <div 
      className={`flex items-center gap-3 ${className} ${hasAnimated ? 'animate-fade-in-logo' : 'opacity-0'}`}
    >
      {/* Official SwingSense Logo Mark with Glow */}
      <div className="relative">
        {/* Radial glow behind logo - breathing pulse */}
        <div 
          className="absolute inset-0 -m-3 opacity-40 animate-glow-breathe"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.6) 0%, transparent 70%)',
            filter: 'blur(16px)',
          }}
        />
        
        {/* Logo Image */}
        <img 
          src={logoMark} 
          alt="SwingSense logo" 
          className="relative z-10 h-7 w-auto"
          style={{
            filter: 'drop-shadow(0 0 12px rgba(16, 185, 129, 0.4))'
          }}
        />
      </div>

      {/* SwingSense Wordmark */}
      <span 
        className="text-white font-semibold text-lg tracking-wide"
        style={{
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          letterSpacing: '0.5px'
        }}
      >
        SwingSense
      </span>

      <style>{`
        @keyframes fade-in-logo {
          0% {
            opacity: 0;
            transform: scale(0.95);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes glow-breathe {
          0%, 100% {
            filter: blur(16px);
            opacity: 0.4;
          }
          50% {
            filter: blur(20px);
            opacity: 0.5;
          }
        }

        .animate-fade-in-logo {
          animation: fade-in-logo 0.8s ease-out forwards;
        }

        .animate-glow-breathe {
          animation: glow-breathe 7s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
