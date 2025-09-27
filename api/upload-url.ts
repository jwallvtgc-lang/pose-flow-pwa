
// api/upload-url.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import {
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ENV REQUIRED (add in Vercel/Lovable project settings)
// STORAGE_BUCKET=your-bucket
// STORAGE_REGION=us-east-1
// STORAGE_ACCESS_KEY=AKIA... (or R2 access key)
// STORAGE_SECRET_KEY=...     (or R2 secret key)
// STORAGE_CDN_URL=https://your-dist.cloudfront.net  (or https://<bucket>.s3.<region>.amazonaws.com)
// Optional for R2 (S3-compatible):
// STORAGE_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com

function s3Client() {
  const {
    STORAGE_REGION,
    STORAGE_ACCESS_KEY,
    STORAGE_SECRET_KEY,
    STORAGE_ENDPOINT,
  } = process.env;

  const cfg: any = {
    region: STORAGE_REGION,
    credentials: {
      accessKeyId: STORAGE_ACCESS_KEY!,
      secretAccessKey: STORAGE_SECRET_KEY!,
    },
  };

  // If using R2 or other S3-compatible, set endpoint + forcePathStyle
  if (STORAGE_ENDPOINT) {
    cfg.endpoint = STORAGE_ENDPOINT;
    cfg.forcePathStyle = true;
  }

  return new S3Client(cfg);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { filename, contentType, folder = 'uploads' } = (req.body || {}) as {
      filename?: string;
      contentType?: string;
      folder?: string;
    };

    if (!filename) return res.status(400).json({ error: 'filename required' });
    if (!contentType) return res.status(400).json({ error: 'contentType required' });

    const bucket = process.env.STORAGE_BUCKET!;
    const cdnBase = process.env.STORAGE_CDN_URL!;
    if (!bucket || !cdnBase) {
      return res.status(500).json({ error: 'Missing STORAGE_BUCKET or STORAGE_CDN_URL env' });
    }

    const extFromType = (() => {
      // minimal mapping; store whatever comes through if unknown
      if (contentType.includes('mp4')) return 'mp4';
      if (contentType.includes('quicktime')) return 'mov';
      if (contentType.includes('webm')) return 'webm';
      return 'mp4';
    })();

    const key = `${folder}/${new Date().toISOString().slice(0, 10)}/${Date.now()}-${crypto
      .randomUUID()
      .slice(0, 8)}-${filename}.${extFromType}`;

    const client = s3Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType, // must match the header used in the PUT
      ACL: 'private', // we serve via CDN/or signed GET; keep objects private
    });

    // Short expiry keeps it safe; 10 minutes is plenty for mobile
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 });

    // Public URL to store in DB — via CDN if configured
    const publicUrl = `${cdnBase.replace(/\/+$/, '')}/${key}`;

    res.status(200).json({ uploadUrl, publicUrl, key });
  } catch (err: any) {
    console.error('upload-url error', err);
    res.status(500).json({ error: err?.message ?? 'internal error' });
  }
}
