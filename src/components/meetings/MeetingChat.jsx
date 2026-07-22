import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { getChatMessages, sendChatMessage } from '@/lib/meetingChat';

export default function MeetingChat({ meetingId, user }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You';

  const load = () => {
    getChatMessages(meetingId)
      .then(setMessages)
      .catch(() => setUnavailable(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [meetingId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      const msg = await sendChatMessage(meetingId, user?.id, name, draft.trim());
      setMessages((prev) => [...prev, msg]);
      setDraft('');
    } catch (e) {
      setUnavailable(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 flex flex-col h-[420px]">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-indigo-400" />
        <h3 className="text-white font-heading font-semibold">Meeting Chat</h3>
      </div>

      {unavailable ? (
        <div className="flex-1 flex items-center justify-center text-center px-4">
          <p className="text-gray-500 text-sm">
            Meeting chat isn't set up yet — it needs a <code className="text-gray-400">meeting_chat_messages</code> table in Supabase.
          </p>
        </div>
      ) : loading ? (
        <div className="flex-1 space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No messages yet. Start the discussion.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                    {m.author_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">{m.author_name}</p>
                    <p className="text-sm text-gray-200">{m.message}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={handleSend} className="flex gap-2 mt-4 pt-4 border-t border-white/[0.06]">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message the team…"
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-2 rounded-xl transition-all"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
