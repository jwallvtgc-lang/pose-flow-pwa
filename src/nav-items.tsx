import { HomeIcon, BarChart3Icon, BugIcon, TrendingUpIcon } from "lucide-react";
import Index from "./pages/Index";
import SwingAnalysis from "./pages/SwingAnalysis";
import Progress from "./pages/Progress";
import Debug from "./pages/Debug";

/**
 * Central place for defining the navigation structure of your application.
 * 
 * The sidebar will automatically be populated based on this file.
 */

export const navItems = [
  {
    title: "Home",
    to: "/",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Index />,
  },
  {
    title: "Swing Analysis",
    to: "/analysis",
    icon: <BarChart3Icon className="h-4 w-4" />,
    page: <SwingAnalysis />,
  },
  {
    title: "Progress",
    to: "/progress",
    icon: <TrendingUpIcon className="h-4 w-4" />,
    page: <Progress />,
  },
  {
    title: "Debug",
    to: "/debug",
    icon: <BugIcon className="h-4 w-4" />,
    page: <Debug />,
  },
];