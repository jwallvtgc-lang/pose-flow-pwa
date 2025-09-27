import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SwingSMSRequest {
  toPhoneNumber: string;
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
    const { toPhoneNumber, fromName, swingData, message }: SwingSMSRequest = await req.json();

    // Validate phone number format (basic validation)
    if (!toPhoneNumber || !/^\+?[1-9]\d{1,14}$/.test(toPhoneNumber.replace(/[\s\-\(\)]/g, ''))) {
      throw new Error("Invalid phone number format");
    }

    const getScoreLabel = (score: number) => {
      if (score >= 80) return 'Excellent';
      if (score >= 60) return 'Good';
      return 'Needs Work';
    };

    const scoreLabel = getScoreLabel(swingData.score);

    // Create a concise SMS message
    const topMetrics = swingData.metrics.slice(0, 3);
    const topCues = swingData.cues.slice(0, 2);
    
    let smsMessage = `🏏 Swing Analysis from ${fromName || 'teammate'}\n\n`;
    smsMessage += `Score: ${swingData.score}/100 (${scoreLabel})\n`;
    smsMessage += `Date: ${swingData.date}\n\n`;
    
    if (topCues.length > 0) {
      smsMessage += `Focus Areas:\n`;
      topCues.forEach((cue, index) => {
        smsMessage += `• ${cue}\n`;
      });
      smsMessage += `\n`;
    }
    
    if (topMetrics.length > 0) {
      smsMessage += `Key Metrics:\n`;
      topMetrics.forEach((metric) => {
        smsMessage += `• ${metric.name}: ${metric.value.toFixed(1)} ${metric.unit}\n`;
      });
      smsMessage += `\n`;
    }

    if (swingData.drill) {
      smsMessage += `Recommended Drill: ${swingData.drill.name}\n\n`;
    }

    if (message) {
      smsMessage += `Personal note: "${message}"\n\n`;
    }

    smsMessage += `Keep swinging! 🥎`;

    // Format phone number for Twilio (ensure it starts with +)
    let formattedPhoneNumber = toPhoneNumber.replace(/[\s\-\(\)]/g, '');
    if (!formattedPhoneNumber.startsWith('+')) {
      // Assume US number if no country code
      formattedPhoneNumber = '+1' + formattedPhoneNumber;
    }

    // Send SMS using Twilio
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromPhoneNumber) {
      throw new Error('Missing Twilio configuration');
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: formattedPhoneNumber,
        From: fromPhoneNumber,
        Body: smsMessage,
      }),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio error:', twilioData);
      throw new Error(`Twilio error: ${twilioData.message || 'Failed to send SMS'}`);
    }

    console.log('SMS sent successfully:', twilioData.sid);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "SMS sent successfully!",
      messageSid: twilioData.sid
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