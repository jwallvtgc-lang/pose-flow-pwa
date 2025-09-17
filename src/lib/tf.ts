// src/lib/tf.ts
// Client-side TFJS init + MoveNet detector factory (no Posenet).

export async function initTf(): Promise<"webgl" | string> {
  // Load TFJS core & webgl backend dynamically in the browser
  const tf = await import("@tensorflow/tfjs");
  await import("@tensorflow/tfjs-backend-webgl");

  // Ensure we’re on webgl (faster than cpu); ignore errors if already set
  try {
    if (tf.getBackend() !== "webgl") {
      await tf.setBackend("webgl");
    }
  } catch {}
  await tf.ready();
  return tf.getBackend();
}

export type MoveNetDetector = any; // type-light to avoid bundling issues

export async function createMoveNet(): Promise<MoveNetDetector> {
  // Use @tensorflow-models/pose-detection (MoveNet Lightning)
  const posedetection = await import("@tensorflow-models/pose-detection");
  const detector = await posedetection.createDetector(
    posedetection.SupportedModels.MoveNet,
    {
      modelType: "Lightning", // fast & mobile-friendly
      enableSmoothing: true
    }
  );
  return detector;
}
