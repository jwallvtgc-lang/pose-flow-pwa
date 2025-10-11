import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SwingMetric {
  name: string;
  value: number;
  target: [number, number];
  unit: string;
  percentileRank: number; // How this compares to target (0-100)
}

interface CoachingRequest {
  metrics: SwingMetric[];
  playerLevel: string; // 'youth', 'high_school', 'college', 'pro'
  previousScore?: number;
  sessionNumber?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { metrics, playerLevel = 'youth', previousScore, sessionNumber }: CoachingRequest = await req.json();

    console.log('Generating coaching for metrics:', metrics);

    // Find the 2 weakest metrics
    const weakestMetrics = metrics
      .sort((a, b) => a.percentileRank - b.percentileRank)
      .slice(0, 2);

          const systemPrompt = `You are a cool baseball swing coach providing feedback to teen athletes (13-16 years old). Be relatable, upbeat, and straight to the point.

Style Guidelines:
- Talk like you're texting a friend - casual but knowledgeable
- Keep everything SHORT - no lengthy explanations
- Use bullets wherever possible to break things down
- Be encouraging and hype them up
- Focus on the 2 most impactful improvements
- No fluff - get straight to what matters`;

    const userPrompt = `Analyze this swing data and give feedback on the 2 biggest areas to improve.

WEAKEST METRICS:
${weakestMetrics.map(m => 
  `• ${m.name}: ${m.value}${m.unit} (target: ${m.target[0]}-${m.target[1]}${m.unit})`
).join('\n')}

ALL METRICS:
${metrics.map(m => 
  `• ${m.name}: ${m.value}${m.unit} (${m.percentileRank}th percentile)`
).join('\n')}

Return JSON with this structure:
{
  "cues": ["Short drill instruction 1 (one sentence)", "Short drill instruction 2 (one sentence)"],
  "explanations": ["Why this matters + how to fix it with bullets (2-3 bullet points max)", "Why this matters + how to fix it with bullets (2-3 bullet points max)"],
  "encouragement": "Quick hype message (1-2 sentences max)",
  "focusAreas": ["metric_name_1", "metric_name_2"],
  "reasoning": "Why these 2 areas (1 sentence)"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Temporarily switch back to test
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const coachingData = JSON.parse(data.choices[0].message.content);

    console.log('Generated coaching:', coachingData);

    // Validate the response structure
    if (!coachingData.cues || !Array.isArray(coachingData.cues) || coachingData.cues.length === 0) {
      console.error('Invalid coaching response structure:', coachingData);
      throw new Error('Invalid coaching response format');
    }

    return new Response(JSON.stringify(coachingData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating coaching:', error);
    
    // Fallback to basic coaching if AI fails
    const fallbackCues = [
      "Stay balanced through contact",
      "Keep your eye on the ball"
    ];
    
    return new Response(JSON.stringify({
      cues: fallbackCues,
      explanations: [
        "Balance = power and control\n• Transfer weight from back foot to front\n• Keep your head steady\n• Core stays engaged throughout",
        "Better tracking = better contact\n• Watch the ball from pitcher's hand to bat\n• See the ball hit the bat\n• Focus during BP to build this habit"
      ],
      encouragement: "You're tracking your data - that's what the pros do! Keep grinding and you'll see results.",
      focusAreas: ["balance", "tracking"]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});