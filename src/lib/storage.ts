/**
 * Storage helpers for uploading and reading swing videos.
 * - Client-side only (Vite). Uses R2 with simple PUT requests.
 * - Requires env: VITE_STORAGE_CDN_URL
 */

import { getEnvVar } from '@/config/env';

type PresignResponse = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };
  headers?: Record<string, string>;
};

type UploadArgs = {
  blob: Blob;
  client_request_id: string; // unique id (use crypto.randomUUID() at call site)
  preferredName?: string;    // default "swing"
  folder?: string;           // default "videos"
};

/** Base URL where files are served from (no trailing slash). */
function cdnBase(): string {
  const fallbackCdn = 'https://swingsense-video.f654e3871f91d6cea64b343e353ea3b8.r2.dev';
  return getEnvVar('VITE_STORAGE_CDN_URL') || fallbackCdn;
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
  console.log('=== Starting video upload ===');
  console.log('Blob size:', blob.size);
  console.log('Content type:', blob.type);
  console.log('Client request ID:', client_request_id);
  
  const contentType = blob.type || 'video/mp4';
  const safeName = `${preferredName}-${client_request_id}.${extFromMime(contentType)}`;
  
  console.log('Safe filename:', safeName);
  console.log('CDN base URL:', cdnBase());

  // 1) Ask for presigned URL from Supabase edge function
  const presignUrl = `${getEnvVar('VITE_SUPABASE_URL')}/functions/v1/generate-upload-url`;
  console.log('Requesting presigned URL from:', presignUrl);
  
  const requestBody = {
    filename: safeName.replace(/\s+/g, '-'),
    contentType,
    folder,
  };
  
  console.log('Request body:', requestBody);
  
  try {
    const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');
    console.log('Using Supabase anon key (first 10 chars):', supabaseAnonKey.substring(0, 10) + '...');
    
    const presign = await fetch(presignUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Presign response status:', presign.status);
    console.log('Presign response headers:', Object.fromEntries(presign.headers.entries()));

    if (!presign.ok) {
      const text = await presign.text().catch(() => '');
      console.error('Presign request failed:', text);
      throw new Error(`Failed to get upload URL (${presign.status}): ${text}`);
    }

    const presignData = await presign.json();
    console.log('Presign response data:', presignData);
    
    const { uploadUrl, publicUrl, key } = presignData as PresignResponse;

    // 2) Upload directly to R2 using simple PUT
    console.log('=== Starting R2 upload with PUT ===');
    console.log('Upload URL (first 100 chars):', uploadUrl.substring(0, 100) + '...');
    
    // Always use simple PUT - it works better with R2 CORS
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      // Don't add any other headers to avoid CORS issues
    };
    
    console.log('Upload headers:', headers);
    
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers,
      body: blob,
    });

    console.log('Upload response status:', putRes.status);
    console.log('Upload response headers:', Object.fromEntries(putRes.headers.entries()));
    
    if (!putRes.ok) {
      const text = await putRes.text().catch(() => '');
      console.error('Upload failed:', text);
      throw new Error(`Upload failed (${putRes.status}): ${text}`);
    }

    console.log('=== Upload successful ===');
    const finalUrl = publicUrlForKey(publicUrl || key);
    console.log('Final URL:', finalUrl);
    
    // 3) Return the URL you can persist (served from CDN/S3) and the object key
    return { urlOrPath: finalUrl, key };
    
  } catch (error) {
    console.error('=== Upload error ===');
    console.error(error);
    throw error;
  }
}

/**
 * (Optional) Helper to normalize any stored path/URL to a display URL.
 * Useful when older rows contain just keys and newer rows store full URLs.
 */
export function toDisplayUrl(maybeKeyOrUrl: string | null | undefined): string {
  if (!maybeKeyOrUrl) return '';
  return publicUrlForKey(maybeKeyOrUrl);
}
