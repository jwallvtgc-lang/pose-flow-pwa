import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "@tensorflow-models/pose-detection",
      "@tensorflow/tfjs",
      "@tensorflow/tfjs-backend-webgl"
    ]
  },
  ssr: {
    noExternal: [
      "@tensorflow-models/pose-detection",
      "@tensorflow/tfjs",
      "@tensorflow/tfjs-backend-webgl"
    ]
  }
});


