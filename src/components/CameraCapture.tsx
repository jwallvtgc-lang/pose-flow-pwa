// src/components/CameraCapture.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  onCapture: (blob: Blob) => void;
  /** Maximum allowed duration (seconds) for captured/selected video. Default: 15 */
  maxDurationSec?: number;
  /** Maximum allowed file size in bytes. Default: 200MB */
  maxBytes?: number;
};

export function CameraCapture({
  onCapture,
  maxDurationSec = 15,
  maxBytes = 200 * 1024 * 1024, // 200MB
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [previewOn, setPreviewOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isiOS = useMemo(
    () => typeof navigator !== 'undefined' && /iP(hone|od|ad)/.test(navigator.userAgent),
    []
  );

  // --- helpers ---------------------------------------------------------------

  function pickBestMime(): string | undefined {
    // Safari iOS generally lacks MediaRecorder; fallback to file input.
    // For modern Chrome/Android/desktop:
    const candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4', // usually false in browsers, but keep as last resort check
    ];
    for (const c of candidates) {
      // @ts-ignore - Safari may not have isTypeSupported
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c)) return c;
    }
    return undefined;
  }

  function resetError(msg?: string) {
    setError(msg ?? null);
    if (msg) setInfo(null);
  }

  function setTip(msg?: string) {
    setInfo(msg ?? null);
  }

  function stopStreamTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function getVideoDuration(file: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(v.duration || 0);
      };
      v.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read video metadata'));
      };
      v.src = url;
    });
  }

  async function validateAndSend(blob: Blob) {
    try {
      resetError();
      if (blob.size > maxBytes) {
        throw new Error(
          `Video is too large (${Math.round(blob.size / (1024 * 1024))}MB). Max ${Math.round(
            maxBytes / (1024 * 1024)
          )}MB.`
        );
      }
      const dur = await getVideoDuration(blob);
      if (!Number.isFinite(dur) || dur <= 0) {
        // Some iOS MOVs may delay metadata; allow if size looks sane as fallback
        setTip('Could not read duration; proceeding based on file size.');
      } else if (dur > maxDurationSec + 0.25) {
        throw new Error(`Please keep clips ≤ ${maxDurationSec}s (yours was ~${dur.toFixed(1)}s).`);
      }
      onCapture(blob);
    } catch (e: any) {
      setError(e?.message || 'Failed to validate video. Please try again.');
    }
  }

  // --- preview / recording ---------------------------------------------------

  async function enablePreview() {
    resetError();
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        setPreviewOn(true);
        setTip('Preview enabled. You can also use the camera button below to capture a clip.');
      }
    } catch {
      setPreviewOn(false);
      setError(
        'Camera blocked. On iPhone: Settings → Safari → Camera → Allow. ' +
          'If installed as a Home Screen app: Settings → [App Name] → Camera → On.'
      );
    }
  }

  function startRecording() {
    resetError();
    if (!streamRef.current) {
      setError('Enable preview first.');
      return;
    }
    const mime = pickBestMime();
    if (!mime) {
      setError('In-browser recording not supported here. Use the camera button below instead.');
      return;
    }
    chunksRef.current = [];
    try {
      const mr = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const type = mime || 'video/webm';
        const blob = new Blob(chunksRef.current, { type });
        await validateAndSend(blob);
      };
      mr.start();
      setRecording(true);
      setTip('Recording… Tap Stop within 10–15s.');
      // Auto-stop at maxDurationSec + a small buffer
      window.setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopRecording();
        }
      }, (maxDurationSec + 0.5) * 1000);
    } catch {
      setError('Recording failed. Use the camera button below to capture a clip.');
    }
  }

  function stopRecording() {
    try {
      mediaRecorderRef.current?.stop();
    } finally {
      setRecording(false);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) validateAndSend(f);
    // allow re-selecting same file
    e.currentTarget.value = '';
  }

  // --- cleanup ---------------------------------------------------------------

  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.stop();
      } catch {}
      stopStreamTracks();
    };
  }, []);

  // --- UI --------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* iPhone-safe primary path */}
      <div>
        <label className="block text-sm font-medium mb-1">Quick capture (most reliable on iPhone)</label>
        <input
          type="file"
          accept="video/*;capture=camera"
          onChange={onPick}
          className="w-full rounded border p-2"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Tip: Record ~10–15 seconds from the side. You can also enable a live preview below.
        </p>
      </div>

      {/* Optional live preview (desktop/Android; iOS only if camera permission granted) */}
      <div className="space-y-2">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full rounded bg-black"
          style={{ aspectRatio: '16 / 9' }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={enablePreview}
            className="px-3 py-2 rounded bg-black text-white"
          >
            {previewOn ? 'Preview On' : 'Enable Preview'}
          </button>
          {!recording ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={!previewOn}
              className="px-3 py-2 rounded bg-green-600 text-white disabled:bg-gray-300"
            >
              Start Recording
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="px-3 py-2 rounded bg-red-600 text-white"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {info && <p className="text-xs text-blue-600">{info}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {isiOS && (
        <p className="text-xs text-muted-foreground">
          iPhone tip: If the preview won’t start, use the camera button above. To grant access later:
          Settings → Safari → Camera → Allow. For Home Screen apps: Settings → [App Name] → Camera → On.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Limit: ≤ {maxDurationSec}s, ≤ {Math.round(maxBytes / (1024 * 1024))}MB.
      </p>
    </div>
  );
}

export default CameraCapture;
