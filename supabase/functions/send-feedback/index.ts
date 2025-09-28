import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('=== FEEDBACK SUBMISSION STARTED ===')
    
    if (req.method !== 'POST') {
      console.log('Invalid method:', req.method)
      return new Response('Method Not Allowed', { 
        status: 405, 
        headers: corsHeaders 
      })
    }

    const { name, email, feedbackType, message, userId, timestamp } = await req.json()
    console.log('Feedback submission:', { name, email, feedbackType, hasMessage: !!message, userId, timestamp })

    // Validate required fields
    if (!email || !message) {
      console.log('Missing required fields')
      return new Response(JSON.stringify({ error: 'Email and message are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get Resend API key
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('Missing RESEND_API_KEY')
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Format feedback type for display
    const formatFeedbackType = (type: string) => {
      switch (type) {
        case 'bug': return 'Bug Report'
        case 'feature': return 'Feature Request'
        case 'improvement': return 'Improvement Suggestion'
        case 'general': return 'General Feedback'
        case 'other': return 'Other'
        default: return 'General Feedback'
      }
    }

    // Create email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SwingSense Feedback</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 28px; font-weight: bold; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
            .content { background: #f8fafc; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
            .field { margin-bottom: 20px; }
            .field label { font-weight: bold; color: #374151; display: block; margin-bottom: 8px; }
            .field value { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; display: block; }
            .message-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; white-space: pre-wrap; font-family: Georgia, serif; line-height: 1.7; }
            .footer { color: #6b7280; font-size: 14px; text-align: center; margin-top: 30px; }
            .badge { display: inline-block; background: #3b82f6; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📝 New SwingSense Feedback</h1>
            <p>A user has submitted feedback for your review</p>
          </div>
          
          <div class="content">
            <div class="field">
              <label>From:</label>
              <div class="value">${name || 'Anonymous User'} &lt;${email}&gt;</div>
            </div>
            
            <div class="field">
              <label>Feedback Type:</label>
              <div class="value">
                <span class="badge">${formatFeedbackType(feedbackType)}</span>
              </div>
            </div>
            
            <div class="field">
              <label>Submitted:</label>
              <div class="value">${new Date(timestamp).toLocaleString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
              })}</div>
            </div>
            
            ${userId ? `
            <div class="field">
              <label>User ID:</label>
              <div class="value">${userId}</div>
            </div>
            ` : ''}
            
            <div class="field">
              <label>Message:</label>
              <div class="message-box">${message}</div>
            </div>
          </div>
          
          <div class="footer">
            <p>This feedback was submitted through the SwingSense app feedback form.</p>
            <p>Reply directly to this email to respond to the user.</p>
          </div>
        </body>
      </html>
    `

    // Send email using Resend
    console.log('Sending feedback email via Resend...')
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SwingSense Feedback <onboarding@resend.dev>',
        to: ['jwallvtgc@gmail.com'], // Using your email address since swingsense.app isn't verified
        reply_to: email,
        subject: `[${formatFeedbackType(feedbackType)}] ${name || 'Anonymous'}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`,
        html: emailHtml,
      }),
    })

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text()
      console.error('Resend API error:', errorText)
      throw new Error(`Email send failed: ${emailResponse.status} ${errorText}`)
    }

    const emailResult = await emailResponse.json()
    console.log('Email sent successfully:', emailResult.id)

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResult.id,
      message: 'Feedback sent successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('=== FEEDBACK SUBMISSION ERROR ===')
    console.error('Error occurred at timestamp:', new Date().toISOString())
    
    if (error instanceof Error) {
      console.error('Error type:', error.constructor.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    } else {
      console.error('Unknown error type:', typeof error)
      console.error('Unknown error:', error)
    }
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})