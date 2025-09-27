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
    console.log('=== SMS SENDING STARTED ===');
    console.log('Request method:', req.method);
    
    const requestBody = await req.json();
    console.log('Request body received:', JSON.stringify(requestBody, null, 2));
    
    const { toPhoneNumber, fromName, swingData, message }: SwingSMSRequest = requestBody;

    // Validate phone number format (basic validation)
    if (!toPhoneNumber || !/^\+?[1-9]\d{1,14}$/.test(toPhoneNumber.replace(/[\s\-\(\)]/g, ''))) {
      console.log('Invalid phone number:', toPhoneNumber);
      throw new Error("Invalid phone number format");
    }

    console.log('Phone number validation passed:', toPhoneNumber);

    const getScoreLabel = (score: number) => {
      if (score >= 80) return 'Excellent';
      if (score >= 60) return 'Good';
      return 'Needs Work';
    };

    const scoreLabel = getScoreLabel(swingData.score);
    console.log('Score label:', scoreLabel);

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

    console.log('SMS message created, length:', smsMessage.length);

    // Format phone number for Twilio (ensure it starts with +)
    let formattedPhoneNumber = toPhoneNumber.replace(/[\s\-\(\)]/g, '');
    if (!formattedPhoneNumber.startsWith('+')) {
      // Assume US number if no country code
      formattedPhoneNumber = '+1' + formattedPhoneNumber;
    }

    console.log('Formatted phone number:', formattedPhoneNumber);

    // Check Twilio credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    console.log('Twilio credentials check:', {
      accountSid: !!accountSid,
      authToken: !!authToken,
      fromPhoneNumber: !!fromPhoneNumber,
      accountSidLength: accountSid?.length || 0,
      authTokenLength: authToken?.length || 0
    });

    if (!accountSid || !authToken || !fromPhoneNumber) {
      const missingCreds = [];
      if (!accountSid) missingCreds.push('TWILIO_ACCOUNT_SID');
      if (!authToken) missingCreds.push('TWILIO_AUTH_TOKEN');
      if (!fromPhoneNumber) missingCreds.push('TWILIO_PHONE_NUMBER');
      
      console.error('Missing Twilio credentials:', missingCreds);
      throw new Error(`Missing Twilio configuration: ${missingCreds.join(', ')}`);
    }

    console.log('Making Twilio API request...');
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    const twilioRequestBody = new URLSearchParams({
      To: formattedPhoneNumber,
      From: fromPhoneNumber,
      Body: smsMessage,
    });

    console.log('Twilio request details:', {
      url: twilioUrl,
      to: formattedPhoneNumber,
      from: fromPhoneNumber,
      bodyLength: smsMessage.length
    });

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: twilioRequestBody,
    });

    console.log('Twilio response status:', twilioResponse.status);
    console.log('Twilio response headers:', Object.fromEntries(twilioResponse.headers));

    const twilioData = await twilioResponse.json();
    console.log('Twilio response data:', JSON.stringify(twilioData, null, 2));

    if (!twilioResponse.ok) {
      console.error('Twilio error response:', twilioData);
      throw new Error(`Twilio error (${twilioResponse.status}): ${twilioData.message || JSON.stringify(twilioData)}`);
    }

    console.log('SMS sent successfully with SID:', twilioData.sid);

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
    console.error("=== SMS SENDING ERROR ===");
    console.error("Error type:", error.constructor?.name || 'Unknown');
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send SMS',
        details: error.constructor?.name || 'Unknown error type'
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);