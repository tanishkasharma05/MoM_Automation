import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useSupabaseAuth } from '@/lib/SupabaseAuthContext';
import { getMeetingsTrend, getDepartmentBreakdown, getActionItemThroughput, getDurationStats } from '@/lib/analytics';
import { getMeetingHealth } from '@/lib/insights';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import { Clock, TrendingUp, TrendingDown, Minus, Timer, CheckSquare } from 'lucide-react';

const RANGE_OPTIONS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

function ChartTooltip({ active, payload, label }) {
  if (!(active && payload?.length)) return null;
  return (
    <div className="bg-gray-900 border border-white/[0.08] rounded-xl px-3 py-2 text-sm shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color || p.fill }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, loading }) {
  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-5 h-[100px]">
        <div className="skeleton h-3 w-24 mb-3 rounded" />
        <div className="skeleton h-6 w-16 rounded" />
      </div>
    );
  }
  return (
    <div className="glass-card rounded-2xl p-5 flex items-center justify-between shadow-lg shadow-black/20">
      <div className="min-w-0">
        <p className="eyebrow mb-1.5 truncate">{label}</p>
        <p className="text-white text-2xl font-heading font-semibold tracking-tight">{value}</p>
        {sub && <p className="text-gray-500 text-xs mt-1 truncate">{sub}</p>}
      </div>
      {Icon && (
        <div className="w-11 h-11 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}

export default function Analytics() {
  const { user } = useSupabaseAuth();
  const [rangeDays, setRangeDays] = useState(30);
  const [trend, setTrend] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [throughput, setThroughput] = useState([]);
  const [duration, setDuration] = useState(null);
  const [health, setHealth] = useState({ overall: 0, factors: [] });
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getMeetingsTrend(user.id, rangeDays),
      getDepartmentBreakdown(user.id),
      getActionItemThroughput(user.id),
      getDurationStats(user.id),
      getMeetingHealth(user.id),
    ])
      .then(([t, d, a, dur, h]) => {
        if (cancelled) return;
        setTrend(t);
        setDepartments(d);
        setThroughput(a);
        setDuration(dur);
        setHealth(h);
      })
      .catch((e) => console.error(e))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [user, rangeDays]);

  const totalMeetings = trend.reduce((s, t) => s + t.meetings, 0);
  const totalMinutes = trend.reduce((s, t) => s + t.minutes, 0);
  const deptRows = selectedDept ? departments.filter((d) => d.name === selectedDept) : departments;

  const WowIcon = duration?.weekOverWeekPct == null ? Minus : duration.weekOverWeekPct >= 0 ? TrendingUp : TrendingDown;
  const wowColor = duration?.weekOverWeekPct == null ? 'text-gray-400' : duration.weekOverWeekPct >= 0 ? 'text-emerald-400' : 'text-rose-400';

  return (
    <AppLayout title="Analytics">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header + range control */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-white font-heading font-semibold text-xl">Meeting Analytics</h1>
            <p className="text-gray-500 text-sm mt-1">Trends, throughput, and team breakdowns</p>
          </div>
          <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1 self-start sm:self-auto">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r.days}
                onClick={() => setRangeDays(r.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  rangeDays === r.days ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Meetings" value={totalMeetings} sub={`in last ${rangeDays}d`} icon={CheckSquare} loading={loading} />
          <KpiCard label="Total Minutes" value={totalMinutes} sub={`in last ${rangeDays}d`} icon={Clock} loading={loading} />
          <KpiCard
            label="Avg Duration"
            value={duration ? `${duration.avgMinutes}m` : '—'}
            sub={duration?.weekOverWeekPct != null ? `${duration.weekOverWeekPct > 0 ? '+' : ''}${duration.weekOverWeekPct}% wow` : 'no prior week data'}
            icon={Timer}
            loading={loading}
          />
          <KpiCard label="Meeting Health" value={`${health.overall}%`} sub="composite score" icon={WowIcon} loading={loading} />
        </div>

        {/* Trend chart */}
        <div className="glass-card rounded-2xl p-4 sm:p-6">
          <h3 className="text-white font-heading font-semibold mb-1">Meetings &amp; Minutes Over Time</h3>
          <p className="text-gray-500 text-sm mb-6">Daily volume across the selected range</p>
          {loading ? (
            <div className="skeleton h-[260px] rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="meetingsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#4F46E5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="minutesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" stroke="#6b7280" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                <Area type="monotone" dataKey="meetings" name="Meetings" stroke="#4F46E5" fill="url(#meetingsGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="minutes" name="Minutes" stroke="#22D3EE" fill="url(#minutesGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department breakdown with drill-down */}
          <div className="glass-card rounded-2xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-white font-heading font-semibold">By Department</h3>
              {selectedDept && (
                <button onClick={() => setSelectedDept(null)} className="text-xs text-indigo-400 hover:text-indigo-300">
                  Clear filter
                </button>
              )}
            </div>
            <p className="text-gray-500 text-sm mb-6">Click a bar to filter the table below</p>
            {loading ? (
              <div className="skeleton h-[220px] rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={departments} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="#6b7280" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(79,70,229,0.08)' }} />
                  <Bar
                    dataKey="meetings"
                    name="Meetings"
                    radius={[0, 6, 6, 0]}
                    fill="#4F46E5"
                    onClick={(d) => setSelectedDept((cur) => (cur === d.name ? null : d.name))}
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}

            {!loading && (
              <div className="mt-4 -mx-2 overflow-x-auto">
                <table className="w-full text-sm min-w-[420px]">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase tracking-wide">
                      <th className="text-left font-medium px-2 py-2">Department</th>
                      <th className="text-right font-medium px-2 py-2">Meetings</th>
                      <th className="text-right font-medium px-2 py-2">Minutes</th>
                      <th className="text-right font-medium px-2 py-2">Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptRows.map((d) => (
                      <tr key={d.name} className="border-t border-white/[0.05] text-gray-300">
                        <td className="px-2 py-2 font-medium text-white">{d.name}</td>
                        <td className="px-2 py-2 text-right">{d.meetings}</td>
                        <td className="px-2 py-2 text-right">{d.minutes}</td>
                        <td className="px-2 py-2 text-right">{d.completed}</td>
                      </tr>
                    ))}
                    {!deptRows.length && (
                      <tr><td colSpan={4} className="px-2 py-6 text-center text-gray-500">No data yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action item throughput by assignee */}
          <div className="glass-card rounded-2xl p-4 sm:p-6">
            <h3 className="text-white font-heading font-semibold mb-1">Action Item Throughput</h3>
            <p className="text-gray-500 text-sm mb-6">Completion rate by assignee</p>
            {loading ? (
              <div className="skeleton h-[220px] rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={throughput} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(34,211,238,0.08)' }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                  <Bar dataKey="done" name="Done" stackId="a" fill="#34D399" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="open" name="Open" stackId="a" fill="#FBBF24" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {!loading && !throughput.length && (
              <p className="text-center text-gray-500 text-sm py-6">No action items yet</p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
