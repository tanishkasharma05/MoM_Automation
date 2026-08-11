import { useState, useRef, useEffect, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useSupabaseAuth } from '@/lib/SupabaseAuthContext';
import { getNotes, createNote, updateNote, deleteNote, togglePinned } from '@/lib/notes';
import { uploadAudioToStorage } from '@/lib/meetings';
import { transcribeAudio, generateNoteHighlights } from '@/lib/openai';
import { preloadFFmpeg } from '@/lib/audioChunk';
import {
  Mic, Square, Upload, Loader2, Sparkles, Pin, PinOff, Trash2, Search,
  CheckCircle2, AlertTriangle, HelpCircle, Lightbulb, ListChecks, X, StickyNote,
} from 'lucide-react';

const GROQ_SIZE_LIMIT = 24 * 1024 * 1024; // keep in sync with lib/openai.js

const HIGHLIGHT_META = {
  important: { label: 'Important', icon: Sparkles, className: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
  action: { label: 'Action', icon: ListChecks, className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  decision: { label: 'Decision', icon: CheckCircle2, className: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  question: { label: 'Question', icon: HelpCircle, className: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  idea: { label: 'Idea', icon: Lightbulb, className: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30' },
};

export default function Notes() {
  const { user } = useSupabaseAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [showCapture, setShowCapture] = useState(false);

  const refresh = () => {
    if (!user) return;
    return getNotes(user.id).then(setNotes);
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const allTags = useMemo(() => {
    const set = new Set();
    notes.forEach((n) => (n.tags || []).forEach((t) => set.add(t)));
    return [...set];
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (activeTag && !(n.tags || []).includes(activeTag)) return false;
      if (!q) return true;
      const haystack = [n.title, n.summary, n.transcript, ...(n.highlights || []).map((h) => h.text)]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [notes, search, activeTag]);

  const handlePin = async (note) => {
    const updated = await togglePinned(note.id, !note.pinned);
    setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)).sort((a, b) => (b.pinned - a.pinned)));
  };

  const handleDelete = async (note) => {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    await deleteNote(note.id);
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
  };

  return (
    <AppLayout title="AI Notes">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-white text-2xl font-heading font-bold tracking-tight flex items-center gap-2">
              <StickyNote className="w-6 h-6 text-indigo-400" /> AI Notes
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Speak or upload a quick voice memo — AI transcribes it and pulls out the important points automatically.
            </p>
          </div>
          <button
            onClick={() => setShowCapture(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/25 transition-all"
          >
            <Mic className="w-4 h-4" /> New Voice Note
          </button>
        </div>

        {/* Search + tag filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes, transcripts, highlights..."
              className="w-full bg-gray-900 border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          {allTags.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setActiveTag((t) => (t === tag ? null : tag))}
                  className={`whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                    activeTag === tag
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-white/[0.03] border-white/[0.08] text-gray-400 hover:text-white'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center text-gray-500">
            {notes.length === 0
              ? 'No AI notes yet. Record or upload a voice memo to get started.'
              : 'No notes match your search.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredNotes.map((note) => (
              <NoteCard key={note.id} note={note} onPin={handlePin} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {showCapture && (
        <CaptureModal
          userId={user?.id}
          onClose={() => setShowCapture(false)}
          onCreated={(note) => {
            setNotes((prev) => [note, ...prev]);
          }}
          onUpdated={(note) => {
            setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
          }}
        />
      )}
    </AppLayout>
  );
}

function NoteCard({ note, onPin, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const highlights = note.highlights || [];

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-white font-semibold truncate">{note.title}</h3>
          <p className="text-gray-500 text-xs mt-0.5">
            {new Date(note.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onPin(note)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-400 hover:bg-white/[0.05] transition-all" title={note.pinned ? 'Unpin' : 'Pin'}>
            {note.pinned ? <Pin className="w-4 h-4 fill-amber-400 text-amber-400" /> : <PinOff className="w-4 h-4" />}
          </button>
          <button onClick={() => onDelete(note)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-400 hover:bg-white/[0.05] transition-all" title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {note.status === 'processing' && (
        <div className="flex items-center gap-2 text-amber-400 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Transcribing & analyzing...
        </div>
      )}
      {note.status === 'failed' && (
        <div className="flex items-center gap-2 text-rose-400 text-xs">
          <AlertTriangle className="w-3.5 h-3.5" /> Processing failed
        </div>
      )}

      {note.summary && <p className="text-gray-300 text-sm">{note.summary}</p>}

      {highlights.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(expanded ? highlights : highlights.slice(0, 3)).map((h, i) => {
            const meta = HIGHLIGHT_META[h.type] || HIGHLIGHT_META.important;
            const Icon = meta.icon;
            return (
              <span key={i} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${meta.className}`}>
                <Icon className="w-3 h-3" /> {h.text}
              </span>
            );
          })}
          {!expanded && highlights.length > 3 && (
            <button onClick={() => setExpanded(true)} className="text-xs text-gray-500 hover:text-indigo-400 px-2 py-1">
              +{highlights.length - 3} more
            </button>
          )}
        </div>
      )}

      {(note.tags || []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {note.tags.map((t) => (
            <span key={t} className="text-[11px] text-gray-500">#{t}</span>
          ))}
        </div>
      )}

      {note.transcript && (
        <button onClick={() => setExpanded((e) => !e)} className="text-xs text-indigo-400 hover:text-indigo-300 self-start mt-1">
          {expanded ? 'Hide transcript' : 'Show full transcript'}
        </button>
      )}
      {expanded && note.transcript && (
        <p className="text-gray-400 text-xs leading-relaxed whitespace-pre-wrap border-t border-white/[0.06] pt-3">{note.transcript}</p>
      )}
    </div>
  );
}

function CaptureModal({ userId, onClose, onCreated, onUpdated }) {
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fileInputRef = useRef(null);

  const [mode, setMode] = useState(null); // 'record' | 'upload'
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioFile, setAudioFile] = useState(null);
  const [title, setTitle] = useState('');
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const startRecording = async () => {
    setError('');
    setMode('record');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    mediaRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const file = new File([blob], `note-${Date.now()}.webm`, { type: 'audio/webm' });
      setAudioFile(file);
      stream.getTracks().forEach((t) => t.stop());
      if (blob.size > GROQ_SIZE_LIMIT) preloadFFmpeg();
    };

    recorder.start();
    setIsRecording(true);
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMode('upload');
    setAudioFile(file);
    setError('');
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const process = async () => {
    if (!audioFile) return;
    setProcessing(true);
    setError('');
    let note;
    try {
      setStatus('Uploading audio...');
      const audioUrl = await uploadAudioToStorage(audioFile, userId, setStatus);

      note = await createNote({
        user_id: userId,
        title: title || 'Untitled Note',
        source: mode === 'record' ? 'voice' : 'upload',
        audio_url: audioUrl,
        duration_seconds: duration,
        status: 'processing',
      });
      onCreated(note);

      setStatus('Transcribing audio...');
      const transcript = await transcribeAudio(audioFile, setStatus);

      setStatus('Finding important notes with AI...');
      const { title: aiTitle, summary, tags, highlights } = await generateNoteHighlights(transcript, title);

      const updated = await updateNote(note.id, {
        title: aiTitle,
        transcript,
        summary,
        tags,
        highlights,
        status: 'completed',
      });
      onUpdated(updated);
      setDone(true);
    } catch (e) {
      setError(e.message);
      if (note) {
        const failed = await updateNote(note.id, { status: 'failed' }).catch(() => null);
        if (failed) onUpdated(failed);
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-gray-950 border border-white/[0.08] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-heading font-semibold text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" /> New AI Note
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-white font-medium">Note saved with AI highlights.</p>
            <button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all">
              Done
            </button>
          </div>
        ) : (
          <>
            {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>}

            {!audioFile && !isRecording && (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={startRecording} className="flex flex-col items-center gap-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl py-6 transition-all">
                  <Mic className="w-6 h-6 text-indigo-400" />
                  <span className="text-sm text-gray-200 font-medium">Record</span>
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-xl py-6 transition-all">
                  <Upload className="w-6 h-6 text-indigo-400" />
                  <span className="text-sm text-gray-200 font-medium">Upload audio</span>
                </button>
                <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileSelect} />
              </div>
            )}

            {isRecording && (
              <div className="text-center space-y-3 py-4">
                <div className="w-20 h-20 mx-auto rounded-full bg-red-500/15 ring-4 ring-red-500/20 animate-pulse flex items-center justify-center">
                  <Mic className="w-8 h-8 text-red-400" />
                </div>
                <p className="text-white text-2xl font-mono font-bold tabular-nums">{formatTime(duration)}</p>
                <button onClick={stopRecording} className="flex items-center gap-2 mx-auto bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
                  <Square className="w-4 h-4" /> Stop
                </button>
              </div>
            )}

            {audioFile && !isRecording && !processing && (
              <div className="space-y-3">
                <p className="text-emerald-400 text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {audioFile.name} ready
                </p>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Note title (optional — AI will suggest one)"
                  className="w-full bg-gray-900 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex gap-2">
                  <button onClick={() => { setAudioFile(null); setMode(null); setDuration(0); }} className="flex-1 bg-white/[0.05] hover:bg-white/[0.09] text-gray-300 text-sm font-medium py-2.5 rounded-xl transition-all">
                    Discard
                  </button>
                  <button onClick={process} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-all">
                    Analyze with AI
                  </button>
                </div>
              </div>
            )}

            {processing && (
              <div className="text-center space-y-3 py-4">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                <p className="text-indigo-300 text-sm">{status}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
