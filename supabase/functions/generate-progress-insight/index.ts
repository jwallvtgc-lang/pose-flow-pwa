import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetricTrend {
  name: string;
  recentAvg: number;
  olderAvg: number;
  trend: 'improving' | 'declining' | 'stable';
  unit: string;
}

interface ProgressInsightRequest {
  recentScores: number[];
  metricTrends: MetricTrend[];
  totalSwings: number;
  timeframe: 'week' | 'month' | 'all';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recentScores, metricTrends, totalSwings, timeframe }: ProgressInsightRequest = await req.json();

    console.log('Generating progress insight for:', { recentScores, metricTrends, totalSwings, timeframe });

    const improvingMetrics = metricTrends.filter(m => m.trend === 'improving');
    const decliningMetrics = metricTrends.filter(m => m.trend === 'declining');
    
    const scoreImprovement = recentScores.length >= 2 
      ? recentScores[0] - recentScores[recentScores.length - 1]
      : 0;

    const systemPrompt = `You are an upbeat baseball swing coach analyzing a player's progress. Your insights should be:
- Conversational and encouraging (like texting a teammate)
- Data-driven but not overwhelming
- Focused on 1-2 key observations
- Maximum 2 sentences
- Use emojis sparingly (max 1)
- Specific about what's changing (not generic)`;

    const userPrompt = `Analyze this swing progress and give ONE specific, actionable insight:

SCORE TREND:
Recent scores: ${recentScores.join(', ')}
Change: ${scoreImprovement > 0 ? '+' : ''}${scoreImprovement} points

IMPROVING METRICS (${improvingMetrics.length}):
${improvingMetrics.map(m => `• ${m.name}: ${m.olderAvg.toFixed(1)} → ${m.recentAvg.toFixed(1)}${m.unit}`).join('\n') || 'None'}

NEEDS WORK (${decliningMetrics.length}):
${decliningMetrics.map(m => `• ${m.name}: ${m.olderAvg.toFixed(1)} → ${m.recentAvg.toFixed(1)}${m.unit}`).join('\n') || 'None'}

CONTEXT:
Total swings: ${totalSwings}
Timeframe: ${timeframe}

Give ONE concise, specific insight (max 2 sentences). Focus on the most impactful trend.`;

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
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const insight = data.choices[0].message.content;

    console.log('Generated insight:', insight);

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating progress insight:', error);
    
    // Fallback insight
    return new Response(JSON.stringify({
      insight: "Keep up the consistent work! Every swing is building muscle memory."
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
