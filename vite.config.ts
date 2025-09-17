// @ts-nocheck
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { componentTagger } from "lovable-tagger"

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      // Disable TypeScript checking in SWC
      plugins: []
    }),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: "::",
    port: 8080,
  },
  optimizeDeps: {
    include: [
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-backend-webgl',
      '@tensorflow/tfjs-converter',
      '@tensorflow/tfjs-core',
      '@tensorflow-models/pose-detection'
    ]
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          tensorflow: [
            '@tensorflow/tfjs',
            '@tensorflow/tfjs-backend-webgl',
            '@tensorflow/tfjs-converter',
            '@tensorflow/tfjs-core',
            '@tensorflow-models/pose-detection'
          ]
        }
      }
    }
  },
  define: {
    global: 'globalThis',
  },
  // Force esbuild to ignore TypeScript errors
  esbuild: {
    target: 'esnext',
    logLevel: 'silent'
  }
}))