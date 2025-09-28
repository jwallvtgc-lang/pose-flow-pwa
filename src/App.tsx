import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SwingAnalysis from "./pages/SwingAnalysis";
import Score from "./pages/Score";
import Progress from "./pages/Progress";
import SwingDetail from "./pages/SwingDetail";
import RecentSwings from "./pages/RecentSwings";
import Debug from "./pages/Debug";
import MetricsDebug from "./pages/MetricsDebug";
import NotFound from "./pages/NotFound";
import Leaderboard from "./pages/Leaderboard";
import Achievements from "./pages/Achievements";
import Profile from "./pages/Profile";
import Feedback from "./pages/Feedback";
import { initPosthog } from "./lib/analytics";
import { initTf } from "./lib/tf";

const queryClient = new QueryClient();

// Register service worker with better error handling
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
        // Continue without service worker - don't break the app
      });
  });
}

const App = () => {
  useEffect(() => {
    // Initialize PostHog and TensorFlow.js on app mount
    initPosthog();
    initTf().catch(console.error);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/analysis" element={<SwingAnalysis />} />
            <Route path="/score" element={<Score />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/swing/:id" element={<SwingDetail />} />
            <Route path="/recent-swings" element={<RecentSwings />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/debug" element={<Debug />} />
            <Route path="/metrics-debug" element={<MetricsDebug />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
