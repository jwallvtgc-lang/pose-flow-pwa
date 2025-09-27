import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SwingShareRequest {
  toEmail: string;
  fromName?: string;
  swingData: {
    id: string;
    score: number;
    date: string;
    metrics: Array<{ name: string; value: number; unit: string; target: string }>;
    cues: string[];
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
    const { toEmail, fromName, swingData, message }: SwingShareRequest = await req.json();

    const getScoreLabel = (score: number) => {
      if (score >= 80) return { label: 'Excellent', color: '#22c55e' };
      if (score >= 60) return { label: 'Good', color: '#eab308' };
      return { label: 'Needs Work', color: '#ef4444' };
    };

    const scoreInfo = getScoreLabel(swingData.score);

    const metricsHtml = swingData.metrics.map(metric => `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px; font-weight: 500;">${metric.name}</td>
        <td style="padding: 8px; text-align: right;">${metric.value.toFixed(1)} ${metric.unit}</td>
        <td style="padding: 8px; text-align: right; color: #6b7280; font-size: 12px;">${metric.target}</td>
      </tr>
    `).join('');

    const cuesHtml = swingData.cues.map(cue => `
      <li style="margin-bottom: 4px; color: #374151;">${cue}</li>
    `).join('');

    const drillHtml = swingData.drill ? `
      <div style="margin-top: 24px; padding: 16px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px;">Recommended Drill</h3>
        <h4 style="margin: 0 0 8px 0; font-weight: 600; color: #374151;">${swingData.drill.name}</h4>
        <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5;">${swingData.drill.instructions}</p>
      </div>
    ` : '';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Swing Analysis Results</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Swing Analysis Results</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.9;">Shared by ${fromName || 'A teammate'}</p>
            </div>

            <!-- Content -->
            <div style="padding: 24px;">
              
              <!-- Personal Message -->
              ${message ? `
                <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                  <p style="margin: 0; color: #92400e; font-style: italic;">"${message}"</p>
                </div>
              ` : ''}

              <!-- Score Section -->
              <div style="text-align: center; margin-bottom: 32px;">
                <div style="display: inline-block; background-color: ${scoreInfo.color}; color: white; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: bold; margin-bottom: 8px;">
                  ${swingData.score}
                </div>
                <div style="color: ${scoreInfo.color}; font-weight: 600; font-size: 18px;">${scoreInfo.label}</div>
                <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">${swingData.date}</div>
              </div>

              <!-- Focus Areas -->
              ${swingData.cues.length > 0 ? `
                <div style="margin-bottom: 32px;">
                  <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Focus Areas</h3>
                  <ul style="margin: 0; padding-left: 20px; color: #374151;">
                    ${cuesHtml}
                  </ul>
                </div>
              ` : ''}

              <!-- Metrics Table -->
              <div style="margin-bottom: 32px;">
                <h3 style="margin: 0 0 16px 0; color: #1f2937; font-size: 18px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Swing Metrics</h3>
                <table style="width: 100%; border-collapse: collapse; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #f9fafb;">
                      <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Metric</th>
                      <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Value</th>
                      <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${metricsHtml}
                  </tbody>
                </table>
              </div>

              <!-- Drill Recommendation -->
              ${drillHtml}

              <!-- Footer -->
              <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 14px;">
                <p style="margin: 0;">This analysis was generated by your swing analysis app.</p>
                <p style="margin: 8px 0 0 0;">Keep practicing and improving your swing!</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    // Since Resend is not available, we'll return a success response
    // In production, you would implement actual email sending
    console.log("Email would be sent to:", toEmail);
    console.log("Email content prepared successfully");

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Email functionality not configured. In production, this would send the email." 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-swing-details function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);