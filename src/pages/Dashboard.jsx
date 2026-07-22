import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import StatCard from '@/components/dashboard/StatCard';
import ActivityChart from '@/components/dashboard/ActivityChart';
import QuickActions from '@/components/dashboard/QuickActions';
import MeetingTable from '@/components/meetings/MeetingTable';
import ActionItemsPanel from '@/components/dashboard/ActionItemsPanel';
import UpcomingMeetingsPanel from '@/components/dashboard/UpcomingMeetingsPanel';
import AiInsightsPanel from '@/components/dashboard/AiInsightsPanel';
import TeamActivityFeed from '@/components/dashboard/TeamActivityFeed';
import LiveMeetingStatus from '@/components/dashboard/LiveMeetingStatus';
import StatusDonut from '@/components/dashboard/StatusDonut';
import { useSupabaseAuth } from '@/lib/SupabaseAuthContext';
import { getMeetings, getMeetingStats, getWeeklyActivity } from '@/lib/meetings';
import { getRecentActionItems } from '@/lib/actionItems';
import { getUpcomingMeetings } from '@/lib/scheduledMeetings';
import { getAiInsights, getTeamActivity, getLiveStatus, getMeetingHealth, getStatusBreakdown } from '@/lib/insights';
import { CalendarDays, FileText, Mic, Clock, TrendingUp, CheckCircle } from 'lucide-react';

export default function Dashboard() {
  const { user } = useSupabaseAuth();
  const [meetings, setMeetings] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, processing: 0, totalMinutes: 0 });
  const [weeklyActivity, setWeeklyActivity] = useState(undefined);
  const [actionItems, setActionItems] = useState([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionItemsLoading, setActionItemsLoading] = useState(true);
  const [upcomingLoading, setUpcomingLoading] = useState(true);

  const [aiInsights, setAiInsights] = useState([]);
  const [aiInsightsLoading, setAiInsightsLoading] = useState(true);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [liveStatus, setLiveStatus] = useState({ active: [], startingSoon: [] });
  const [liveStatusLoading, setLiveStatusLoading] = useState(true);
  const [health, setHealth] = useState({ overall: 0, factors: [] });
  const [healthLoading, setHealthLoading] = useState(true);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [statusBreakdownLoading, setStatusBreakdownLoading] = useState(true);

  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  const load = async () => {
    if (!user) return;
    try {
      const [m, s, w] = await Promise.all([
        getMeetings(user.id),
        getMeetingStats(user.id),
        getWeeklyActivity(user.id),
      ]);
      setMeetings(m.slice(0, 5));
      setStats(s);
      setWeeklyActivity(w);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }

    try {
      const items = await getRecentActionItems(user.id, 10);
      setActionItems(items);
    } catch (e) {
      console.error(e);
    } finally {
      setActionItemsLoading(false);
    }

    try {
      const upcoming = await getUpcomingMeetings(user.id);
      setUpcomingMeetings(upcoming);
    } catch (e) {
      console.error(e);
    } finally {
      setUpcomingLoading(false);
    }

    try {
      setAiInsights(await getAiInsights(user.id));
    } catch (e) {
      console.error(e);
    } finally {
      setAiInsightsLoading(false);
    }

    try {
      setActivity(await getTeamActivity(user.id));
    } catch (e) {
      console.error(e);
    } finally {
      setActivityLoading(false);
    }

    try {
      setLiveStatus(await getLiveStatus(user.id));
    } catch (e) {
      console.error(e);
    } finally {
      setLiveStatusLoading(false);
    }

    try {
      setHealth(await getMeetingHealth(user.id));
    } catch (e) {
      console.error(e);
    } finally {
      setHealthLoading(false);
    }

    try {
      setStatusBreakdown(await getStatusBreakdown(user.id));
    } catch (e) {
      console.error(e);
    } finally {
      setStatusBreakdownLoading(false);
    }
  };

  const handleScheduled = (meeting) => {
    setUpcomingMeetings((prev) => [...prev, meeting].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)));
  };

  const handleMeetingUpdated = (meeting) => {
    setUpcomingMeetings((prev) =>
      prev.map((m) => (m.id === meeting.id ? meeting : m)).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    );
  };

  const handleMeetingDeleted = (id) => {
    setUpcomingMeetings((prev) => prev.filter((m) => m.id !== id));
  };

  const handleActionItemChange = (id, status) => {
    setActionItems((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)));
  };

  useEffect(() => { load(); }, [user]);

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="eyebrow mb-1">Command Center</p>
            <h1 className="text-white text-2xl font-heading font-semibold">Welcome back, {name}</h1>
            <p className="text-gray-400 text-sm mt-1">Here's the state of your meetings today.</p>
          </div>
          <div className="flex items-center gap-2 glass-card rounded-xl px-4 py-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-sm text-gray-300">All systems live</span>
          </div>
        </div>

        <LiveMeetingStatus active={liveStatus.active} startingSoon={liveStatus.startingSoon} loading={liveStatusLoading} />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <StatCard title="Total Meetings" value={stats.total} growth="All time" color="blue" icon={CalendarDays} loading={loading} />
          </div>
          <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <StatCard title="Completed" value={stats.completed} growth="Minutes generated" color="green" icon={CheckCircle} loading={loading} />
          </div>
          <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <StatCard title="Processing" value={stats.processing} growth="In progress" color="orange" icon={TrendingUp} loading={loading} />
          </div>
          <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <StatCard title="Audio Minutes" value={stats.totalMinutes} growth="Total recorded" color="purple" icon={Mic} loading={loading} />
          </div>
          <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <StatCard title="Documents" value={stats.completed} growth="Minutes generated" color="cyan" icon={FileText} loading={loading} />
          </div>
          <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <StatCard title="Avg Duration" value={stats.total ? `${Math.round(stats.totalMinutes / (stats.total || 1))} min` : '0 min'} growth="Per meeting" color="red" icon={Clock} loading={loading} />
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Charts + Health row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ActivityChart data={weeklyActivity} loading={loading} />
          </div>
          <div className="glass-card rounded-2xl p-6">
            <p className="eyebrow mb-1">Meeting Health Score</p>
            {healthLoading ? (
              <div className="skeleton h-40 rounded-xl mt-3" />
            ) : (
              <>
                <div className="flex items-end gap-2 mb-4">
                  <span className="text-white text-3xl font-heading font-semibold">{health.overall}</span>
                  <span className="text-emerald-400 text-sm font-medium mb-1">/ 100</span>
                </div>
                {health.factors.length === 0 ? (
                  <p className="text-gray-500 text-sm">Not enough data yet — the score will build up as meetings complete.</p>
                ) : (
                  <div className="space-y-3">
                    {health.factors.map(({ label, value }) => (
                      <div key={label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">{label}</span>
                          <span className="text-white font-medium">{value}%</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full" style={{ width: `${value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* AI Insights + Team Activity + Status breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <AiInsightsPanel insights={aiInsights} loading={aiInsightsLoading} />
          <TeamActivityFeed events={activity} loading={activityLoading} />
          <StatusDonut data={statusBreakdown} loading={statusBreakdownLoading} />
        </div>

        {/* Upcoming Meetings */}
        <div>
          <h2 className="text-white text-lg font-heading font-semibold mb-3">Upcoming Meetings</h2>
          <UpcomingMeetingsPanel
            meetings={upcomingMeetings}
            loading={upcomingLoading}
            user={user}
            onScheduled={handleScheduled}
            onUpdated={handleMeetingUpdated}
            onDeleted={handleMeetingDeleted}
          />
        </div>

        {/* Recent Meetings */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-heading font-semibold">Recent Meetings</h3>
              <p className="text-gray-500 text-sm">AI-generated meeting history</p>
            </div>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton h-12 rounded-xl" />
              ))}
            </div>
          ) : (
            <MeetingTable meetings={meetings} onDelete={load} />
          )}
        </div>

        {/* Action Items */}
        <div>
          <h2 className="text-white text-lg font-heading font-semibold mb-3">Pending Action Items</h2>
          <ActionItemsPanel
            items={actionItems}
            loading={actionItemsLoading}
            onChange={handleActionItemChange}
          />
        </div>
      </div>
    </AppLayout>
  );
}