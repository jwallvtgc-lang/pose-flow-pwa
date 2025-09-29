import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getSignedUrl } from "https://deno.land/x/aws_s3_presign/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getFileExtension(contentType: string): string {
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("webm")) return "webm";
  return "mp4";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== UPLOAD URL GENERATION STARTED ===');
    console.log('Request method:', req.method);
    console.log('Timestamp:', new Date().toISOString());
    
    if (req.method !== 'POST') {
      console.log('Invalid method:', req.method);
      return new Response('Method Not Allowed', { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    const requestBody = await req.json();
    const { filename, contentType, folder = 'videos' } = requestBody;
    console.log('Request payload:', { filename, contentType, folder });

    if (!filename) {
      console.log('Missing filename');
      return new Response(JSON.stringify({ error: 'filename required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!contentType) {
      console.log('Missing contentType');
      return new Response(JSON.stringify({ error: 'contentType required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check environment variables
    const bucket = Deno.env.get('STORAGE_BUCKET');
    const cdnBase = Deno.env.get('STORAGE_CDN_URL');
    const accessKeyId = Deno.env.get('STORAGE_ACCESS_KEY');
    const secretKey = Deno.env.get('STORAGE_SECRET_KEY');
    const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
    
    console.log('=== ENVIRONMENT VARIABLES CHECK ===');
    console.log('STORAGE_BUCKET present:', !!bucket);
    console.log('STORAGE_CDN_URL present:', !!cdnBase);
    console.log('STORAGE_ACCESS_KEY present:', !!accessKeyId);
    console.log('STORAGE_SECRET_KEY present:', !!secretKey);
    console.log('CLOUDFLARE_ACCOUNT_ID present:', !!accountId);
    
    if (bucket) console.log('STORAGE_BUCKET value:', bucket);
    if (cdnBase) console.log('STORAGE_CDN_URL value:', cdnBase);
    if (accessKeyId) console.log('STORAGE_ACCESS_KEY first 4 chars:', accessKeyId.substring(0, 4) + '...');
    if (accountId) console.log('CLOUDFLARE_ACCOUNT_ID value:', accountId);

    if (!bucket || !cdnBase || !accessKeyId || !secretKey || !accountId) {
      const missing = [];
      if (!bucket) missing.push('STORAGE_BUCKET');
      if (!cdnBase) missing.push('STORAGE_CDN_URL');
      if (!accessKeyId) missing.push('STORAGE_ACCESS_KEY');
      if (!secretKey) missing.push('STORAGE_SECRET_KEY');
      if (!accountId) missing.push('CLOUDFLARE_ACCOUNT_ID');
      
      console.error('Missing environment variables:', missing);
      return new Response(JSON.stringify({ 
        error: 'Missing storage configuration',
        missing: missing
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const extension = getFileExtension(contentType);
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    
    // Remove existing extension from filename to avoid duplicates
    let sanitizedFilename = filename.replace(/\s+/g, "-");
    const existingExtension = sanitizedFilename.split('.').pop()?.toLowerCase();
    if (existingExtension && ['mp4', 'mov', 'webm'].includes(existingExtension)) {
      sanitizedFilename = sanitizedFilename.replace(/\.[^.]*$/, '');
    }
    
    const key = `${folder}/${new Date().toISOString().slice(0, 10)}/${timestamp}-${randomId}-${sanitizedFilename}.${extension}`;

    console.log('Generated S3 key:', key);

    console.log('=== CREATING R2 UPLOAD URL ===');
    
    // Generate presigned URL using Deno AWS S3 presign module
    const uploadUrl = getSignedUrl({
      accessKeyId,
      secretAccessKey: secretKey,
      bucket,
      key,
      method: 'PUT',
      region: 'auto',
      endpoint: `${accountId}.r2.cloudflarestorage.com`,
      expiresIn: 3600, // 1 hour expiry
      queryParams: {
        'Content-Type': contentType,
      },
    });

    const publicUrl = `${cdnBase}/${key}`;

    console.log('Presigned upload URL generated successfully');
    console.log('Public URL created:', publicUrl);

    // Return the URLs for the client to use
    const response = {
      uploadUrl,
      publicUrl,
      key,
    };

    console.log('=== SUCCESS ===');
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('=== UPLOAD URL GENERATION ERROR ===');
    console.error('Error occurred at timestamp:', new Date().toISOString());
    
    if (error instanceof Error) {
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    } else {
      console.error('Unknown error type:', typeof error);
      console.error('Unknown error:', error);
    }
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});