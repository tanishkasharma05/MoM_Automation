import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useSupabaseAuth } from '@/lib/SupabaseAuthContext';
import { getMeetings, updateMeeting } from '@/lib/meetings';
import { transcribeAudio, generateMoM } from '@/lib/openai';
import { supabase } from '@/lib/supabase';
import { Bot, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function Processing() {
  const { user } = useSupabaseAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState({});

  const load = async () => {
    if (!user) return;
    const data = await getMeetings(user.id);
    setMeetings(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const reprocess = async (meeting) => {
    if (!meeting.audio_url) return;
    setReprocessing(p => ({ ...p, [meeting.id]: true }));
    try {
      await updateMeeting(meeting.id, { status: 'processing' });
      const resp = await fetch(meeting.audio_url);
      const blob = await resp.blob();
      const file = new File([blob], 'audio.webm', { type: blob.type });
      const transcript = await transcribeAudio(file);
      const momContent = await generateMoM(transcript, meeting.title, meeting.department);
      await updateMeeting(meeting.id, { transcript, mom_content: momContent, status: 'completed', confidence: 96 });
      load();
    } catch (e) {
      await updateMeeting(meeting.id, { status: 'failed' });
      load();
    } finally {
      setReprocessing(p => ({ ...p, [meeting.id]: false }));
    }
  };

  const statusIcon = (status) => {
    if (status === 'completed') return <CheckCircle className="w-5 h-5 text-green-400" />;
    if (status === 'processing') return <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />;
    if (status === 'failed') return <AlertCircle className="w-5 h-5 text-red-400" />;
    return <Bot className="w-5 h-5 text-gray-400" />;
  };

  return (
    <AppLayout title="AI Processing">
      <div className="space-y-6">
        <div>
          <h1 className="text-white text-xl font-bold">AI Processing Queue</h1>
          <p className="text-gray-400 text-sm">Monitor and reprocess meeting transcriptions</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          {loading ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No meetings found. Upload audio to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map(m => (
                <div key={m.id} className="flex items-center gap-4 p-4 bg-gray-800 rounded-xl">
                  <div className="flex-shrink-0">{statusIcon(m.status)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{m.title}</p>
                    <p className="text-gray-500 text-xs">{m.department || 'No department'} · {new Date(m.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                    m.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                    m.status === 'processing' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
                    m.status === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                    'bg-gray-500/10 text-gray-400 border-gray-500/30'
                  }`}>
                    {m.status}
                  </span>
                  {(m.status === 'failed' || m.status === 'pending') && m.audio_url && (
                    <button
                      onClick={() => reprocess(m)}
                      disabled={reprocessing[m.id]}
                      className="flex items-center gap-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium px-3 py-2 rounded-lg transition-all disabled:opacity-50"
                    >
                      {reprocessing[m.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Reprocess
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}