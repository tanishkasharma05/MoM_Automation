import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { getMeeting, updateMeeting, deleteMeeting } from '@/lib/meetings';
import { normalizeMoM } from '@/lib/mom';
import { generateMomDocx } from '@/lib/exportDocx';
import { exportMomPdf } from '@/lib/exportPdf';
import { supabase } from '@/lib/supabase';
import { getPlayableDriveAudioUrl } from '@/lib/googleDrive';
import { useSupabaseAuth } from '@/lib/SupabaseAuthContext';
import AttendeeRoster from '@/components/meetings/AttendeeRoster';
import AgendaTimeline from '@/components/meetings/AgendaTimeline';
import AiSuggestions from '@/components/meetings/AiSuggestions';
import MeetingChat from '@/components/meetings/MeetingChat';
import {
  ArrowLeft, Trash2, Calendar, Globe, CheckCircle, Pencil, Save, X, Plus,
  FileDown, Loader2, Mail, FileText, ListChecks, Mic, LayoutList, Sparkles,
  MessageSquare, Paperclip, Radio,
} from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutList },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'ai', label: 'AI Suggestions', icon: Sparkles },
  { id: 'chat', label: 'Meeting Chat', icon: MessageSquare },
  { id: 'files', label: 'Files', icon: Paperclip },
];

export default function MeetingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useSupabaseAuth();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportTab, setReportTab] = useState('concise');
  const [activeTab, setActiveTab] = useState('overview');
  const [showTranscript, setShowTranscript] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifyStatus, setNotifyStatus] = useState('');
  const [showEmailEditor, setShowEmailEditor] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [savingEmails, setSavingEmails] = useState(false);

  useEffect(() => {
    getMeeting(id).then(setMeeting).finally(() => setLoading(false));
  }, [id]);

  const mom = meeting ? normalizeMoM(meeting.mom_content) : null;

  const startEditing = () => {
    setDraft(mom);
    setIsEditing(true);
  };
  const cancelEditing = () => { setIsEditing(false); setDraft(null); };

  const saveEditing = async () => {
    setSaving(true);
    try {
      const updated = await updateMeeting(meeting.id, { mom_content: draft });
      setMeeting(updated);
      setIsEditing(false);
      setDraft(null);
    } catch (e) {
      alert('Failed to save changes: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = () => {
    setExportingPdf(true);
    try {
      exportMomPdf(meeting, mom || {});
    } catch (e) {
      alert('Failed to export PDF: ' + e.message);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportDocx = async () => {
    setExportingDocx(true);
    try {
      await generateMomDocx(meeting, mom || {});
    } catch (e) {
      alert('Failed to export Word document: ' + e.message);
    } finally {
      setExportingDocx(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this meeting and all its data? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteMeeting(meeting.id);
      navigate('/meetings');
    } catch (e) {
      alert('Failed to delete: ' + e.message);
      setDeleting(false);
    }
  };

  const addAttendeeEmails = async () => {
    const newEmails = emailInput.split(',').map((a) => a.trim()).filter(Boolean);
    const invalid = newEmails.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length > 0) {
      setNotifyStatus(`Not a valid email: ${invalid.join(', ')}`);
      return;
    }
    setSavingEmails(true);
    try {
      const current = meeting.attendees || [];
      const merged = [...new Set([...current, ...newEmails])];
      const updated = await updateMeeting(meeting.id, { attendees: merged });
      setMeeting(updated);
      setEmailInput('');
      setNotifyStatus('');
    } catch (e) {
      setNotifyStatus('Failed to save emails: ' + e.message);
    } finally {
      setSavingEmails(false);
    }
  };

  const removeAttendeeEmail = async (email) => {
    setSavingEmails(true);
    try {
      const updated = await updateMeeting(meeting.id, {
        attendees: (meeting.attendees || []).filter((a) => a !== email),
      });
      setMeeting(updated);
    } catch (e) {
      setNotifyStatus('Failed to remove email: ' + e.message);
    } finally {
      setSavingEmails(false);
    }
  };

  const handleNotifyMembers = async () => {
    const candidateEmails = [...(meeting.attendees || []), ...(mom?.attendees || [])].filter((a) => EMAIL_RE.test(a));
    const uniqueEmails = [...new Set(candidateEmails)];

    if (uniqueEmails.length === 0) {
      setNotifyStatus('No valid attendee email addresses found for this meeting.');
      return;
    }

    setNotifying(true);
    setNotifyStatus('');
    try {
      const { error } = await supabase.functions.invoke('send-mom-notification', {
        body: {
          attendees: uniqueEmails,
          title: meeting.title,
          meetingDate: meeting.meeting_date,
          actionItems: mom?.action_items || [],
          senderName: user?.user_metadata?.full_name || user?.email,
        },
      });
      if (error) {
        let detail = error.message;
        try { detail = (await error.context.json())?.error || detail; } catch { /* keep default */ }
        setNotifyStatus(`Failed: ${detail}`);
      } else {
        setNotifyStatus(`Sent to ${uniqueEmails.length} attendee(s).`);
      }
    } catch (e) {
      setNotifyStatus('Failed to send notifications.');
    } finally {
      setNotifying(false);
    }
  };

  if (loading) return (
    <AppLayout title="Meeting Details">
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  if (!meeting) return (
    <AppLayout title="Meeting Details">
      <div className="text-center py-20 text-gray-400">Meeting not found.</div>
    </AppLayout>
  );

  const displayDate = meeting.meeting_date
    ? new Date(meeting.meeting_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date(meeting.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <AppLayout title="Meeting Details">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigate('/meetings')} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-all">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-2 text-rose-400 hover:text-rose-300 text-sm font-medium transition-all disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
          </button>
        </div>

        {/* Meeting header card */}
        <div className="glass-card rounded-2xl p-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-white text-2xl font-heading font-semibold">{meeting.title}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-400">
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {displayDate}</span>
              <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> {meeting.language || 'English'}</span>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
            meeting.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
            meeting.status === 'processing' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
            'bg-gray-500/10 text-gray-400 border-gray-500/30'
          }`}>
            {meeting.status === 'completed' && <CheckCircle className="w-3.5 h-3.5" />}
            {meeting.status === 'processing' && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
            )}
            {meeting.status?.charAt(0).toUpperCase() + meeting.status?.slice(1)}
          </span>
        </div>

        {mom && (
          <>
            {/* Tab nav */}
            <div className="flex gap-1 glass-card rounded-xl p-1 overflow-x-auto">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                      active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {t.label}
                    {t.id === 'tasks' && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-white/10'}`}>{mom.action_items.length}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Overview tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AgendaTimeline points={mom.discussion_points} />
                  <AttendeeRoster attendees={mom.attendees?.length ? mom.attendees : (meeting.attendees || [])} />
                </div>

                {/* Report tabs + export */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex gap-1 glass-card rounded-xl p-1">
                    <button
                      onClick={() => setReportTab('concise')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        reportTab === 'concise' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <FileText className="w-4 h-4" /> Concise Summary
                    </button>
                    <button
                      onClick={() => setReportTab('detailed')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        reportTab === 'detailed' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <ListChecks className="w-4 h-4" /> Detailed Report
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isEditing ? (
                      <button onClick={startEditing} className="flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.09] text-gray-200 text-sm font-medium px-4 py-2.5 rounded-xl transition-all">
                        <Pencil className="w-4 h-4" /> Edit
                      </button>
                    ) : (
                      <>
                        <button onClick={cancelEditing} disabled={saving} className="flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.09] text-gray-200 text-sm font-medium px-4 py-2.5 rounded-xl transition-all">
                          <X className="w-4 h-4" /> Cancel
                        </button>
                        <button onClick={saveEditing} disabled={saving} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                        </button>
                      </>
                    )}
                    <button onClick={handleExportDocx} disabled={exportingDocx} className="flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.09] disabled:opacity-50 text-gray-200 text-sm font-medium px-4 py-2.5 rounded-xl transition-all">
                      {exportingDocx ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Word
                    </button>
                    <button onClick={handleExportPdf} disabled={exportingPdf} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all">
                      {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Export PDF
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <MomEditor draft={draft} setDraft={setDraft} />
                ) : reportTab === 'concise' ? (
                  <ConciseSummary meeting={meeting} mom={mom} displayDate={displayDate} />
                ) : (
                  <DetailedReport meeting={meeting} mom={mom} displayDate={displayDate} />
                )}
              </div>
            )}

            {/* Tasks tab */}
            {activeTab === 'tasks' && (
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-white font-heading font-semibold">Action Items</h3>
                    <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-0.5 rounded-full">{mom.action_items.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowEmailEditor((s) => !s)}
                      className="flex items-center gap-2 bg-white/[0.05] hover:bg-white/[0.09] text-gray-200 text-sm font-medium px-4 py-2 rounded-xl transition-all"
                    >
                      <Plus className="w-4 h-4" /> Emails
                    </button>
                    <button
                      onClick={handleNotifyMembers}
                      disabled={notifying}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all"
                    >
                      {notifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Notify Members
                    </button>
                  </div>
                </div>

                {showEmailEditor && (
                  <div className="bg-white/[0.04] rounded-xl p-4 mb-4 space-y-3">
                    <p className="text-gray-400 text-xs">Attendee emails — used for Notify Members.</p>
                    {(meeting.attendees || []).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {meeting.attendees.map((email) => (
                          <span key={email} className="flex items-center gap-1.5 bg-gray-900 border border-white/[0.08] text-gray-300 text-xs px-3 py-1.5 rounded-full">
                            {email}
                            <button onClick={() => removeAttendeeEmail(email)} disabled={savingEmails} className="text-gray-500 hover:text-rose-400">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addAttendeeEmails()}
                        placeholder="Add email(s), comma-separated"
                        className="flex-1 bg-gray-900 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={addAttendeeEmails}
                        disabled={savingEmails || !emailInput.trim()}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
                      >
                        {savingEmails ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                      </button>
                    </div>
                  </div>
                )}
                {notifyStatus && <p className="text-xs text-gray-500 mb-3">{notifyStatus}</p>}

                {mom.action_items.length === 0 ? (
                  <p className="text-gray-500 text-sm py-4 text-center">No action items for this meeting.</p>
                ) : (
                  <div className="space-y-2">
                    {mom.action_items.map((a, i) => (
                      <div key={i} className="flex gap-3 items-start bg-white/[0.03] rounded-xl p-3 text-sm">
                        <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-200">{a.text}</p>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                            <span>👤 {a.assignee || 'Not specified'}</span>
                            <span>📅 {a.due_date || 'Not specified'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Suggestions tab */}
            {activeTab === 'ai' && <AiSuggestions mom={mom} />}

            {/* Chat tab */}
            {activeTab === 'chat' && <MeetingChat meetingId={meeting.id} user={user} />}

            {/* Files tab */}
            {activeTab === 'files' && (
              <div className="space-y-6">
                <div className="glass-card rounded-2xl p-6">
                  <button onClick={() => setShowTranscript((s) => !s)} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm font-medium">
                    <Mic className="w-4 h-4" /> {showTranscript ? 'Hide Full Transcript' : 'Show Full Transcript'}
                  </button>
                  {showTranscript && (
                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap mt-4 pt-4 border-t border-white/[0.06]">
                      {meeting.transcript || 'No transcript available.'}
                    </p>
                  )}
                </div>
                {meeting.audio_url ? (
                  <AudioPlayer audioUrl={meeting.audio_url} />
                ) : (
                  <div className="glass-card rounded-2xl p-8 text-center text-gray-500 text-sm">No recording attached to this meeting.</div>
                )}
              </div>
            )}
          </>
        )}

        {!mom && (
          <div className="glass-card rounded-2xl p-8 text-center text-gray-500">
            No MoM generated yet.
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function Section({ title, children }) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <h3 className="text-white font-semibold mb-3 pb-3 border-b border-white/[0.06]">{title}</h3>
      {children}
    </div>
  );
}

function BulletList({ items, empty = 'Not specified in the meeting.' }) {
  const list = items?.length ? items : [empty];
  return (
    <ul className="space-y-2">
      {list.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-gray-300">
          <span className="text-indigo-400 flex-shrink-0">•</span> {item}
        </li>
      ))}
    </ul>
  );
}

function ConciseSummary({ mom, displayDate }) {
  return (
    <div className="space-y-4">
      <Section title="Meeting Info">
        <BulletList items={[
          `Date: ${displayDate}`,
          `Attendees: ${mom.attendees?.length ? mom.attendees.join(', ') : 'Not specified in the meeting.'}`,
        ]} />
      </Section>
      <Section title="Key Decisions">
        <BulletList items={mom.decisions} />
      </Section>
      <Section title="Action Items">
        <BulletList items={mom.action_items.map((a) => `${a.text}: ${a.assignee || 'Not specified'}, Deadline: ${a.due_date || 'Not specified'}`)} empty="No action items for this meeting." />
      </Section>
    </div>
  );
}

function DetailedReport({ meeting, mom, displayDate }) {
  return (
    <div className="space-y-4">
      <Section title="Meeting Information">
        <BulletList items={[`Title: ${meeting.title}`, `Date: ${displayDate}`]} />
      </Section>
      <Section title="Attendees">
        <BulletList items={mom.attendees} />
      </Section>
      <Section title="Agenda-wise Discussion">
        {mom.discussion_points?.length ? <BulletList items={mom.discussion_points} /> : (
          <p className="text-sm text-gray-300">{mom.overview || 'Not specified in the meeting.'}</p>
        )}
      </Section>
      <Section title="Key Decisions">
        <BulletList items={mom.decisions} />
      </Section>
      <Section title="Action Items">
        {mom.action_items.length === 0 ? (
          <p className="text-sm text-gray-500">Not specified in the meeting.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-white/[0.06]">
                  <th className="pb-2 pr-4 font-medium">Task</th>
                  <th className="pb-2 pr-4 font-medium">Owner</th>
                  <th className="pb-2 pr-4 font-medium">Deadline</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {mom.action_items.map((a, i) => (
                  <tr key={i} className="border-b border-white/[0.06] last:border-0">
                    <td className="py-2.5 pr-4 text-gray-200">{a.text}</td>
                    <td className="py-2.5 pr-4 text-gray-400">{a.assignee || 'Not specified'}</td>
                    <td className="py-2.5 pr-4 text-gray-400">{a.due_date || 'Not specified'}</td>
                    <td className="py-2.5">
                      <span className="bg-orange-500/10 text-orange-400 border border-orange-500/30 text-xs px-2 py-0.5 rounded-full">Pending</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <Section title="Risks & Concerns">
        <BulletList items={mom.risks_concerns} />
      </Section>
      <Section title="Follow-up Items">
        <BulletList items={mom.follow_up_items} />
      </Section>
      <Section title="Next Meeting">
        <p className="text-sm text-gray-300">{mom.next_meeting || 'Not specified in the meeting.'}</p>
      </Section>
    </div>
  );
}

// --- Editable MoM form ---

function linesToArray(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

function EditableListSection({ title, values, onChange }) {
  return (
    <Section title={title}>
      <textarea
        value={values.join('\n')}
        onChange={(e) => onChange(linesToArray(e.target.value))}
        rows={Math.max(3, values.length + 1)}
        placeholder="One item per line"
        className="w-full bg-gray-800 border border-white/[0.08] rounded-xl p-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-y"
      />
    </Section>
  );
}

function MomEditor({ draft, setDraft }) {
  const updateActionItem = (index, field, value) => {
    const items = [...draft.action_items];
    items[index] = { ...items[index], [field]: value };
    setDraft({ ...draft, action_items: items });
  };
  const addActionItem = () => setDraft({ ...draft, action_items: [...draft.action_items, { text: '', assignee: '', due_date: '' }] });
  const removeActionItem = (index) => setDraft({ ...draft, action_items: draft.action_items.filter((_, i) => i !== index) });

  return (
    <div className="space-y-4">
      <Section title="Meeting Overview">
        <textarea
          value={draft.overview}
          onChange={(e) => setDraft({ ...draft, overview: e.target.value })}
          rows={4}
          className="w-full bg-gray-800 border border-white/[0.08] rounded-xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500 resize-y"
        />
      </Section>
      <EditableListSection title="Attendees" values={draft.attendees} onChange={(v) => setDraft({ ...draft, attendees: v })} />
      <EditableListSection title="Agenda-wise Discussion" values={draft.discussion_points} onChange={(v) => setDraft({ ...draft, discussion_points: v })} />
      <EditableListSection title="Key Decisions" values={draft.decisions} onChange={(v) => setDraft({ ...draft, decisions: v })} />

      <Section title="Action Items">
        <div className="space-y-3">
          {draft.action_items.map((item, i) => (
            <div key={i} className="bg-gray-800 rounded-xl p-3 space-y-2">
              <div className="flex gap-2 items-start">
                <span className="w-6 h-6 mt-2 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                <input
                  value={item.text || ''}
                  onChange={(e) => updateActionItem(i, 'text', e.target.value)}
                  placeholder="Task description"
                  className="flex-1 bg-gray-900 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
                <button onClick={() => removeActionItem(i)} className="mt-1 text-gray-500 hover:text-red-400 flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 pl-8">
                <input
                  value={item.assignee || ''}
                  onChange={(e) => updateActionItem(i, 'assignee', e.target.value)}
                  placeholder="Owner"
                  className="flex-1 bg-gray-900 border border-white/[0.08] rounded-lg px-3 py-1.5 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  value={item.due_date || ''}
                  onChange={(e) => updateActionItem(i, 'due_date', e.target.value)}
                  placeholder="Deadline"
                  className="flex-1 bg-gray-900 border border-white/[0.08] rounded-lg px-3 py-1.5 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          ))}
          <button onClick={addActionItem} className="w-full flex items-center justify-center gap-2 border border-dashed border-white/[0.08] hover:border-indigo-500 text-gray-400 hover:text-indigo-400 text-sm rounded-xl py-2.5 transition-all">
            <Plus className="w-4 h-4" /> Add action item
          </button>
        </div>
      </Section>

      <EditableListSection title="Next Steps" values={draft.next_steps} onChange={(v) => setDraft({ ...draft, next_steps: v })} />
      <EditableListSection title="Risks & Concerns" values={draft.risks_concerns} onChange={(v) => setDraft({ ...draft, risks_concerns: v })} />
      <EditableListSection title="Follow-up Items" values={draft.follow_up_items} onChange={(v) => setDraft({ ...draft, follow_up_items: v })} />

      <Section title="Next Meeting">
        <input
          value={draft.next_meeting}
          onChange={(e) => setDraft({ ...draft, next_meeting: e.target.value })}
          placeholder="e.g. Next Friday, 3pm"
          className="w-full bg-gray-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
        />
      </Section>
    </div>
  );
}

function AudioPlayer({ audioUrl }) {
  const [playableUrl, setPlayableUrl] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl;
    setLoading(true);
    setError('');
    getPlayableDriveAudioUrl(audioUrl)
      .then((url) => { objectUrl = url; setPlayableUrl(url); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    return () => { if (objectUrl?.startsWith('blob:')) URL.revokeObjectURL(objectUrl); };
  }, [audioUrl]);

  return (
    <div className="glass-card rounded-2xl p-6">
      <h3 className="text-white font-semibold mb-4">Meeting Audio</h3>
      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading audio...
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <audio controls src={playableUrl} className="w-full" />
      )}
    </div>
  );
}
