import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: [
      '@tensorflow/tfjs',
      '@tensorflow/tfjs-backend-webgl', 
      '@tensorflow/tfjs-converter',
      '@tensorflow/tfjs-core',
      '@tensorflow-models/pose-detection',
      '@mediapipe/pose'
    ]
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'tensorflow-core': [
            '@tensorflow/tfjs-core',
            '@tensorflow/tfjs-converter'
          ],
          'tensorflow-backend': [
            '@tensorflow/tfjs',
            '@tensorflow/tfjs-backend-webgl'
          ],
          'tensorflow-models': [
            '@tensorflow-models/pose-detection'
          ],
          'mediapipe': ['@mediapipe/pose']
        }
      }
    },
    target: 'esnext',
    chunkSizeWarningLimit: 2000
  },
  define: {
    global: 'globalThis',
  },
  server: {
    fs: {
      allow: ['..']
    }
  }
})
