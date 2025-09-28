import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.637.0";
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.637.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function createS3Client() {
  const region = Deno.env.get("STORAGE_REGION") || "auto";
  const accessKeyId = Deno.env.get("STORAGE_ACCESS_KEY");
  const secretAccessKey = Deno.env.get("STORAGE_SECRET_KEY");

  // For Cloudflare R2, we need to construct the endpoint
  const accountId = secretAccessKey; // For R2, account ID is stored as secret key
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  const config = {
    region,
    endpoint,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: accessKeyId!, // For R2, use the token as both access key and secret
    },
    forcePathStyle: false, // R2 uses virtual-hosted-style URLs
  };

  return new S3Client(config);
}

function getFileExtension(contentType: string): string {
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("quicktime")) return "mov";
  if (contentType.includes("webm")) return "webm";
  return "mp4";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== UPLOAD URL GENERATION STARTED ===')
    console.log('Request method:', req.method)
    console.log('Timestamp:', new Date().toISOString())
    
    if (req.method !== 'POST') {
      console.log('Invalid method:', req.method)
      return new Response('Method Not Allowed', { 
        status: 405, 
        headers: corsHeaders 
      })
    }

    const requestBody = await req.json()
    const { filename, contentType, folder = 'videos' } = requestBody
    console.log('Request payload:', { filename, contentType, folder })

    if (!filename) {
      console.log('Missing filename')
      return new Response(JSON.stringify({ error: 'filename required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!contentType) {
      console.log('Missing contentType')
      return new Response(JSON.stringify({ error: 'contentType required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check environment variables with detailed logging
    const bucket = Deno.env.get('STORAGE_BUCKET')
    const cdnBase = Deno.env.get('STORAGE_CDN_URL')
    const region = Deno.env.get('STORAGE_REGION')
    const accessKeyId = Deno.env.get('STORAGE_ACCESS_KEY')
    const secretAccessKey = Deno.env.get('STORAGE_SECRET_KEY')
    
    console.log('=== ENVIRONMENT VARIABLES CHECK ===')
    console.log('STORAGE_BUCKET present:', !!bucket)
    console.log('STORAGE_CDN_URL present:', !!cdnBase)
    console.log('STORAGE_REGION present:', !!region)
    console.log('STORAGE_ACCESS_KEY present:', !!accessKeyId)
    console.log('STORAGE_SECRET_KEY present:', !!secretAccessKey)
    
    if (bucket) console.log('STORAGE_BUCKET value:', bucket)
    if (cdnBase) console.log('STORAGE_CDN_URL value:', cdnBase)
    if (region) console.log('STORAGE_REGION value:', region)
    if (accessKeyId) console.log('STORAGE_ACCESS_KEY first 4 chars:', accessKeyId.substring(0, 4) + '...')

    if (!bucket || !cdnBase) {
      console.error('Missing storage configuration:', { bucket: !!bucket, cdnBase: !!cdnBase })
      return new Response(JSON.stringify({ 
        error: 'Missing storage configuration',
        details: { bucket: !!bucket, cdnBase: !!cdnBase }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!region || !accessKeyId || !secretAccessKey) {
      console.error('Missing AWS credentials:', { region: !!region, accessKeyId: !!accessKeyId, secretAccessKey: !!secretAccessKey })
      return new Response(JSON.stringify({ 
        error: 'Missing AWS credentials',
        details: { region: !!region, accessKeyId: !!accessKeyId, secretAccessKey: !!secretAccessKey }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const extension = getFileExtension(contentType);
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().slice(0, 8);
    const sanitizedFilename = filename.replace(/\s+/g, "-");
    const key = `${folder}/${new Date().toISOString().slice(0, 10)}/${timestamp}-${randomId}-${sanitizedFilename}.${extension}`;

    console.log('Generated S3 key:', key)

    console.log('=== CREATING S3 CLIENT ===')
    const client = createS3Client()
    console.log('S3 client created successfully')
    
    console.log('=== CREATING PUT OBJECT COMMAND ===')
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ACL: 'private', // Keep objects private, serve via CDN
    })
    console.log('PutObjectCommand created successfully')

    console.log('=== GENERATING PRESIGNED URL ===')
    // Generate presigned URL with 10 minute expiry
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 })
    console.log('Presigned URL generated successfully')
    console.log('Upload URL length:', uploadUrl.length)

    // Public URL for accessing the file
    const publicUrl = `${cdnBase.replace(/\/+$/, '')}/${key}`
    console.log('Public URL generated:', publicUrl)

    console.log('=== SUCCESS ===')
    return new Response(JSON.stringify({ uploadUrl, publicUrl, key }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('=== UPLOAD URL GENERATION ERROR ===')
    console.error('Error occurred at timestamp:', new Date().toISOString())
    
    if (error instanceof Error) {
      console.error('Error type:', error.constructor.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    } else {
      console.error('Unknown error type:', typeof error)
      console.error('Unknown error:', error)
    }
    
    // Also log environment state for debugging
    console.error('Environment state:', {
      bucket: !!Deno.env.get('STORAGE_BUCKET'),
      cdnBase: !!Deno.env.get('STORAGE_CDN_URL'),
      region: !!Deno.env.get('STORAGE_REGION'),
      accessKeyId: !!Deno.env.get('STORAGE_ACCESS_KEY'),
      secretAccessKey: !!Deno.env.get('STORAGE_SECRET_KEY')
    })
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})