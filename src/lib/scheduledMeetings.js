import { supabase } from './supabase';

export async function createScheduledMeeting(userId, { title, scheduledAt, attendees, notes }) {
  const { data, error } = await supabase
    .from('scheduled_meetings')
    .insert([{ user_id: userId, title, scheduled_at: scheduledAt, attendees, notes }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Upcoming = not yet happened, soonest first.
export async function getUpcomingMeetings(userId, limit = 10) {
  const { data, error } = await supabase
    .from('scheduled_meetings')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function updateScheduledMeeting(id, { title, scheduledAt, attendees, notes }) {
  const { data, error } = await supabase
    .from('scheduled_meetings')
    .update({ title, scheduled_at: scheduledAt, attendees, notes })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteScheduledMeeting(id) {
  const { error } = await supabase.from('scheduled_meetings').delete().eq('id', id);
  if (error) throw error;
}
