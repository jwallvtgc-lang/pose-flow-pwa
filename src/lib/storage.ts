/**
 * Storage helpers for uploading and reading swing videos.
 * - Client-side only (Vite). Uses edge function to avoid CORS.
 * - Requires env: VITE_STORAGE_CDN_URL
 */

import { getEnvVar } from '@/config/env';

type UploadArgs = {
  blob: Blob;
  client_request_id: string; // unique id (use crypto.randomUUID() at call site)
  preferredName?: string;    // default "swing"
  folder?: string;           // default "videos"
};

/** Base URL where files are served from (no trailing slash). */
function cdnBase(): string {
  const fallbackCdn = 'https://swingsense-video.f654e3871f91d6cea64b343e353ea3b8.r2.cloudflarestorage.com';
  return getEnvVar('VITE_STORAGE_CDN_URL') || fallbackCdn;
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
 * Upload a video using Supabase edge function (avoids CORS issues):
 *  1) Send video file to our edge function
 *  2) Edge function uploads to R2 server-side  
 *  3) Return { urlOrPath, key } for saving with your swing/session
 */
export async function uploadVideo({
  blob,
  client_request_id,
  preferredName = 'swing',
  folder = 'videos',
}: UploadArgs): Promise<{ urlOrPath: string; key: string }> {
  console.log('=== Starting video upload via edge function ===');
  console.log('Blob size:', blob.size);
  console.log('Content type:', blob.type);
  console.log('Client request ID:', client_request_id);
  
  try {
    // Create form data to send to edge function
    const formData = new FormData();
    formData.append('video', blob);
    formData.append('client_request_id', client_request_id);
    formData.append('preferred_name', preferredName);
    formData.append('folder', folder);

    // Upload via edge function
    const uploadUrl = `${getEnvVar('VITE_SUPABASE_URL')}/functions/v1/upload-video`;
    const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');
    
    console.log('Uploading to:', uploadUrl);
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: formData,
    });

    console.log('Upload response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Upload failed:', errorText);
      throw new Error(`Upload failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Upload successful:', result);
    
    return {
      urlOrPath: result.urlOrPath,
      key: result.key
    };
    
  } catch (error) {
    console.error('❌ Upload error:', error);
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
