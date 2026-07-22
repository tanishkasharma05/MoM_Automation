import { supabase } from './supabase';
import { normalizeMoM } from './mom';

// AI Insights — pulls risks/concerns and follow-ups the AI flagged out of
// recent completed meetings' generated minutes, newest first.
export async function getAiInsights(userId, limit = 6) {
  const { data, error } = await supabase
    .from('meetings')
    .select('id, title, created_at, mom_content')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('mom_content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(15);
  if (error) throw error;

  const insights = [];
  for (const meeting of data) {
    const mom = normalizeMoM(meeting.mom_content);
    if (!mom) continue;
    mom.risks_concerns?.forEach((text) =>
      insights.push({ type: 'risk', text, meetingTitle: meeting.title, meetingId: meeting.id, createdAt: meeting.created_at })
    );
    mom.follow_up_items?.forEach((text) =>
      insights.push({ type: 'follow_up', text, meetingTitle: meeting.title, meetingId: meeting.id, createdAt: meeting.created_at })
    );
  }

  return insights
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

// Team Activity Feed — a unified, human-readable timeline built from the
// user's own recent meetings and action-item status changes (no separate
// audit table required).
export async function getTeamActivity(userId, limit = 8) {
  const [{ data: meetings, error: mErr }, { data: items, error: iErr }] = await Promise.all([
    supabase
      .from('meetings')
      .select('id, title, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('action_items')
      .select('id, text, assignee, status, created_at, meetings(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);
  if (mErr) throw mErr;
  if (iErr) throw iErr;

  const events = [
    ...meetings.map((m) => ({
      id: `meeting-${m.id}`,
      kind: 'meeting',
      label:
        m.status === 'completed'
          ? `Minutes generated for "${m.title}"`
          : m.status === 'processing'
          ? `Processing audio for "${m.title}"`
          : `New meeting recorded: "${m.title}"`,
      createdAt: m.created_at,
    })),
    ...items.map((it) => ({
      id: `item-${it.id}`,
      kind: 'action_item',
      label:
        it.status === 'done'
          ? `${it.assignee || 'Someone'} completed "${it.text}"`
          : `New action item for ${it.assignee || 'Unassigned'}: "${it.text}"`,
      createdAt: it.created_at,
    })),
  ];

  return events
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

// Live Meeting Status — meetings currently being recorded/processed, plus
// anything scheduled to start within the next hour, so the dashboard can
// surface a "what's happening right now" strip.
export async function getLiveStatus(userId) {
  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 60 * 1000);

  const [{ data: active, error: aErr }, { data: startingSoon, error: sErr }] = await Promise.all([
    supabase
      .from('meetings')
      .select('id, title, status, created_at')
      .eq('user_id', userId)
      .eq('status', 'processing')
      .order('created_at', { ascending: false }),
    supabase
      .from('scheduled_meetings')
      .select('id, title, scheduled_at')
      .eq('user_id', userId)
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', soon.toISOString())
      .order('scheduled_at', { ascending: true }),
  ]);
  if (aErr) throw aErr;
  if (sErr) throw sErr;

  return { active: active || [], startingSoon: startingSoon || [] };
}

// Meeting Health Score — a composite of real signals we already store:
// average AI confidence, meeting completion rate, and action-item
// completion rate. No fabricated numbers.
export async function getMeetingHealth(userId) {
  const [{ data: meetings, error: mErr }, { data: items, error: iErr }] = await Promise.all([
    supabase.from('meetings').select('status, confidence').eq('user_id', userId),
    supabase.from('action_items').select('status').eq('user_id', userId),
  ]);
  if (mErr) throw mErr;
  if (iErr) throw iErr;

  const total = meetings.length || 1;
  const completed = meetings.filter((m) => m.status === 'completed').length;
  const completionRate = Math.round((completed / total) * 100);

  const confidences = meetings.filter((m) => typeof m.confidence === 'number').map((m) => m.confidence);
  const avgConfidence = confidences.length
    ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
    : null;

  const totalItems = items.length || 1;
  const doneItems = items.filter((it) => it.status === 'done').length;
  const actionCompletionRate = items.length ? Math.round((doneItems / totalItems) * 100) : null;

  const factors = [
    { label: 'Meeting completion rate', value: completionRate },
    avgConfidence !== null && { label: 'AI transcription confidence', value: avgConfidence },
    actionCompletionRate !== null && { label: 'Action item completion', value: actionCompletionRate },
  ].filter(Boolean);

  const overall = factors.length
    ? Math.round(factors.reduce((sum, f) => sum + f.value, 0) / factors.length)
    : 0;

  return { overall, factors };
}

// Status breakdown for a donut/KPI chart.
export async function getStatusBreakdown(userId) {
  const { data, error } = await supabase.from('meetings').select('status').eq('user_id', userId);
  if (error) throw error;
  const counts = data.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {});
  return [
    { name: 'Completed', value: counts.completed || 0, color: '#34D399' },
    { name: 'Processing', value: counts.processing || 0, color: '#FBBF24' },
    { name: 'Failed', value: counts.failed || 0, color: '#FB7185' },
  ].filter((s) => s.value > 0);
}
