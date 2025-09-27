import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SwingAnalysisRequest {
  toEmail: string;
  fromName?: string;
  swingData: {
    id: string;
    score: number;
    date: string;
    metrics: Array<{
      name: string;
      value: number;
      unit: string;
      target: string;
    }>;
    coachingFeedback?: {
      cues: string[];
      explanations: string[];
      encouragement: string;
    };
    drill?: {
      name: string;
      instructions: string;
    };
  };
  message?: string;
}

const formatSwingAnalysisEmail = (data: SwingAnalysisRequest) => {
  const { swingData, fromName, message } = data;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Swing Analysis Report</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 800; }
        .header p { margin: 10px 0 0; opacity: 0.9; }
        .score-badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 18px; margin-top: 10px; }
        .content { padding: 30px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #1f2937; font-size: 20px; font-weight: 700; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
        .coaching-section { background: #eff6ff; padding: 20px; border-radius: 12px; border-left: 4px solid #2563eb; }
        .cue { background: white; padding: 15px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #e5e7eb; }
        .cue-title { font-weight: 600; color: #1f2937; margin-bottom: 5px; }
        .cue-explanation { color: #6b7280; font-size: 14px; }
        .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .metric-card { background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; }
        .metric-name { font-weight: 600; color: #1f2937; margin-bottom: 5px; }
        .metric-value { font-size: 18px; font-weight: 700; color: #2563eb; }
        .metric-target { font-size: 12px; color: #6b7280; margin-top: 3px; }
        .drill-section { background: #f0fdf4; padding: 20px; border-radius: 12px; border-left: 4px solid #16a34a; }
        .drill-title { font-weight: 600; color: #166534; margin-bottom: 8px; }
        .drill-instructions { color: #15803d; }
        .encouragement { background: #fef3c7; padding: 15px; border-radius: 8px; font-style: italic; color: #92400e; text-align: center; margin-top: 20px; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
        @media (max-width: 600px) {
          .metrics-grid { grid-template-columns: 1fr; }
          .container { margin: 10px; }
          body { padding: 10px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏟️ Swing Analysis Report</h1>
          <p>${swingData.date}</p>
          <div class="score-badge">Score: ${swingData.score}/100</div>
        </div>
        
        <div class="content">
          ${fromName ? `<p><strong>Shared by:</strong> ${fromName}</p>` : ''}
          ${message ? `<div class="section"><h2>💬 Personal Message</h2><p style="background: #f8fafc; padding: 15px; border-radius: 8px; font-style: italic;">"${message}"</p></div>` : ''}
          
          ${swingData.coachingFeedback ? `
          <div class="section">
            <h2>🎯 Coach Feedback</h2>
            <div class="coaching-section">
              ${swingData.coachingFeedback.cues.map((cue, index) => `
                <div class="cue">
                  <div class="cue-title">${cue}</div>
                  <div class="cue-explanation">${swingData.coachingFeedback!.explanations[index]}</div>
                </div>
              `).join('')}
              
              ${swingData.coachingFeedback.encouragement ? `
                <div class="encouragement">
                  ${swingData.coachingFeedback.encouragement}
                </div>
              ` : ''}
            </div>
          </div>
          ` : ''}
          
          ${swingData.drill ? `
          <div class="section">
            <h2>🏃 Recommended Drill</h2>
            <div class="drill-section">
              <div class="drill-title">${swingData.drill.name}</div>
              <div class="drill-instructions">${swingData.drill.instructions}</div>
            </div>
          </div>
          ` : ''}
          
          <div class="section">
            <h2>📊 Swing Metrics</h2>
            <div class="metrics-grid">
              ${swingData.metrics.map(metric => `
                <div class="metric-card">
                  <div class="metric-name">${metric.name}</div>
                  <div class="metric-value">${metric.value.toFixed(1)} ${metric.unit}</div>
                  <div class="metric-target">Target: ${metric.target}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p>This swing analysis was generated by SwingSense AI</p>
          <p style="margin-top: 10px; font-size: 12px;">Keep swinging and keep improving! 🚀</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: SwingAnalysisRequest = await req.json();
    console.log('Sending swing analysis to:', requestData.toEmail);

    const fromName = requestData.fromName || 'SwingSense User';
    const htmlContent = formatSwingAnalysisEmail(requestData);

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "SwingSense <analysis@resend.dev>",
        to: [requestData.toEmail],
        subject: `🏟️ ${fromName}'s Swing Analysis Report - Score: ${requestData.swingData.score}/100`,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      throw new Error(`Resend API error: ${emailResponse.status} - ${errorData}`);
    }

    const responseData = await emailResponse.json();

    console.log("Swing analysis email sent successfully:", responseData);

    return new Response(JSON.stringify({ success: true, emailId: responseData.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-swing-analysis function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Failed to send swing analysis email"
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);