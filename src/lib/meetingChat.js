import { supabase } from './supabase';

// Meeting Chat — per-meeting discussion thread, separate from the AI
// transcript. Requires a `meeting_chat_messages` table:
//   id uuid pk default gen_random_uuid()
//   meeting_id uuid references meetings(id) on delete cascade
//   user_id uuid references auth.users(id)
//   author_name text
//   message text not null
//   created_at timestamptz default now()
// If the table doesn't exist yet in your Supabase project, these calls
// will fail gracefully and the Chat tab will show a friendly empty state.

export async function getChatMessages(meetingId) {
  const { data, error } = await supabase
    .from('meeting_chat_messages')
    .select('*')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function sendChatMessage(meetingId, userId, authorName, message) {
  const { data, error } = await supabase
    .from('meeting_chat_messages')
    .insert([{ meeting_id: meetingId, user_id: userId, author_name: authorName, message }])
    .select()
    .single();
  if (error) throw error;
  return data;
}
