// src/lib/storage.ts

/**
 * Storage helpers for uploading and reading swing videos.
 * - Client-side only (Vite). Uses R2 with AWS S3 SDK for proper authentication.
 * - Requires env: VITE_STORAGE_CDN_URL
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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

function env<T = string>(k: string, fallback?: T): T {
  const v = (import.meta as any).env?.[k];
  return (v ?? fallback) as T;
}

/** Base URL where files are served from (no trailing slash). */
function cdnBase(): string {
  const fallbackCdn = 'https://swingsense-video.f654e3871f91d6cea64b343e353ea3b8.r2.dev';
  return String(env('VITE_STORAGE_CDN_URL', fallbackCdn)).replace(/\/+$/, '');
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
  const presignUrl = `https://xdurzrndnpxhdrbtqqnz.supabase.co/functions/v1/generate-upload-url`;
  console.log('Requesting presigned URL from:', presignUrl);
  
  const requestBody = {
    filename: safeName.replace(/\s+/g, '-'),
    contentType,
    folder,
  };
  
  console.log('Request body:', requestBody);
  
  try {
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdXJ6cm5kbnB4aGRyYnRxcW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNzQ0MjMsImV4cCI6MjA3MzY1MDQyM30.ammqHLKHJjY3ynwgbuV0M9Q8jEKwcXELoWi8rMnkPxI';
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
    
    const { uploadUrl, publicUrl, key, credentials, headers: uploadHeaders } = presignData as PresignResponse;

    // 2) Upload using AWS S3 SDK for proper authentication
    console.log('=== Starting authenticated upload to R2 ===');
    console.log('Upload URL (first 100 chars):', uploadUrl.substring(0, 100) + '...');
    
    if (!credentials) {
      console.warn('No credentials provided, falling back to simple PUT');
      // Fall back to simple PUT if no credentials
      const headers: Record<string, string> = uploadHeaders || { 'Content-Type': contentType };
      console.log('Upload headers:', headers);
      
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers,
        body: blob,
      });

      console.log('Simple upload response status:', putRes.status);
      
      if (!putRes.ok) {
        const text = await putRes.text().catch(() => '');
        console.error('Simple upload failed:', text);
        throw new Error(`Upload failed (${putRes.status}): ${text}`);
      }
    } else {
      // Use AWS S3 SDK for authenticated upload
      console.log('Using AWS S3 SDK for authenticated upload');
      
      // Extract bucket and key from URL
      const urlParts = uploadUrl.match(/https:\/\/([^.]+)\.r2\.cloudflarestorage\.com\/([^\/]+)\/(.+)/);
      if (!urlParts) {
        throw new Error('Invalid upload URL format');
      }
      
      const [, accountId, bucket, s3Key] = urlParts;
      console.log('Extracted - Account ID:', accountId, 'Bucket:', bucket, 'Key:', s3Key);
      
      // Configure S3 client for R2
      const s3Client = new S3Client({
        region: credentials.region,
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
        },
        forcePathStyle: false,
      });
      
      // Convert blob to ArrayBuffer for S3 compatibility
      const arrayBuffer = await blob.arrayBuffer();
      
      // Create the put command
      const putCommand = new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: new Uint8Array(arrayBuffer),
        ContentType: contentType,
      });
      
      try {
        const result = await s3Client.send(putCommand);
        console.log('S3 upload result:', result);
      } catch (error) {
        console.error('S3 upload error:', error);
        throw new Error(`S3 upload failed: ${error}`);
      }
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
