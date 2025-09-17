// src/lib/tf.ts
// Client-side TFJS init + MoveNet detector factory (no Posenet).

export async function initTf(): Promise<"webgl" | string> {
  const tf = await import("@tensorflow/tfjs");
  await import("@tensorflow/tfjs-backend-webgl");

  try {
    if (tf.getBackend() !== "webgl") {
      await tf.setBackend("webgl");
    }
  } catch {}
  await tf.ready();
  return tf.getBackend();
}

export type MoveNetDetector = any;

export async function createMoveNet(): Promise<MoveNetDetector> {
  const posedetection = await import("@tensorflow-models/pose-detection");
  const detector = await posedetection.createDetector(
    posedetection.SupportedModels.MoveNet,
    { modelType: "Lightning", enableSmoothing: true }
  );
  return detector;
}
