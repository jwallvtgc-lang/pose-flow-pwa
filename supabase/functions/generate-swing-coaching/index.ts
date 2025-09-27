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

    const systemPrompt = `You are an expert baseball swing coach providing personalized feedback. 

Guidelines:
- Focus on the 2 weakest areas that need most improvement
- Provide specific, actionable coaching cues (1 short phrase each)
- Explain WHY each area matters for hitting performance  
- Keep language appropriate for ${playerLevel} level players
- Be encouraging but honest about areas needing work
- Each cue should be 4-8 words maximum
- Each explanation should be 1-2 sentences maximum`;

    const userPrompt = `Analyze this swing data and provide personalized coaching:

WEAKEST METRICS:
${weakestMetrics.map(m => 
  `• ${m.name}: ${m.value}${m.unit} (target: ${m.target[0]}-${m.target[1]}${m.unit}) - ${m.percentileRank}th percentile`
).join('\n')}

ALL METRICS CONTEXT:
${metrics.map(m => 
  `• ${m.name}: ${m.value}${m.unit} (${m.percentileRank}th percentile)`
).join('\n')}

${previousScore ? `Previous swing score: ${previousScore}` : ''}
${sessionNumber ? `Session #${sessionNumber}` : ''}

Return a JSON response with this exact structure:
{
  "cues": ["Short actionable cue 1", "Short actionable cue 2"],
  "explanations": ["Why this matters explanation 1", "Why this matters explanation 2"],
  "encouragement": "Brief encouraging message about their swing",
  "focusAreas": ["metric_name_1", "metric_name_2"]
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
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
        "Balance helps maintain consistent contact quality.",
        "Visual tracking improves timing and barrel accuracy."
      ],
      encouragement: "Keep working on your fundamentals!",
      focusAreas: ["general", "general"]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});