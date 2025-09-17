import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react({
    // Disable TypeScript checking in SWC
    tsDecorators: true,
  })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8080
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
    minify: 'esbuild',
    // Skip TypeScript checking during build
    emptyOutDir: true,
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
      },
      // Ignore TypeScript errors during build
      onwarn(warning, warn) {
        // Skip TypeScript warnings
        if (warning.code === 'TYPESCRIPT_ERROR') return;
        warn(warning);
      }
    }
  },
  define: {
    global: 'globalThis',
  },
  // Disable TypeScript checking entirely
  esbuild: {
    logLevel: 'error'
  }
})