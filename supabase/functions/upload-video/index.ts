import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('=== VIDEO UPLOAD STARTED ===');
  console.log('Request method:', req.method);

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    // Get the uploaded file from the request
    const formData = await req.formData();
    const file = formData.get('video') as File;
    const clientRequestId = formData.get('client_request_id') as string;
    const preferredName = formData.get('preferred_name') as string || 'swing';
    const folder = formData.get('folder') as string || 'videos';

    if (!file) {
      return new Response('No video file provided', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      clientRequestId,
    });

    // Generate file extension
    const getFileExtension = (contentType: string): string => {
      const type = contentType.toLowerCase();
      if (type.includes('mp4')) return 'mp4';
      if (type.includes('quicktime')) return 'mov';
      if (type.includes('webm')) return 'webm';
      return 'mp4';
    };

    // Generate filename
    const extension = getFileExtension(file.type);
    const sanitizedName = preferredName.replace(/[^a-zA-Z0-9-]/g, '-');
    const filename = `${sanitizedName}-${clientRequestId}.${extension}`;

    console.log('Generated filename:', filename);

    // Get presigned URL using existing function
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: presignData, error: presignError } = await supabase.functions.invoke(
      'generate-upload-url',
      {
        body: {
          filename,
          contentType: file.type,
          folder,
        }
      }
    );

    if (presignError || !presignData) {
      console.error('Failed to get presigned URL:', presignError);
      return new Response('Failed to get upload URL', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    console.log('Got presigned URL:', presignData.uploadUrl ? 'yes' : 'no');

    // Upload to R2 using the presigned URL (authentication is embedded in the URL)
    const arrayBuffer = await file.arrayBuffer();
    
    const uploadResponse = await fetch(presignData.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: arrayBuffer,
    });

    if (!uploadResponse.ok) {
      console.error('Upload failed:', uploadResponse.status, uploadResponse.statusText);
      const errorText = await uploadResponse.text().catch(() => '');
      console.error('Upload error response:', errorText);
      
      return new Response('Upload failed', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    console.log('Upload successful');

    const result = {
      urlOrPath: presignData.publicUrl,
      key: presignData.key,
      size: file.size,
      contentType: file.type,
    };

    console.log('=== SUCCESS ===');
    console.log('Result:', result);

    return new Response(JSON.stringify(result), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      },
    });

  } catch (error) {
    console.error('=== UPLOAD ERROR ===');
    console.error('Error details:', error);
    
    return new Response('Upload failed', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});