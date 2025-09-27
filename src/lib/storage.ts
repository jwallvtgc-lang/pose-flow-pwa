// src/lib/storage.ts

/**
 * Storage helpers for uploading and reading swing videos.
 * - Client-side only (Vite). Uses a serverless presigner at /api/upload-url.
 * - Requires env: VITE_STORAGE_CDN_URL (e.g., https://<bucket>.s3.<region>.amazonaws.com or CloudFront/R2 domain)
 */

type PresignResponse = {
  uploadUrl: string; // PUT here with the same Content-Type used for signing
  publicUrl: string; // Browser-readable URL (via CDN/S3) for saving in your DB
  key: string;       // Object key (path in bucket)
};

type UploadArgs = {
  blob: Blob;
  client_request_id: string; // unique id (use crypto.randomUUID() at call site)
  preferredName?: string;    // default "swing"
  folder?: string;           // default "videos"
};

function env<T = string>(k: string, fallback?: T): T {
  const v = (import.meta as any).env?.[k];
  return (v ?? fallback) as T;
}

/** Base URL where files are served from (no trailing slash). */
function cdnBase(): string {
  return String(env('VITE_STORAGE_CDN_URL', '')).replace(/\/+$/, '');
}

/** Very small mime → extension mapping; defaults to mp4. */
function extFromMime(m: string | undefined): string {
  if (!m) return 'mp4';
  const s = m.toLowerCase();
  if (s.includes('mp4')) return 'mp4';
  if (s.includes('quicktime')) return 'mov';
  if (s.includes('webm')) return 'webm';
  return 'mp4';
}

/** Build a browser-fetchable URL for a given key OR return if already an absolute URL. */
export function publicUrlForKey(keyOrUrl: string): string {
  if (!keyOrUrl) return '';
  if (/^https?:\/\//i.test(keyOrUrl)) return keyOrUrl;
  const base = cdnBase();
  return base ? `${base}/${keyOrUrl.replace(/^\/+/, '')}` : keyOrUrl;
}

/**
 * Backward-compatible getter expected elsewhere in the app.
 * MVP: returns a plain public URL. If you later lock the bucket,
 * swap this to call an API that returns a *signed GET*.
 */
export async function getVideoSignedUrl(keyOrUrl: string): Promise<string> {
  return publicUrlForKey(keyOrUrl);
}

/**
 * Upload a video in 3 steps:
 *  1) Ask our API for a presigned PUT URL, signed with the same Content-Type we will send.
 *  2) PUT the Blob to that URL (include matching Content-Type header).
 *  3) Return { urlOrPath, key } for saving with your swing/session.
 */
export async function uploadVideo({
  blob,
  client_request_id,
  preferredName = 'swing',
  folder = 'videos',
}: UploadArgs): Promise<{ urlOrPath: string; key: string }> {
  const contentType = blob.type || 'video/mp4';
  const safeName = `${preferredName}-${client_request_id}.${extFromMime(contentType)}`;

  // 1) Ask for presigned URL
  const presign = await fetch('/api/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: safeName.replace(/\s+/g, '-'),
      contentType,
      folder,
    }),
  });

  if (!presign.ok) {
    const text = await presign.text().catch(() => '');
    throw new Error(`Failed to get upload URL (${presign.status}): ${text}`);
  }

  const { uploadUrl, publicUrl, key } = (await presign.json()) as PresignResponse;

  // 2) PUT the blob to S3/R2 with the SAME Content-Type
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!putRes.ok) {
    const text = await putRes.text().catch(() => '');
    throw new Error(`Upload failed (${putRes.status}): ${text}`);
  }

  // 3) Return the URL you can persist (served from CDN/S3) and the object key
  return { urlOrPath: publicUrlForKey(publicUrl || key), key };
}

/**
 * (Optional) Helper to normalize any stored path/URL to a display URL.
 * Useful when older rows contain just keys and newer rows store full URLs.
 */
export function toDisplayUrl(maybeKeyOrUrl: string | null | undefined): string {
  if (!maybeKeyOrUrl) return '';
  return publicUrlForKey(maybeKeyOrUrl);
}
