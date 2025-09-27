const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

interface SwingEmailRequest {
  toEmail: string;
  fromName?: string;
  swingData: {
    id: string;
    score: number;
    date: string;
    metrics: Array<{ name: string; value: number; unit: string; target: string }>;
    coachingFeedback?: {
      cues: string[];
      explanations?: string[];
      encouragement?: string;
      focusAreas?: string[];
    };
    drill?: { name: string; instructions: string };
  };
  message?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== EMAIL SENDING STARTED ===');
    console.log('Request method:', req.method);
    
    const requestBody = await req.json();
    console.log('Request body received:', JSON.stringify(requestBody, null, 2));
    
    const { toEmail, fromName, swingData, message }: SwingEmailRequest = requestBody;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!toEmail || !emailRegex.test(toEmail)) {
      console.log('Invalid email address:', toEmail);
      throw new Error("Invalid email address format");
    }

    console.log('Email validation passed:', toEmail);

    // Check Resend API key
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('Missing RESEND_API_KEY');
      throw new Error('Email service not configured');
    }

    console.log('Resend API key found');

    // Generate HTML email
    const html = generateSwingAnalysisHTML(swingData, fromName || 'SwingSense User', message);

    console.log('Email HTML generated successfully');

    // Send email via Resend API directly
    console.log('Sending email via Resend API...');
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SwingSense <noreply@resend.dev>',
        to: [toEmail],
        subject: `🏏 Swing Analysis from ${fromName || 'SwingSense'} - Score: ${swingData.score}/100`,
        html: html,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error('Resend API error:', errorData);
      throw new Error(`Email service error: ${emailResponse.status} - ${errorData}`);
    }

    const emailData = await emailResponse.json();
    console.log('Email sent successfully:', emailData);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Email sent successfully!",
      emailId: emailData?.id
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("=== EMAIL SENDING ERROR ===");
    console.error("Error type:", error.constructor?.name || 'Unknown');
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send email',
        details: error.constructor?.name || 'Unknown error type'
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function generateSwingAnalysisHTML(swingData: any, fromName: string, personalMessage?: string): string {
  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    return 'Needs Work';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const scoreLabel = getScoreLabel(swingData.score);
  const scoreColor = getScoreColor(swingData.score);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Swing Analysis from ${fromName}</title>
  <style>
    body { 
      margin: 0; 
      padding: 0; 
      background-color: #f6f9fc; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif; 
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background-color: #ffffff; 
      padding: 20px 0 48px; 
      margin-bottom: 64px; 
    }
    .header { 
      padding: 32px 24px; 
      text-align: center; 
      background-color: #1e40af; 
      border-radius: 8px 8px 0 0; 
    }
    .header-emoji { font-size: 48px; margin: 0 0 16px 0; }
    .header h1 { 
      color: #ffffff; 
      font-size: 32px; 
      font-weight: bold; 
      margin: 0 0 8px 0; 
    }
    .header .subtitle { 
      color: #e2e8f0; 
      font-size: 16px; 
      margin: 0; 
    }
    .score-section { 
      padding: 32px 24px; 
      text-align: center; 
    }
    .score-card { 
      display: inline-block; 
      padding: 24px; 
      border: 3px solid ${scoreColor}; 
      border-radius: 16px; 
      background-color: #f8fafc; 
    }
    .score-number { 
      font-size: 48px; 
      font-weight: bold; 
      margin: 0; 
      color: ${scoreColor}; 
    }
    .score-out-of { 
      font-size: 24px; 
      color: #64748b; 
      margin: 0; 
    }
    .score-label { 
      font-size: 16px; 
      font-weight: 600; 
      margin: 8px 0 0 0; 
      text-transform: uppercase; 
      letter-spacing: 0.5px; 
      color: ${scoreColor}; 
    }
    .section { padding: 24px; }
    .section h2 { 
      font-size: 20px; 
      font-weight: bold; 
      margin: 0 0 16px 0; 
      color: #1e293b; 
    }
    .metric-row { 
      padding: 12px 0; 
      border-bottom: 1px solid #e2e8f0; 
    }
    .metric-name { 
      font-size: 16px; 
      font-weight: 600; 
      color: #1e293b; 
      margin: 0 0 4px 0; 
    }
    .metric-value { 
      font-size: 18px; 
      font-weight: bold; 
      color: #3b82f6; 
      margin: 0 0 4px 0; 
    }
    .metric-target { 
      font-size: 14px; 
      color: #64748b; 
      margin: 0; 
    }
    .personal-message { 
      padding: 24px; 
      background-color: #eff6ff; 
      margin: 0 24px; 
      border-radius: 8px; 
      border-left: 4px solid #3b82f6; 
    }
    .encouragement { 
      padding: 24px; 
      background-color: #f0fdf4; 
      margin: 0 24px; 
      border-radius: 8px; 
      text-align: center; 
      color: #166534; 
      font-weight: 500; 
    }
    .footer { 
      padding: 0 24px 24px 24px; 
      text-align: center; 
      color: #64748b; 
      font-size: 14px; 
    }
    .list-item { 
      font-size: 16px; 
      color: #475569; 
      margin: 8px 0; 
      line-height: 1.5; 
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-emoji">🏏</div>
      <h1>Swing Analysis</h1>
      <div class="subtitle">Shared by ${fromName}</div>
    </div>

    <div class="score-section">
      <div class="score-card">
        <span class="score-number">${swingData.score}</span>
        <span class="score-out-of">/100</span>
        <div class="score-label">${scoreLabel}</div>
      </div>
      <div style="color: #64748b; font-size: 14px; margin: 16px 0 0 0;">${swingData.date}</div>
    </div>

    ${personalMessage ? `
    <div class="personal-message">
      <div style="font-size: 14px; font-weight: 600; color: #1e40af; margin: 0 0 8px 0;">Personal Message:</div>
      <div style="font-size: 16px; color: #1e40af; font-style: italic; margin: 0; line-height: 1.5;">"${personalMessage}"</div>
    </div>
    ` : ''}

    ${swingData.coachingFeedback?.cues?.length ? `
    <div class="section">
      <h2>🎯 Focus Areas</h2>
      ${swingData.coachingFeedback.cues.slice(0, 3).map((cue: string) => 
        `<div class="list-item">• ${cue}</div>`
      ).join('')}
    </div>
    ` : ''}

    ${swingData.metrics?.length ? `
    <div class="section">
      <h2>📊 Key Metrics</h2>
      ${swingData.metrics.slice(0, 4).map((metric: any) => `
        <div class="metric-row">
          <div class="metric-name">${metric.name}</div>
          <div class="metric-value">${typeof metric.value === 'number' ? metric.value.toFixed(1) : metric.value} ${metric.unit}</div>
          <div class="metric-target">Target: ${metric.target}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${swingData.drill ? `
    <div class="section">
      <h2>🏋️‍♂️ Recommended Drill</h2>
      <div style="font-size: 18px; font-weight: bold; color: #1e293b; margin: 0 0 12px 0;">${swingData.drill.name}</div>
      <div style="font-size: 16px; color: #475569; line-height: 1.5; margin: 0;">${swingData.drill.instructions}</div>
    </div>
    ` : ''}

    ${swingData.coachingFeedback?.encouragement ? `
    <div class="encouragement">
      ${swingData.coachingFeedback.encouragement}
    </div>
    ` : ''}

    <hr style="border-color: #e2e8f0; margin: 32px 24px;">

    <div class="footer">
      <div>This swing analysis was generated by SwingSense - AI-powered baseball swing analysis.</div>
      <div style="font-size: 16px; color: #3b82f6; font-weight: 600; margin: 8px 0 0 0;">Keep swinging! 🥎</div>
    </div>
  </div>
</body>
</html>
  `;
}

Deno.serve(handler);