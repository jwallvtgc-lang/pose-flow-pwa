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

          const systemPrompt = `You are an expert baseball swing coach providing personalized feedback to teenage athletes (ages 12-18). 

Guidelines:
- Focus on the 2 weakest areas that need most improvement
- Provide conversational, encouraging coaching advice as if speaking directly to the athlete
- Use language appropriate for teens - friendly but not condescending
- Each explanation should be 3-4 sentences with specific actionable advice
- Include WHY each area matters for hitting performance
- Be encouraging and motivational while being honest about areas needing work
- Make it feel like a real coach talking to them personally`;

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
  "explanations": ["Conversational coaching explanation 1 (3-4 sentences)", "Conversational coaching explanation 2 (3-4 sentences)"],
  "encouragement": "Personal, motivational message about their swing and progress (2-3 sentences)",
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
        "Hey, balance is super important for consistent hitting! When you stay balanced through your swing, you're able to make solid contact every time and transfer your weight properly from your back foot to your front foot. This gives you way more power and control over where the ball goes. Work on keeping your head steady and your core engaged throughout the entire swing.",
        "Visual tracking is one of the most crucial skills for any hitter. The better you can track the ball from the pitcher's hand all the way to your bat, the better your timing and barrel accuracy will be. Try to see the ball hit your bat - this helps with both contact quality and gives you more confidence in the box. Practice watching the ball during batting practice and really focus on seeing it clearly."
      ],
      encouragement: "You're putting in great work by tracking your swing data! Every swing is a chance to get better, and the fact that you're analyzing your mechanics shows you're serious about improving. Keep working on these fundamentals and you'll see real progress.",
      focusAreas: ["balance", "tracking"]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});