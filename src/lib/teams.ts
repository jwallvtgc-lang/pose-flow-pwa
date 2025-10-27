import type { SupabaseClient } from '@supabase/supabase-js';

export async function createTeam(
  supabase: SupabaseClient,
  teamName: string,
  currentUserId: string
) {
  function generateInviteCode() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  console.log('createTeam called with:', { teamName, currentUserId });

  // Force refresh the session to ensure JWT token is fresh
  const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
  
  if (sessionError || !session) {
    console.error('Failed to refresh session', sessionError);
    return { error: new Error('Session error - please try logging out and back in') };
  }

  console.log('Refreshed session user ID:', session.user.id);
  console.log('Passed user ID:', currentUserId);
  
  if (session.user.id !== currentUserId) {
    console.error('User ID mismatch!');
    return { error: new Error('Authentication error - please try logging in again') };
  }

  const teamData = {
    name: teamName,
    coach_id: session.user.id,
    invite_code: generateInviteCode()
  };

  console.log('Attempting to insert team with data:', teamData);

  // 1. insert the team row with coach_id and invite_code
  const { data: teamInsert, error: teamError } = await supabase
    .from('teams')
    .insert([teamData])
    .select('id')
    .single();

  if (teamError || !teamInsert?.id) {
    console.error('teams insert failed', teamError);
    return { error: teamError || new Error('No team id returned from insert') };
  }

  const teamId = teamInsert.id;
  console.log('team created with id:', teamId);

  // 2. add the creator to team_members as coach
  const { error: memberError } = await supabase
    .from('team_members')
    .insert([{
      team_id: teamId,
      user_id: session.user.id,
      role: 'coach'
    }]);

  if (memberError) {
    console.error('team_members insert failed', memberError);
    // still return teamId so UI can continue
    return { teamId, error: memberError };
  }

  console.log('team member added successfully');
  return { teamId };
}
