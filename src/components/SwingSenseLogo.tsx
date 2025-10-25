import { useEffect, useState } from 'react';

interface SwingSenseLogoProps {
  className?: string;
}

export function SwingSenseLogo({ className = '' }: SwingSenseLogoProps) {
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    setHasAnimated(true);
  }, []);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* S Mark with glow and tail */}
      <div className="relative">
        {/* Radial glow behind S - breathing pulse */}
        <div 
          className="absolute inset-0 -m-4 opacity-40"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.6) 0%, transparent 70%)',
            filter: 'blur(20px)',
            animation: 'glow-breathe 7s ease-in-out infinite'
          }}
        />
        
        <svg 
          width="48" 
          height="48" 
          viewBox="0 0 48 48" 
          className="relative z-10"
          fill="none"
        >
          {/* S shape with tail - path draws on load */}
          <path
            d="M 38 10 C 40 10, 42 12, 42 15 C 42 18, 39 21, 34 24 C 29 27, 24 30, 22 34 C 20 38, 20 41, 18 44 C 16 47, 13 48, 10 47 C 7 46, 6 43, 8 40 C 10 37, 14 34, 19 31 C 24 28, 29 24, 32 20 C 35 16, 35 13, 32 11 C 30 10, 36 10, 38 10 Z M 10 47 L 6 50 L 4 52 L 3 53 C 2 54, 1 54, 0 53 C 0 52, 1 51, 3 49 L 7 46 L 10 47 Z"
            fill="url(#sGradient)"
            strokeWidth="0"
            className={hasAnimated ? 'animate-draw-s' : ''}
            style={{
              filter: 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))',
              strokeDasharray: hasAnimated ? undefined : '400',
              strokeDashoffset: hasAnimated ? undefined : '400'
            }}
          />
          
          {/* Glowing tracking dot */}
          <circle 
            cx="40" 
            cy="12" 
            r="3" 
            fill="url(#dotGradient)"
            className={hasAnimated ? 'animate-fade-in-dot' : 'opacity-0'}
            style={{
              filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.8))'
            }}
          >
            <animate 
              attributeName="opacity" 
              values="1;0.6;1" 
              dur="2s" 
              repeatCount="indefinite"
              begin={hasAnimated ? '0.8s' : 'indefinite'}
            />
          </circle>
          
          <defs>
            <linearGradient id="sGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#14B8A6" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id="dotGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* SwingSense wordmark */}
      <span 
        className={`text-white font-bold text-xl tracking-wide ${hasAnimated ? 'animate-fade-scale-text' : 'opacity-0'}`}
        style={{
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}
      >
        SwingSense
      </span>

      <style>{`
        @keyframes draw-s {
          0% {
            stroke-dashoffset: 400;
            opacity: 0.3;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }

        @keyframes fade-in-dot {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fade-scale-text {
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
            filter: blur(20px);
            opacity: 0.4;
          }
          50% {
            filter: blur(28px);
            opacity: 0.5;
          }
        }

        .animate-draw-s {
          animation: draw-s 0.8s ease-out forwards;
        }

        .animate-fade-in-dot {
          animation: fade-in-dot 0.4s ease-out 0.8s forwards;
        }

        .animate-fade-scale-text {
          animation: fade-scale-text 0.4s ease-out 1s forwards;
        }
      `}</style>
    </div>
  );
}
