// src/lib/tf.ts
// Minimal MoveNet loader for browsers (Vite + React).
// - Forces TFJS WebGL backend (fastest, iOS-friendly)
// - Dynamically imports to avoid server/SSR issues
// - Provides helpers: initTf, loadPoseDetector, estimatePoses, warmup, disposeDetector

// If you want stronger types later, you can import types from the model package.
// To keep build friction low, we keep "any" here.
export type PoseDetector = any;
export type Pose = any;

// Export tf instance for direct access
let tfInstance: any = null;

export async function initTf(): Promise<"webgl" | string> {
  // Import the full TFJS bundle; it brings core+converter.
  const tf = await import("@tensorflow/tfjs");
  tfInstance = tf;
  // Ensure WebGL backend is registered before setBackend
  await import("@tensorflow/tfjs-backend-webgl");

  try {
    if (tf.getBackend() !== "webgl") {
      await tf.setBackend("webgl");
    }
  } catch {
    // ignore if backend already set
  }
  await tf.ready();
  return tf.getBackend();
}

// Export tf for direct access (lazy-loaded)
export const tf = {
  getBackend: () => tfInstance?.getBackend?.() || 'not-initialized'
};

export async function loadPoseDetector(): Promise<PoseDetector> {
  // Dynamic import keeps it out of SSR and trims initial bundle.
  const posedetection = await import("@tensorflow-models/pose-detection");

  // Choose MoveNet (good speed/accuracy on mobile)
  const model = posedetection.SupportedModels.MoveNet as any;

  // You can switch Lightning ↔ Thunder if you want accuracy over speed.
  const detector = await posedetection.createDetector(model, {
    modelType: "Lightning",
    enableSmoothing: true,
  } as any);

  return detector;
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
  } catch {
    // warming up is best-effort
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
  return detector.estimatePoses(source, { maxPoses });
}

export function disposeDetector(detector: PoseDetector) {
  try {
    detector?.dispose?.();
  } catch {
    // ignore
  }
}

