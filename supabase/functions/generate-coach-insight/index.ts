import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const firstName = profile?.full_name?.split(' ')[0] || 'Player';

    // Fetch recent swings (last 10)
    const { data: recentSwings, error: swingsError } = await supabase
      .from('swings')
      .select('id, created_at, score_phase1, bat_speed_peak, bat_speed_avg, cues, pose_data')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (swingsError) {
      console.error('Error fetching swings:', swingsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch swing data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!recentSwings || recentSwings.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No swing data available',
        fallback: true 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Analyze swing data
    const scores = recentSwings.filter(s => s.score_phase1).map(s => s.score_phase1);
    const batSpeeds = recentSwings.filter(s => s.bat_speed_peak).map(s => s.bat_speed_peak);
    
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const avgBatSpeed = batSpeeds.length > 0 ? batSpeeds.reduce((a, b) => a + b, 0) / batSpeeds.length : 0;
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const bestBatSpeed = batSpeeds.length > 0 ? Math.max(...batSpeeds) : 0;

    // Calculate trend (comparing first half vs second half)
    const half = Math.floor(scores.length / 2);
    const recentScores = scores.slice(0, half);
    const olderScores = scores.slice(half);
    const recentAvg = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : avgScore;
    const olderAvg = olderScores.length > 0 ? olderScores.reduce((a, b) => a + b, 0) / olderScores.length : avgScore;
    const improvement = recentAvg - olderAvg;

    // Analyze cues from recent swings
    const allCues: string[] = [];
    recentSwings.forEach(swing => {
      if (swing.cues && Array.isArray(swing.cues)) {
        swing.cues.forEach((cue: any) => {
          if (cue.text) allCues.push(cue.text);
        });
      }
    });

    // Build analysis context
    const analysisContext = `
Analyze this baseball player's recent swing data and provide personalized coaching feedback:

Player: ${firstName}
Total Swings Analyzed: ${recentSwings.length}
Average Score: ${avgScore.toFixed(1)}
Best Score: ${bestScore}
Average Bat Speed: ${avgBatSpeed.toFixed(1)} mph
Peak Bat Speed: ${bestBatSpeed.toFixed(1)} mph
Trend: ${improvement > 0 ? 'Improving' : improvement < 0 ? 'Declining' : 'Stable'} (${improvement > 0 ? '+' : ''}${improvement.toFixed(1)} points)

Recent Coaching Cues Received:
${allCues.slice(0, 10).join(', ') || 'None'}

Provide three specific pieces of feedback:
1. What ${firstName} is doing well (praise) - be specific about metrics
2. The main area that needs improvement (issue) - identify the biggest weakness
3. One specific drill or action to do today (action) - concrete and actionable
`;

    console.log('Calling OpenAI with context:', analysisContext);

    // Call OpenAI with structured output
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert baseball hitting coach analyzing swing data. Provide specific, actionable feedback based on the metrics. Be encouraging but honest about areas needing work.' 
          },
          { role: 'user', content: analysisContext }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'provide_coaching_insight',
              description: 'Provide structured coaching feedback based on swing analysis',
              parameters: {
                type: 'object',
                properties: {
                  praise: {
                    type: 'string',
                    description: 'What the player is doing well, with specific metrics (30-60 words)'
                  },
                  issue: {
                    type: 'string',
                    description: 'The main area needing improvement, with specifics (30-60 words)'
                  },
                  action: {
                    type: 'string',
                    description: 'One specific drill or action to do today (20-40 words)'
                  }
                },
                required: ['praise', 'issue', 'action'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'provide_coaching_insight' } },
        max_completion_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to generate insight' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('OpenAI response:', JSON.stringify(data));

    const toolCall = data.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || !toolCall.function.arguments) {
      console.error('No tool call in response');
      return new Response(JSON.stringify({ error: 'Invalid AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const insight = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      praise: insight.praise,
      issue: insight.issue,
      action: insight.action,
      updated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-coach-insight function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
