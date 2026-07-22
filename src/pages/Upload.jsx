import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { useSupabaseAuth } from '@/lib/SupabaseAuthContext';
import { uploadAudioToStorage, createMeeting, updateMeeting } from '@/lib/meetings';
import { createActionItems } from '@/lib/actionItems';
import { transcribeAudio, generateMoM } from '@/lib/openai';
import { preloadFFmpeg } from '@/lib/audioChunk';
import { CloudUpload, FileAudio, Trash2, Loader2, CheckCircle, ChevronRight } from 'lucide-react';

const GROQ_SIZE_LIMIT = 24 * 1024 * 1024; // keep in sync with lib/openai.js

const STEPS = ['Upload', 'Details', 'Processing', 'Done'];

export default function Upload() {
  const { user } = useSupabaseAuth();
  const navigate = useNavigate();
  const fileRef = useRef();
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendeesInput, setAttendeesInput] = useState('');
  const [agendaInput, setAgendaInput] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [meetingId, setMeetingId] = useState(null);
  const [error, setError] = useState('');

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setTitle(f.name.replace(/\.[^/.]+$/, ''));
    // Large files will need FFmpeg splitting during processing — start
    // loading the WASM engine now, in the background, so it's ready by
    // the time the user finishes the Details step instead of blocking then.
    if (f.size > GROQ_SIZE_LIMIT) preloadFFmpeg();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const processAudio = async () => {
    if (!file || !title) return;
    setError('');
    setStep(2);

    const attendees = attendeesInput.split(',').map((a) => a.trim()).filter(Boolean);
    const agenda = agendaInput.split('\n').map((a) => a.trim()).filter(Boolean);

    try {
      // Step 1: Upload audio
      setStatus('Uploading audio file...');
      setProgress(10);
      const audioUrl = await uploadAudioToStorage(file, user.id, setStatus);

      // Step 2: Create meeting record
      setStatus('Creating meeting record...');
      setProgress(25);
      const meeting = await createMeeting({
        user_id: user.id,
        title,
        department,
        meeting_date: meetingDate || null,
        attendees,
        agenda,
        notes,
        audio_url: audioUrl,
        status: 'processing',
        file_name: file.name,
        file_size: file.size,
      });
      setMeetingId(meeting.id);

      // Step 3: Transcribe
      setStatus('Transcribing audio with Whisper AI...');
      setProgress(45);
      const transcript = await transcribeAudio(file, setStatus);

      // Step 4: Generate MoM
      setStatus('Generating Minutes of Meeting with GPT-4...');
      setProgress(75);
      const momContent = await generateMoM(transcript, title, department, {
        meetingDate, attendees, agenda, notes,
      });

      // Step 5: Save
      setStatus('Saving results...');
      setProgress(90);
      await updateMeeting(meeting.id, {
        transcript,
        mom_content: momContent,
        status: 'completed',
        confidence: 97,
      });

      if (momContent.action_items?.length) {
        await createActionItems(meeting.id, user.id, momContent.action_items);
      }

      setProgress(100);
      setStatus('Done!');
      setStep(3);
    } catch (err) {
      setError(err.message);
      setStep(1);
      setProgress(0);
    }
  };

  return (
    <AppLayout title="Upload Audio">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500'
              }`}>
                {i < step ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-sm ${i === step ? 'text-white font-medium' : 'text-gray-500'}`}>{s}</span>
              {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-gray-700 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 0: Upload */}
        {step === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6">
            <div>
              <h2 className="text-white text-xl font-semibold">Upload Meeting Recording</h2>
              <p className="text-gray-400 text-sm mt-1">Upload an audio or video file — AI will transcribe and generate professional minutes.</p>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current.click()}
              className="border-2 border-dashed border-gray-700 hover:border-blue-500 rounded-2xl p-10 text-center cursor-pointer transition-all group"
            >
              <CloudUpload className="w-14 h-14 text-gray-600 group-hover:text-blue-500 mx-auto mb-4 transition-colors" />
              <p className="text-white font-medium">Drop your recording here</p>
              <p className="text-gray-500 text-sm mt-1">or click to browse — MP3, WAV, M4A, MP4, WebM</p>
              <input ref={fileRef} type="file" accept="audio/*,video/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            </div>

            {file && (
              <div className="flex items-center gap-4 bg-gray-800 rounded-xl p-4">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <FileAudio className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{file.name}</p>
                  <p className="text-gray-500 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {file && (
              <button onClick={() => setStep(1)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Step 1: Details */}
        {step === 1 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-5">
            <div>
              <h2 className="text-white text-xl font-semibold">Meeting Details</h2>
              <p className="text-gray-400 text-sm mt-1">Provide details to enhance MoM quality.</p>
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>}

            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">Meeting Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Weekly Product Sync — July 2026"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">Meeting Date *</label>
              <input
                type="date"
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">Department</label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Select Department</option>
                {['Sales', 'HR', 'Marketing', 'Finance', 'Development', 'Operations', 'Management'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">Attendees (comma-separated)</label>
              <input
                value={attendeesInput}
                onChange={e => setAttendeesInput(e.target.value)}
                placeholder="e.g. Rajesh Kumar, Priya Sharma, Amit Patel"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">Agenda Topics (one per line)</label>
              <textarea
                value={agendaInput}
                onChange={e => setAgendaInput(e.target.value)}
                rows={4}
                placeholder={'e.g. Q3 Revenue Review\nProduct Roadmap Discussion\nHiring Updates'}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-y"
              />
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">Additional Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Any context about this meeting..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-y"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-xl transition-all">Back</button>
              <button onClick={processAudio} disabled={!title || !meetingDate} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                Generate AI MoM <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 2 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-blue-500/10 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            </div>
            <div>
              <h2 className="text-white text-xl font-semibold">AI Processing</h2>
              <p className="text-blue-400 text-sm mt-2">{status}</p>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-gray-500 text-sm">{progress}% complete</p>
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h2 className="text-white text-xl font-semibold">MoM Generated!</h2>
              <p className="text-gray-400 text-sm mt-2">Your AI-powered Minutes of Meeting is ready.</p>
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { setFile(null); setStep(0); setProgress(0); setTitle(''); setDepartment(''); setMeetingDate(new Date().toISOString().slice(0, 10)); setAttendeesInput(''); setAgendaInput(''); setNotes(''); }} className="bg-gray-800 hover:bg-gray-700 text-white font-medium px-6 py-3 rounded-xl transition-all">
                Upload Another
              </button>
              {meetingId && (
                <button onClick={() => navigate(`/meetings/${meetingId}`)} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition-all">
                  View MoM
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}