import { supabase } from './supabase';

export async function getTeamMembers() {
  const { data, error } = await supabase.from('team_members').select('*').order('email');
  if (error) throw error;
  return data;
}

export async function updateTeamMemberRole(id, role) {
  const { data, error } = await supabase
    .from('team_members')
    .update({ role })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeTeamMember(id) {
  const { error } = await supabase.from('team_members').delete().eq('id', id);
  if (error) throw error;
}
