import { supabase } from '@/integrations/supabase/client';
import { metricUnits } from './metrics';
import type { CoachingCard } from './cues';
import { offlineQueue } from './offlineQueue';

interface QueueJob {
  id: string;
  type: 'upload' | 'insert_session' | 'insert_swing' | 'insert_metrics';
  payload: any;
  client_request_id: string;
  retries: number;
  created_at: number;
}

function isNetworkError(error: any): boolean {
  return (
    !navigator.onLine ||
    error?.message?.includes('fetch') ||
    error?.code === 'NETWORK_ERROR' ||
    error?.status >= 500
  );
}

export async function ensureSession({
  session_id,
  athlete_id,
  fps,
  view = 'side'
}: {
  session_id?: string | null;
  athlete_id?: string | null;
  fps: number;
  view?: string;
}): Promise<string> {
  if (session_id) {
    console.log('Using existing session_id:', session_id);
    return session_id;
  }

  console.log('=== CREATE SESSION DEBUG ===');
  console.log('Creating new session with:', { athlete_id, fps, view });
  
  // Check auth state
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  
  console.log('Auth check results:', {
    userError: userError ? JSON.stringify(userError) : null,
    sessionError: sessionError ? JSON.stringify(sessionError) : null,
    hasUser: !!userData.user,
    hasSession: !!sessionData.session,
    userId: userData.user?.id
  });

  try {
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        athlete_id,
        camera_fps: fps,
        view,
        notes: `Swing analysis session ${new Date().toISOString()}`
      })
      .select()
      .single();

    if (error) {
      console.error('Session creation error details:', {
        message: error.message,
        code: error.code,
        hint: error.hint,
        details: error.details,
        fullError: JSON.stringify(error, null, 2)
      });
      throw error;
    }
    
    console.log('Session created successfully:', data);
    return data.id;
  } catch (error) {
    console.error('Session creation failed - detailed error:', {
      type: typeof error,
      message: error instanceof Error ? error.message : String(error),
      code: (error as any)?.code,
      hint: (error as any)?.hint,
      details: (error as any)?.details,
      stack: error instanceof Error ? error.stack : null,
      fullError: JSON.stringify(error, null, 2)
    });
    if (isNetworkError(error)) {
      await offlineQueue.enqueue({
        type: 'insert_session',
        payload: { athlete_id, fps, view },
        client_request_id: crypto.randomUUID()
      });
      throw new Error('Session creation queued for retry - network error');
    }
    throw error;
  }
}

export async function saveSwing({
  session_id,
  score,
  cards,
  videoUrl,
  client_request_id,
  keypointsData,
  batSpeedPeak,
  batSpeedAvg
}: {
  session_id: string;
  score: number;
  cards: CoachingCard[];
  videoUrl?: string | null;
  client_request_id: string;
  keypointsData?: any;
  batSpeedPeak?: number | null;
  batSpeedAvg?: number | null;
}): Promise<string> {
  try {
    console.log('=== SAVE SWING DEBUG ===');
    
    // Get current user for RLS
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User not authenticated:', userError);
      throw new Error('User must be authenticated to save swings');
    }
    
    // Handle drill information - either use drill_id or save drill_data
    const firstCard = cards[0];
    const drillId = (firstCard?.drill && typeof firstCard.drill === 'object' && 'id' in firstCard.drill) 
      ? firstCard.drill.id : null;
    const drillData = (!drillId && firstCard?.drill) ? {
      name: firstCard.drill.name,
      how_to: firstCard.drill.how_to,
      equipment: firstCard.drill.equipment
    } : null;
    
    console.log('Payload:', {
      session_id,
      user_id: user.id,
      score_phase1: score,
      cues: cards.map(c => c.cue),
      drill_id: drillId,
      drill_data: drillData,
      video_url: videoUrl,
      client_request_id,
      pose_data: keypointsData ? 'present' : 'none'
    });
    
    // Try to insert, if conflict on client_request_id, fetch existing
    const { data, error } = await supabase
      .from('swings')
      .insert({
        session_id,
        user_id: user.id,
        score_phase1: score,
        cues: cards.map(c => c.cue),
        drill_id: drillId,
        drill_data: drillData,
        video_url: videoUrl,
        client_request_id,
        pose_data: keypointsData,
        bat_speed_peak: batSpeedPeak,
        bat_speed_avg: batSpeedAvg
      })
      .select()
      .single();

    if (error) {
      console.error('Swing insert error:', error);
      // Check for unique constraint violation (idempotent behavior)
      if (error.code === '23505' && error.message.includes('client_request_id')) {
        console.log('Swing already exists, fetching existing...');
        // Fetch existing swing with this client_request_id
        const { data: existingData, error: fetchError } = await supabase
          .from('swings')
          .select('id')
          .eq('client_request_id', client_request_id)
          .single();

        if (fetchError) {
          console.error('Failed to fetch existing swing:', fetchError);
          throw fetchError;
        }
        console.log('Found existing swing:', existingData.id);
        return existingData.id;
      }
      throw error;
    }

    console.log('Swing insert successful:', data);
    return data.id;
  } catch (error) {
    if (isNetworkError(error)) {
      await offlineQueue.enqueue({
        type: 'insert_swing',
        payload: { session_id, score, cards, videoUrl, client_request_id },
        client_request_id
      });
      throw new Error('Swing save queued for retry - network error');
    }
    throw error;
  }
}

export async function saveMetrics({
  swing_id,
  values
}: {
  swing_id: string;
  values: Record<string, number>;
}): Promise<void> {
  console.log('=== SAVE METRICS DEBUG ===');
  console.log('swing_id:', swing_id);
  console.log('values:', values);
  
  const units = metricUnits();
  const metricsToInsert = Object.entries(values)
    .filter(([_, value]) => value !== null && !isNaN(value))
    .map(([metric, value]) => ({
      swing_id,
      metric,
      value,
      unit: units[metric] || '',
      phase: 1
    }));

  console.log('Metrics to insert:', metricsToInsert);

  if (metricsToInsert.length === 0) {
    console.log('No metrics to insert, returning');
    return;
  }

  try {
    const { error } = await supabase
      .from('swing_metrics')
      .insert(metricsToInsert);

    if (error) {
      console.error('Metrics insert error:', error);
      throw error;
    }
    
    console.log('Metrics inserted successfully');
  } catch (error) {
    console.error('Save metrics error:', error);
    if (isNetworkError(error)) {
      await offlineQueue.enqueue({
        type: 'insert_metrics',
        payload: { swing_id, values },
        client_request_id: crypto.randomUUID()
      });
      throw new Error('Metrics save queued for retry - network error');
    }
    throw error;
  }
}

// Retry function for offline queue processing
export async function retryJob(job: QueueJob): Promise<void> {
  switch (job.type) {
    case 'insert_session':
      const { athlete_id, fps, view } = job.payload;
      await ensureSession({ session_id: null, athlete_id, fps, view });
      break;
      
    case 'insert_swing':
      const swingPayload = job.payload;
      await saveSwing(swingPayload);
      break;
      
    case 'insert_metrics':
      const { swing_id, values } = job.payload;
      await saveMetrics({ swing_id, values });
      break;
      
    case 'upload':
      // Video upload retry would need the blob, which we can't easily store
      // For now, we'll just remove these from queue
      console.warn('Video upload retry not implemented - removing from queue');
      break;
      
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}