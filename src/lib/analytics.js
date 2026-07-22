import { supabase } from './supabase';

// Meetings-per-day over the last N days (default 30) for a trend line.
export async function getMeetingsTrend(userId, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('meetings')
    .select('created_at, duration_seconds')
    .eq('user_id', userId)
    .gte('created_at', since.toISOString());
  if (error) throw error;

  const buckets = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = { date: key, meetings: 0, minutes: 0 };
  }
  data.forEach((m) => {
    const key = new Date(m.created_at).toISOString().slice(0, 10);
    if (!buckets[key]) return;
    buckets[key].meetings += 1;
    buckets[key].minutes += (m.duration_seconds || 0) / 60;
  });

  return Object.values(buckets).map((b) => ({
    ...b,
    minutes: Math.round(b.minutes),
    label: new Date(b.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));
}

// Meeting counts + total minutes grouped by department.
export async function getDepartmentBreakdown(userId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('department, duration_seconds, status')
    .eq('user_id', userId);
  if (error) throw error;

  const map = {};
  data.forEach((m) => {
    const dept = m.department || 'Unassigned';
    if (!map[dept]) map[dept] = { name: dept, meetings: 0, minutes: 0, completed: 0 };
    map[dept].meetings += 1;
    map[dept].minutes += (m.duration_seconds || 0) / 60;
    if (m.status === 'completed') map[dept].completed += 1;
  });

  return Object.values(map)
    .map((d) => ({ ...d, minutes: Math.round(d.minutes) }))
    .sort((a, b) => b.meetings - a.meetings);
}

// Action-item throughput: created vs. completed, grouped by assignee.
export async function getActionItemThroughput(userId) {
  const { data, error } = await supabase
    .from('action_items')
    .select('assignee, status')
    .eq('user_id', userId);
  if (error) throw error;

  const map = {};
  data.forEach((it) => {
    const who = it.assignee || 'Unassigned';
    if (!map[who]) map[who] = { name: who, total: 0, done: 0 };
    map[who].total += 1;
    if (it.status === 'done') map[who].done += 1;
  });

  return Object.values(map)
    .map((a) => ({ ...a, open: a.total - a.done, completionRate: a.total ? Math.round((a.done / a.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);
}

// Average meeting duration, longest/shortest, and week-over-week delta.
export async function getDurationStats(userId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('duration_seconds, created_at')
    .eq('user_id', userId)
    .not('duration_seconds', 'is', null);
  if (error) throw error;
  if (!data.length) return { avgMinutes: 0, longestMinutes: 0, shortestMinutes: 0, weekOverWeekPct: null };

  const minutesList = data.map((m) => (m.duration_seconds || 0) / 60);
  const avgMinutes = Math.round(minutesList.reduce((a, b) => a + b, 0) / minutesList.length);
  const longestMinutes = Math.round(Math.max(...minutesList));
  const shortestMinutes = Math.round(Math.min(...minutesList));

  const now = new Date();
  const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - 7);
  const lastWeekStart = new Date(now); lastWeekStart.setDate(now.getDate() - 14);

  const thisWeek = data.filter((m) => new Date(m.created_at) >= thisWeekStart);
  const lastWeek = data.filter((m) => new Date(m.created_at) >= lastWeekStart && new Date(m.created_at) < thisWeekStart);

  const avg = (arr) => (arr.length ? arr.reduce((s, m) => s + (m.duration_seconds || 0), 0) / arr.length : null);
  const thisAvg = avg(thisWeek);
  const lastAvg = avg(lastWeek);
  const weekOverWeekPct = thisAvg !== null && lastAvg ? Math.round(((thisAvg - lastAvg) / lastAvg) * 100) : null;

  return { avgMinutes, longestMinutes, shortestMinutes, weekOverWeekPct };
}
