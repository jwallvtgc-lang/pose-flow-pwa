import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { S3Client, PutObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.637.0'
import { getSignedUrl } from 'https://esm.sh/@aws-sdk/s3-request-presigner@3.637.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function createS3Client() {
  const region = Deno.env.get('STORAGE_REGION')
  const accessKeyId = Deno.env.get('STORAGE_ACCESS_KEY')
  const secretAccessKey = Deno.env.get('STORAGE_SECRET_KEY')
  const endpoint = Deno.env.get('STORAGE_ENDPOINT')

  const config: any = {
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  }

  // If using R2 or other S3-compatible service
  if (endpoint) {
    config.endpoint = endpoint
    config.forcePathStyle = true
  }

  return new S3Client(config)
}

function getFileExtension(contentType: string): string {
  if (contentType.includes('mp4')) return 'mp4'
  if (contentType.includes('quicktime')) return 'mov'
  if (contentType.includes('webm')) return 'webm'
  return 'mp4'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== UPLOAD URL GENERATION STARTED ===')
    
    if (req.method !== 'POST') {
      console.log('Invalid method:', req.method)
      return new Response('Method Not Allowed', { 
        status: 405, 
        headers: corsHeaders 
      })
    }

    const { filename, contentType, folder = 'videos' } = await req.json()
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

    // Check environment variables
    const bucket = Deno.env.get('STORAGE_BUCKET')
    const cdnBase = Deno.env.get('STORAGE_CDN_URL')
    const region = Deno.env.get('STORAGE_REGION')
    const accessKeyId = Deno.env.get('STORAGE_ACCESS_KEY')
    const secretAccessKey = Deno.env.get('STORAGE_SECRET_KEY')
    
    console.log('Environment check:', {
      bucket: !!bucket,
      cdnBase: !!cdnBase,
      region: !!region,
      accessKeyId: !!accessKeyId,
      secretAccessKey: !!secretAccessKey
    })

    if (!bucket || !cdnBase) {
      console.error('Missing storage configuration:', { bucket: !!bucket, cdnBase: !!cdnBase })
      return new Response(JSON.stringify({ error: 'Missing storage configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!region || !accessKeyId || !secretAccessKey) {
      console.error('Missing AWS credentials:', { region: !!region, accessKeyId: !!accessKeyId, secretAccessKey: !!secretAccessKey })
      return new Response(JSON.stringify({ error: 'Missing AWS credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const extension = getFileExtension(contentType)
    const timestamp = Date.now()
    const randomId = crypto.randomUUID().slice(0, 8)
    const key = `${folder}/${new Date().toISOString().slice(0, 10)}/${timestamp}-${randomId}-${filename.replace(/\s+/g, '-')}.${extension}`

    console.log('Generating upload URL for key:', key)

    console.log('Creating S3 client...')
    const client = createS3Client()
    
    console.log('Creating PutObjectCommand...')
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ACL: 'private', // Keep objects private, serve via CDN
    })

    console.log('Generating presigned URL...')
    // Generate presigned URL with 10 minute expiry
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 600 })

    // Public URL for accessing the file
    const publicUrl = `${cdnBase.replace(/\/+$/, '')}/${key}`

    console.log('Generated upload URL successfully')
    console.log('Upload URL length:', uploadUrl.length)
    console.log('Public URL:', publicUrl)

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