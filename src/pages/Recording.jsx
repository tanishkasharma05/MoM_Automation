import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useSupabaseAuth } from '@/lib/SupabaseAuthContext';
import { uploadAudioToStorage, createMeeting, updateMeeting } from '@/lib/meetings';
import { createActionItems } from '@/lib/actionItems';
import { transcribeAudio, generateMoM } from '@/lib/openai';
import { preloadFFmpeg } from '@/lib/audioChunk';
import { Mic, MicOff, Square, Loader2, CheckCircle } from 'lucide-react';

const GROQ_SIZE_LIMIT = 24 * 1024 * 1024; // keep in sync with lib/openai.js

export default function Recording() {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');
  const [done, setDone] = useState(false);
  const [meetingId, setMeetingId] = useState(null);
  const [error, setError] = useState('');

  const startRecording = async () => {
    setError('');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    mediaRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = e => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      setAudioBlob(blob);
      stream.getTracks().forEach(t => t.stop());
      // Start loading the FFmpeg engine now (in the background) if this
      // recording will need splitting, so it's ready by the time the user
      // finishes typing the title/department instead of blocking then.
      if (blob.size > GROQ_SIZE_LIMIT) preloadFFmpeg();
    };

    recorder.start();
    setIsRecording(true);
    setDuration(0);
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const processRecording = async () => {
    if (!audioBlob || !title) return;
    setProcessing(true); setError('');
    try {
      // Package the recorded audio exactly like an uploaded file, and run it
      // through the same Groq Whisper pipeline the Upload flow uses — this
      // is far more accurate and reliable than in-browser live transcription.
      const file = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });

      setProcessStatus('Uploading recording...');
      const audioUrl = await uploadAudioToStorage(file, user.id, setProcessStatus);

      setProcessStatus('Creating meeting...');
      const meeting = await createMeeting({
        user_id: user.id, title, department,
        audio_url: audioUrl, status: 'processing',
        duration_seconds: duration,
      });
      setMeetingId(meeting.id);

      setProcessStatus('Transcribing audio...');
      const transcript = await transcribeAudio(file, setProcessStatus);

      setProcessStatus('Generating MoM with AI...');
      const momContent = await generateMoM(transcript, title, department);

      setProcessStatus('Saving...');
      await updateMeeting(meeting.id, { transcript, mom_content: momContent, status: 'completed', confidence: 96 });

      if (momContent.action_items?.length) {
        await createActionItems(meeting.id, user.id, momContent.action_items);
      }

      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <AppLayout title="Live Recording">
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Live Meeting Recording</h1>
          <p className="text-gray-400 text-sm mt-1">Record your meeting and generate AI minutes instantly</p>
        </div>

        {done ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center space-y-5 shadow-xl shadow-black/20">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-500/10 ring-1 ring-green-500/30 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h2 className="text-white text-xl font-bold">MoM Generated!</h2>
              <p className="text-gray-400 text-sm mt-1">Your recording has been processed.</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setDone(false); setAudioBlob(null); setDuration(0); setTitle(''); }}
                className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all">New Recording</button>
              {meetingId && (
                <button onClick={() => navigate(`/meetings/${meetingId}`)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all">View MoM</button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Recorder */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-6 shadow-xl shadow-black/20">
              <div className={`w-28 h-28 mx-auto rounded-full flex items-center justify-center transition-all ${
                isRecording ? 'bg-red-500/15 ring-4 ring-red-500/20 animate-pulse' : 'bg-gray-800 ring-1 ring-gray-700'
              }`}>
                {isRecording ? <Mic className="w-12 h-12 text-red-400" /> : <MicOff className="w-12 h-12 text-gray-500" />}
              </div>
              <div>
                <p className="text-white text-4xl font-mono font-bold tracking-tight tabular-nums">{formatTime(duration)}</p>
                <p className="text-gray-500 text-sm mt-1">{isRecording ? 'Recording...' : audioBlob ? 'Recording complete' : 'Ready to record'}</p>
              </div>
              <div className="flex gap-3 justify-center">
                {!isRecording && !audioBlob && (
                  <button onClick={startRecording} className="bg-red-600 hover:bg-red-500 text-white font-semibold px-8 py-3 rounded-xl shadow-lg shadow-red-600/30 transition-all flex items-center gap-2">
                    <Mic className="w-4 h-4" /> Start Recording
                  </button>
                )}
                {isRecording && (
                  <button onClick={stopRecording} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-8 py-3 rounded-xl transition-all flex items-center gap-2">
                    <Square className="w-4 h-4" /> Stop
                  </button>
                )}
                {audioBlob && !isRecording && (
                  <button onClick={() => { setAudioBlob(null); setDuration(0); }}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-3 rounded-xl transition-all text-sm font-medium">Discard</button>
                )}
              </div>
            </div>

            {/* Details + Process */}
            {audioBlob && !processing && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl shadow-black/20">
                <h3 className="text-white font-semibold">Meeting Details</h3>
                {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>}
                <div>
                  <label className="text-gray-400 text-sm mb-1.5 block font-medium">Title *</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Meeting title"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all" />
                </div>
                <div>
                  <label className="text-gray-400 text-sm mb-1.5 block font-medium">Department</label>
                  <select value={department} onChange={e => setDepartment(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all">
                    <option value="">Select Department</option>
                    {['Sales', 'HR', 'Marketing', 'Finance', 'Development', 'Operations', 'Management'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <button onClick={processRecording} disabled={!title}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-600/30 transition-all">
                  Generate AI MoM
                </button>
              </div>
            )}

            {processing && (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center space-y-4 shadow-xl shadow-black/20">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto" />
                <p className="text-white font-semibold">Processing...</p>
                <p className="text-blue-400 text-sm">{processStatus}</p>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
