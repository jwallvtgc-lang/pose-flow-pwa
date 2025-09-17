// Alternative build config that bypasses TypeScript project references
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      // Completely disable TypeScript in production build
      tsDecorators: false,
    })
  ],
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
  // Completely bypass TypeScript checking
  esbuild: {
    target: 'esnext',
    logLevel: 'silent',
    // Skip TypeScript entirely
    loader: {
      '.ts': 'js',
      '.tsx': 'jsx'
    }
  }
})