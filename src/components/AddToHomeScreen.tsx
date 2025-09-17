import { useState, useEffect } from "react";
import { X, Share, Plus } from "lucide-react";

const AddToHomeScreen = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if app is already installed or banner was dismissed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const bannerDismissed = localStorage.getItem('addToHomeScreenDismissed');
    
    if (iOS && !isStandalone && !bannerDismissed) {
      // Show banner after a short delay
      setTimeout(() => setShowBanner(true), 2000);
    }
  }, []);

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem('addToHomeScreenDismissed', 'true');
  };

  if (!showBanner || !isIOS) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-card border border-border rounded-2xl p-4 shadow-lg">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-card-foreground">Add to Home Screen</h3>
        <button
          onClick={dismissBanner}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X size={20} />
        </button>
      </div>
      
      <p className="text-sm text-muted-foreground mb-3">
        Install SwingSense for the best experience:
      </p>
      
      <div className="flex items-center text-sm text-muted-foreground space-x-4">
        <div className="flex items-center space-x-1">
          <Share size={16} />
          <span>Tap</span>
        </div>
        <span>→</span>
        <div className="flex items-center space-x-1">
          <Plus size={16} />
          <span>"Add to Home Screen"</span>
        </div>
      </div>
    </div>
  );
};

export default AddToHomeScreen;