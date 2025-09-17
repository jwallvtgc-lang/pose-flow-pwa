import { supabase } from '@/integrations/supabase/client';

interface UploadVideoResult {
  urlOrPath: string;
}

export async function uploadVideo({
  blob,
  athlete_id,
  client_request_id
}: {
  blob: Blob;
  athlete_id?: string;
  client_request_id: string;
}): Promise<UploadVideoResult> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  const athleteFolder = athlete_id || 'anon';
  const path = `swings/${athleteFolder}/${year}/${month}/${client_request_id}.mp4`;

  const { data, error } = await supabase.storage
    .from('swings')
    .upload(path, blob, {
      contentType: 'video/mp4',
      upsert: false
    });

  if (error) {
    throw new Error(`Video upload failed: ${error.message}`);
  }

  // Since the bucket is private, we return the path for later signed URL generation
  // If bucket was public, we'd use: supabase.storage.from('swings').getPublicUrl(path)
  return { urlOrPath: data.path };
}

export async function getVideoSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('swings')
    .createSignedUrl(path, 3600); // 1 hour expiry

  if (error) {
    throw new Error(`Failed to get signed URL: ${error.message}`);
  }

  return data.signedUrl;
}