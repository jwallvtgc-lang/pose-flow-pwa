// src/lib/storage.ts
/**
 * Upload a video Blob by:
 *  1) asking our API for a presigned PUT URL (signed with the same Content-Type we will send)
 *  2) PUT the Blob to that URL
 *  3) return a public URL to save alongside the swing
 */

export async function uploadVideo({
  blob,
  client_request_id,
  preferredName = 'swing',
}: {
  blob: Blob;
  client_request_id: string;
  preferredName?: string;
}) {
  // Decide Content-Type: iOS often gives video/quicktime; both are fine if signed the same way.
  // If your bucket lifecycle needs MP4, you can transcode later; for upload just pass through.
  const contentType = blob.type || 'video/mp4';

  // 1) Ask API for presigned URL
  const resp = await fetch('/api/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: `${preferredName}-${client_request_id}`,
      contentType,
      // optional: folder hint
      folder: 'videos',
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Failed to get upload URL (${resp.status}): ${text}`);
  }

  const { uploadUrl, publicUrl, key } = (await resp.json()) as {
    uploadUrl: string;
    publicUrl: string;
    key: string;
  };

  // 2) PUT the blob with the SAME Content-Type used for signing
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!put.ok) {
    const text = await put.text().catch(() => '');
    throw new Error(`Upload failed (${put.status}): ${text}`);
  }

  // 3) Return the public URL (via CDN if configured)
  return { urlOrPath: publicUrl, key };
}
