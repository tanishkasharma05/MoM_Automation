import { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useSupabaseAuth } from '@/lib/SupabaseAuthContext';
import {
  createScheduledMeeting, updateScheduledMeeting, deleteScheduledMeeting,
} from '@/lib/scheduledMeetings';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Clock, Users as UsersIcon } from 'lucide-react';

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

function buildMonthGrid(monthDate) {
  const first = startOfMonth(monthDate);
  const last = endOfMonth(monthDate);
  const startOffset = (first.getDay() + 6) % 7; // Monday-first
  const days = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), d));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function EventModal({ initial, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [date, setDate] = useState(initial?.scheduled_at ? initial.scheduled_at.slice(0, 10) : '');
  const [time, setTime] = useState(initial?.scheduled_at ? initial.scheduled_at.slice(11, 16) : '10:00');
  const [attendees, setAttendees] = useState(initial?.attendees || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title || !date) return;
    setSaving(true);
    try {
      await onSave({ title, scheduledAt: new Date(`${date}T${time}:00`).toISOString(), attendees, notes });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="glass-card rounded-2xl w-full max-w-md p-5 sm:p-6 border border-white/[0.08]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-heading font-semibold">{initial?.id ? 'Edit Meeting' : 'Schedule Meeting'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="Sprint planning" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Attendees</label>
            <input value={attendees} onChange={(e) => setAttendees(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500" placeholder="jane@co.com, sam@co.com" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-5">
          {initial?.id ? (
            <button onClick={() => onDelete(initial.id).then(onClose)} className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 text-sm font-medium">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          ) : <span />}
          <button
            onClick={save}
            disabled={saving || !title || !date}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Calendar() {
  const { user } = useSupabaseAuth();
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalEvent, setModalEvent] = useState(null); // null = closed, {} = new, {...} = edit
  const [selectedDay, setSelectedDay] = useState(new Date());

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Pull a wide window (past 60d .. future 120d) so month nav doesn't refetch constantly.
      const { data, error } = await supabase
        .from('scheduled_meetings')
        .select('*')
        .eq('user_id', user.id)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      setEvents(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  const grid = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach((ev) => {
      const key = new Date(ev.scheduled_at).toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    });
    return map;
  }, [events]);

  const selectedDayEvents = (eventsByDay[selectedDay.toDateString()] || []).sort(
    (a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)
  );

  const handleSave = async ({ title, scheduledAt, attendees, notes }) => {
    if (modalEvent?.id) {
      await updateScheduledMeeting(modalEvent.id, { title, scheduledAt, attendees, notes });
    } else {
      await createScheduledMeeting(user.id, { title, scheduledAt, attendees, notes });
    }
    await load();
  };

  const handleDelete = async (id) => {
    await deleteScheduledMeeting(id);
    await load();
  };

  const monthLabel = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const today = new Date();

  return (
    <AppLayout title="Calendar">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-white font-heading font-semibold text-xl">Calendar</h1>
            <p className="text-gray-500 text-sm mt-1">Schedule and manage upcoming meetings</p>
          </div>
          <button
            onClick={() => setModalEvent({})}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> New Meeting
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Month grid */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-heading font-semibold">{monthLabel}</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))} className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setMonthDate(new Date())} className="px-3 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-gray-300 hover:text-white font-medium">
                  Today
                </button>
                <button onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))} className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="text-center text-gray-500 text-[11px] font-medium py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {grid.map((day, i) => {
                if (!day) return <div key={i} className="aspect-square sm:aspect-auto sm:h-20" />;
                const dayEvents = eventsByDay[day.toDateString()] || [];
                const isToday = sameDay(day, today);
                const isSelected = sameDay(day, selectedDay);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(day)}
                    className={`aspect-square sm:aspect-auto sm:h-20 rounded-xl p-1.5 sm:p-2 text-left flex flex-col gap-1 transition-colors border ${
                      isSelected ? 'border-indigo-500 bg-indigo-500/10' : 'border-transparent hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className={`text-xs font-semibold ${isToday ? 'w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center' : 'text-gray-300'}`}>
                      {day.getDate()}
                    </span>
                    <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <span key={ev.id} className="hidden sm:block text-[10px] leading-tight px-1 py-0.5 rounded bg-cyan-500/15 text-cyan-300 truncate">
                          {ev.title}
                        </span>
                      ))}
                      {dayEvents.length > 0 && (
                        <span className="sm:hidden w-1.5 h-1.5 rounded-full bg-cyan-400 self-start" />
                      )}
                      {dayEvents.length > 2 && (
                        <span className="hidden sm:block text-[10px] text-gray-500">+{dayEvents.length - 2} more</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day agenda */}
          <div className="glass-card rounded-2xl p-4 sm:p-6">
            <h3 className="text-white font-heading font-semibold mb-1">
              {selectedDay.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </h3>
            <p className="text-gray-500 text-sm mb-4">{selectedDayEvents.length} meeting{selectedDayEvents.length === 1 ? '' : 's'} scheduled</p>

            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
              </div>
            ) : selectedDayEvents.length === 0 ? (
              <p className="text-gray-500 text-sm py-6 text-center">Nothing scheduled — tap "New Meeting" to add one.</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {selectedDayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setModalEvent(ev)}
                    className="w-full text-left p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-colors"
                  >
                    <p className="text-white text-sm font-semibold truncate">{ev.title}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-gray-500 text-xs">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ev.scheduled_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {ev.attendees && (
                        <span className="flex items-center gap-1 truncate">
                          <UsersIcon className="w-3 h-3" /> {ev.attendees}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {modalEvent !== null && (
        <EventModal
          initial={modalEvent}
          onClose={() => setModalEvent(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </AppLayout>
  );
}
