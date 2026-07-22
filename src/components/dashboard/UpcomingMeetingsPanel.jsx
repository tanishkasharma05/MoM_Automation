import { useState, useEffect } from 'react';
import { Calendar, Plus, Users, Mail, X, Loader2, Pencil, Trash2, Check } from 'lucide-react';
import { createScheduledMeeting, updateScheduledMeeting, deleteScheduledMeeting } from '@/lib/scheduledMeetings';
import { getTeamMembers } from '@/lib/team';
import { supabase } from '@/lib/supabase';

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function toDateInput(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}
function toTimeInput(iso) {
  return new Date(iso).toISOString().slice(11, 16);
}

function ScheduleModal({ onClose, onSaved, user, editingMeeting }) {
  const isEdit = !!editingMeeting;
  const [title, setTitle] = useState(editingMeeting?.title || '');
  const [date, setDate] = useState(editingMeeting ? toDateInput(editingMeeting.scheduled_at) : '');
  const [time, setTime] = useState(editingMeeting ? toTimeInput(editingMeeting.scheduled_at) : '');
  const [attendeesInput, setAttendeesInput] = useState((editingMeeting?.attendees || []).join(', '));
  const [notes, setNotes] = useState(editingMeeting?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    getTeamMembers().then(setTeamMembers).catch(() => {});
  }, []);

  const selectedEmails = new Set(
    attendeesInput.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean)
  );

  const toggleMember = (email) => {
    const current = attendeesInput.split(',').map((a) => a.trim()).filter(Boolean);
    const exists = current.some((a) => a.toLowerCase() === email.toLowerCase());
    const next = exists
      ? current.filter((a) => a.toLowerCase() !== email.toLowerCase())
      : [...current, email];
    setAttendeesInput(next.join(', '));
  };

  const submit = async () => {
    if (!title || !date || !time) {
      setError('Title, date, and time are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const scheduledAt = new Date(`${date}T${time}`).toISOString();
      const attendees = attendeesInput.split(',').map((a) => a.trim()).filter(Boolean);
      const meeting = isEdit
        ? await updateScheduledMeeting(editingMeeting.id, { title, scheduledAt, attendees, notes })
        : await createScheduledMeeting(user.id, { title, scheduledAt, attendees, notes });
      onSaved(meeting, isEdit);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-lg">{isEdit ? 'Edit Meeting' : 'Schedule Meeting'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-2.5">{error}</div>}

        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Meeting title"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-3">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-gray-400 text-xs mb-1.5 block">Attendee emails (comma-separated)</label>
            <input
              value={attendeesInput}
              onChange={(e) => setAttendeesInput(e.target.value)}
              placeholder="e.g. rajesh@sgew.com, priya@sgew.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {teamMembers.length > 0 && (
            <div>
              <label className="text-gray-400 text-xs mb-1.5 block">Or pick from your team</label>
              <div className="flex flex-wrap gap-2">
                {teamMembers.map((m) => {
                  const isSelected = selectedEmails.has(m.email.toLowerCase());
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMember(m.email)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                        isSelected
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />} {m.email}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        <button
          onClick={submit}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-all text-sm"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} {isEdit ? 'Save Changes' : 'Schedule Meeting'}
        </button>
      </div>
    </div>
  );
}

export default function UpcomingMeetingsPanel({ meetings, loading, user, onScheduled, onUpdated, onDeleted }) {
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState(null);
  const [mailingId, setMailingId] = useState(null);
  const [mailStatus, setMailStatus] = useState({});
  const [deletingId, setDeletingId] = useState(null);

  const mailMembers = async (meeting) => {
    if (!meeting.attendees?.length) {
      setMailStatus((s) => ({ ...s, [meeting.id]: 'No attendees to email.' }));
      return;
    }
    setMailingId(meeting.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-meeting-mail', {
        body: {
          attendees: meeting.attendees,
          title: meeting.title,
          scheduledAt: meeting.scheduled_at,
          notes: meeting.notes,
          organizerName: user?.user_metadata?.full_name || user?.email,
        },
      });
      if (error) {
        let detail = error.message;
        try { detail = (await error.context.json())?.error || detail; } catch { /* keep default */ }
        setMailStatus((s) => ({ ...s, [meeting.id]: `Failed: ${detail}` }));
      } else {
        setMailStatus((s) => ({ ...s, [meeting.id]: 'Sent!' }));
      }
    } catch (e) {
      setMailStatus((s) => ({ ...s, [meeting.id]: 'Failed to send.' }));
    } finally {
      setMailingId(null);
    }
  };

  const handleDelete = async (meeting) => {
    if (!confirm(`Cancel "${meeting.title}"?`)) return;
    setDeletingId(meeting.id);
    try {
      await deleteScheduledMeeting(meeting.id);
      onDeleted(meeting.id);
    } catch (e) {
      alert('Failed to delete: ' + e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaved = (meeting, isEdit) => {
    if (isEdit) onUpdated(meeting);
    else onScheduled(meeting);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h3 className="text-white font-semibold">Upcoming Meetings</h3>
          <span className="bg-blue-500/10 text-blue-400 text-xs px-2 py-0.5 rounded-full">{meetings.length}</span>
        </div>
        <button
          onClick={() => { setEditingMeeting(null); setShowModal(true); }}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Schedule
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : meetings.length === 0 ? (
        <p className="text-gray-500 text-sm py-6 text-center">No upcoming meetings — schedule one to get started.</p>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <div key={m.id} className="bg-gray-800/60 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-white font-medium">{m.title}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {new Date(m.scheduled_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">in {daysUntil(m.scheduled_at)} days</span>
                    {m.attendees?.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {m.attendees.length} attendee{m.attendees.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setEditingMeeting(m); setShowModal(true); }}
                      className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium px-2.5 py-2 rounded-lg transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(m)}
                      disabled={deletingId === m.id}
                      className="flex items-center gap-1 bg-gray-800 hover:bg-red-500/20 text-gray-300 hover:text-red-400 text-xs font-medium px-2.5 py-2 rounded-lg transition-all disabled:opacity-50"
                    >
                      {deletingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => mailMembers(m)}
                      disabled={mailingId === m.id}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-all"
                    >
                      {mailingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Mail Members
                    </button>
                  </div>
                  {mailStatus[m.id] && <span className="text-xs text-gray-500">{mailStatus[m.id]}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ScheduleModal
          user={user}
          editingMeeting={editingMeeting}
          onClose={() => { setShowModal(false); setEditingMeeting(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
