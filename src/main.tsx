import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from '@/contexts/AuthContext';

// Debug environment variables (production-safe)
if (import.meta.env.DEV) {
  console.log('SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL);
  console.log('POSTHOG_KEY', import.meta.env.VITE_POSTHOG_KEY);
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
