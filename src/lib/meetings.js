import { supabase } from './supabase';

export async function getMeetings(userId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getMeeting(id) {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createMeeting(meeting) {
  const { data, error } = await supabase
    .from('meetings')
    .insert([meeting])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMeeting(id, updates) {
  const { data, error } = await supabase
    .from('meetings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMeeting(id) {
  const { error } = await supabase.from('meetings').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadAudioToStorage(file, userId, onProgress) {
  // Audio goes to Google Drive (uploaded directly from the browser, so no
  // Supabase/edge-function size limit applies) — only the resulting link
  // is stored in Supabase alongside the meeting's transcript/MoM data.
  const { uploadAudioToGoogleDrive } = await import('./googleDrive');
  const { audioUrl } = await uploadAudioToGoogleDrive(file, onProgress);
  return audioUrl;
}

export async function getMeetingStats(userId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('status, duration_seconds')
    .eq('user_id', userId);
  if (error) throw error;

  const total = data.length;
  const completed = data.filter((m) => m.status === 'completed').length;
  const processing = data.filter((m) => m.status === 'processing').length;
  const totalMinutes = data.reduce((sum, m) => sum + (m.duration_seconds || 0), 0) / 60;

  return { total, completed, processing, totalMinutes: Math.round(totalMinutes) };
}

// Real meeting counts per day for the current week (Mon–Sun), for the
// Dashboard's Meeting Activity chart.
export async function getWeeklyActivity(userId) {
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const now = new Date();
  const dayIndex = (now.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - dayIndex);

  const { data, error } = await supabase
    .from('meetings')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', monday.toISOString());
  if (error) throw error;

  const counts = new Array(7).fill(0);
  data.forEach((m) => {
    const d = new Date(m.created_at);
    const idx = (d.getDay() + 6) % 7;
    counts[idx] += 1;
  });

  return DAY_LABELS.map((day, i) => ({ day, meetings: counts[i] }));
}