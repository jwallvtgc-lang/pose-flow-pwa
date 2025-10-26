import { useState } from 'react';
import { X } from 'lucide-react';
import { DrillRating } from './DrillRating';

interface StartDrillModalProps {
  isOpen: boolean;
  onClose: () => void;
  drillId: string;
  drillName: string;
  steps: string[];
  repsTarget: string;
  focusCues: string[];
}

export function StartDrillModal({
  isOpen,
  onClose,
  drillId,
  drillName,
  steps,
  repsTarget,
  focusCues,
}: StartDrillModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showRating, setShowRating] = useState(false);

  if (!isOpen) return null;

  const totalSteps = steps.length;
  const isLastStep = currentStep === totalSteps - 1;

  const handleNext = () => {
    if (isLastStep) {
      setShowRating(true);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    setShowRating(false);
    onClose();
  };

  const handleRating = (drillId: string, rating: 'helpful' | 'not-helpful') => {
    console.log(`Drill ${drillId} rated: ${rating}`);
    // Stub for future database integration
    setTimeout(() => {
      handleClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-b from-[#0F172A] to-black flex flex-col">
      {/* Header Bar */}
      <div className="border-b border-white/10 py-4 px-4 relative">
        <button
          onClick={handleClose}
          className="absolute left-4 top-4 text-white/60 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
        
        <div className="text-center">
          <h2 className="text-white font-semibold text-base">{drillName}</h2>
          <p className="text-white/40 text-xs mt-1">{repsTarget}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center px-4 py-6 overflow-y-auto safe-area-bottom">
        {!showRating ? (
          <>
            {/* Step Card */}
            <div className="rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] text-white p-5 mx-auto max-w-lg w-full flex flex-col gap-4 animate-fade-in">
              {/* Step Counter */}
              <div className="text-white/50 text-xs font-medium tracking-wide uppercase">
                Step {currentStep + 1} of {totalSteps}
              </div>

              {/* Instruction */}
              <div className="text-white font-semibold text-lg leading-tight">
                {steps[currentStep]}
              </div>

              {/* Supporting Tip */}
              {currentStep === 0 && (
                <p className="text-white/60 text-sm">
                  Take your time to set up properly. This drill builds on consistency.
                </p>
              )}

              {/* Focus Block */}
              {focusCues.length > 0 && (
                <div className="mt-2 p-3 rounded-lg bg-white/5 border border-emerald-500/20">
                  <div className="text-green-400 text-xs font-semibold mb-2">Focus on:</div>
                  <ul className="space-y-1">
                    {focusCues.slice(0, 3).map((cue, index) => (
                      <li key={index} className="text-green-400/80 text-xs flex items-start gap-2">
                        <span>•</span>
                        <span>{cue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Rep Counter */}
            <div className="text-center mt-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div className="text-green-400 font-bold text-xl">
                Step {currentStep + 1} / {totalSteps}
              </div>
              <p className="text-white/40 text-xs mt-2">
                Take it slow. Quality over speed.
              </p>
            </div>

            {/* Progress Dots */}
            <div className="flex justify-center gap-2 mt-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
              {Array.from({ length: totalSteps }).map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? 'bg-green-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] w-3'
                      : 'bg-white/20'
                  }`}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-3 mt-6 px-4 max-w-lg mx-auto w-full animate-fade-in" style={{ animationDelay: '300ms' }}>
              <button
                onClick={handleBack}
                disabled={currentStep === 0}
                className="rounded-xl bg-white/10 border border-white/20 text-white/80 text-sm font-medium px-4 py-3 flex-1 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="rounded-xl bg-green-500 text-black font-semibold text-sm px-4 py-3 flex-1 shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:bg-green-400 active:scale-[0.97] transition-all"
              >
                {isLastStep ? 'Finish' : 'Next'}
              </button>
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-lg w-full animate-fade-in">
            <DrillRating
              drillId={drillId}
              drillName={drillName}
              onRate={handleRating}
            />
          </div>
        )}
      </div>
    </div>
  );
}
