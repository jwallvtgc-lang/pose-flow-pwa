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

  // 1. insert the team row with coach_id and invite_code
  const { data: teamInsert, error: teamError } = await supabase
    .from('teams')
    .insert([{
      name: teamName,
      coach_id: currentUserId,
      invite_code: generateInviteCode()
    }])
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
      user_id: currentUserId,
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
