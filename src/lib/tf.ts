/ src/lib/tf.ts
// Minimal MoveNet loader for browsers (Vite + React).
// - Forces TFJS WebGL backend (fastest, iOS-friendly)
// - Dynamically imports to avoid server/SSR issues
// - Provides helpers: initTf, loadPoseDetector, estimatePoses, warmup, disposeDetector

export type PoseDetector = any;
export type Pose = any;

// Export tf instance for direct access
let tfInstance: any = null;

export async function initTf(): Promise<"webgl" | string> {
  try {
    // Import the full TFJS bundle; it brings core+converter.
    const tf = await import("@tensorflow/tfjs");
    tfInstance = tf;
    
    // Ensure WebGL backend is registered before setBackend
    await import("@tensorflow/tfjs-backend-webgl");
    
    // Set backend to WebGL if not already set
    if (tf.getBackend() !== "webgl") {
      await tf.setBackend("webgl");
    }
    
    await tf.ready();
    console.log('TensorFlow.js initialized with backend:', tf.getBackend());
    return tf.getBackend();
  } catch (error) {
    console.warn('TensorFlow.js initialization failed:', error);
    // Fallback to CPU backend if WebGL fails
    try {
      const tf = await import("@tensorflow/tfjs");
      tfInstance = tf;
      await import("@tensorflow/tfjs-backend-cpu");
      await tf.setBackend("cpu");
      await tf.ready();
      console.log('TensorFlow.js fallback to CPU backend');
      return tf.getBackend();
    } catch (fallbackError) {
      console.error('TensorFlow.js complete initialization failed:', fallbackError);
      throw fallbackError;
    }
  }
}

// Export tf for direct access (lazy-loaded)
export const tf = {
  getBackend: () => tfInstance?.getBackend?.() || 'not-initialized',
  get instance() { return tfInstance; }
};

export async function loadPoseDetector(): Promise<PoseDetector> {
  try {
    // Ensure TensorFlow is initialized first
    if (!tfInstance) {
      await initTf();
    }
    
    // Dynamic import keeps it out of SSR and trims initial bundle.
    const posedetection = await import("@tensorflow-models/pose-detection");
    
    // Choose MoveNet (good speed/accuracy on mobile)
    const model = posedetection.SupportedModels.MoveNet as any;
    
    // You can switch Lightning ↔ Thunder if you want accuracy over speed.
    const detector = await posedetection.createDetector(model, {
      modelType: "Lightning",
      enableSmoothing: true,
    } as any);
    
    console.log('Pose detector loaded successfully');
    return detector;
  } catch (error) {
    console.error('Failed to load pose detector:', error);
    throw error;
  }
}

/**
 * Warm up the detector to avoid first-frame latency.
 * Call once after camera/video is ready.
 */
export async function warmup(detector: PoseDetector, width = 256, height = 256) {
  try {
    // Create a tiny offscreen canvas as a fake input
    const canvas = typeof document !== "undefined"
      ? document.createElement("canvas")
      : null;
    if (!canvas) return;
    
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    
    await detector.estimatePoses(canvas as HTMLCanvasElement, { maxPoses: 1 });
    console.log('Pose detector warmed up successfully');
  } catch (error) {
    console.warn('Pose detector warmup failed:', error);
    // warming up is best-effort, don't throw
  }
}

/**
 * Estimate poses from a HTMLVideoElement or HTMLCanvasElement.
 * Make sure initTf() has been called and the video has current frame data.
 */
export async function estimatePoses(
  detector: PoseDetector,
  source: HTMLVideoElement | HTMLCanvasElement,
  maxPoses = 1
): Promise<Pose[]> {
  try {
    return await detector.estimatePoses(source, { maxPoses });
  } catch (error) {
    console.error('Pose estimation failed:', error);
    return [];
  }
}

export function disposeDetector(detector: PoseDetector) {
  try {
    detector?.dispose?.();
    console.log('Pose detector disposed');
  } catch (error) {
    console.warn('Error disposing detector:', error);
  }
}
