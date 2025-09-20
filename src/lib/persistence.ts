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
  console.log('Current user auth state:', { 
    user: (await supabase.auth.getUser()).data.user?.id,
    session: (await supabase.auth.getSession()).data.session !== null 
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
      console.error('Session creation error:', error);
      throw error;
    }
    
    console.log('Session created successfully:', data);
    return data.id;
  } catch (error) {
    console.error('Session creation failed:', error);
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
  client_request_id
}: {
  session_id: string;
  score: number;
  cards: CoachingCard[];
  videoUrl?: string | null;
  client_request_id: string;
}): Promise<string> {
  try {
    console.log('=== SAVE SWING DEBUG ===');
    console.log('Payload:', {
      session_id,
      score_phase1: score,
      cues: cards.map(c => c.cue),
      drill_id: (cards[0]?.drill && typeof cards[0].drill === 'object' && 'id' in cards[0].drill) ? cards[0].drill.id : null,
      video_url: videoUrl,
      client_request_id
    });
    
    // Try to insert, if conflict on client_request_id, fetch existing
    const { data, error } = await supabase
      .from('swings')
      .insert({
        session_id,
        score_phase1: score,
        cues: cards.map(c => c.cue),
        drill_id: (cards[0]?.drill && typeof cards[0].drill === 'object' && 'id' in cards[0].drill) ? cards[0].drill.id : null,
        video_url: videoUrl,
        client_request_id
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