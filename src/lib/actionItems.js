import { supabase } from './supabase';

// Bulk-insert the structured action items produced by generateMoM() for a
// given meeting. Silently normalizes legacy/loose shapes (plain strings)
// so older AI responses don't crash this.
export async function createActionItems(meetingId, userId, items) {
  if (!items?.length) return [];

  const rows = items.map((item) => {
    if (typeof item === 'string') {
      return { meeting_id: meetingId, user_id: userId, text: item, assignee: 'Unassigned', due_date: '' };
    }
    return {
      meeting_id: meetingId,
      user_id: userId,
      text: item.text || JSON.stringify(item),
      assignee: item.assignee || 'Unassigned',
      due_date: item.due_date || '',
    };
  });

  const { data, error } = await supabase.from('action_items').insert(rows).select();
  if (error) throw error;
  return data;
}

// Most recent action items across all of the user's meetings, newest first.
// Joins in the parent meeting's title so the panel can show which meeting
// each item came from.
export async function getRecentActionItems(userId, limit = 10) {
  const { data, error } = await supabase
    .from('action_items')
    .select('*, meetings(title)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function setActionItemStatus(id, status) {
  const { data, error } = await supabase
    .from('action_items')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
