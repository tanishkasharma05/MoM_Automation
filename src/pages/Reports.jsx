import { useState, useEffect, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useSupabaseAuth } from '@/lib/SupabaseAuthContext';
import { getMeetings } from '@/lib/meetings';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download } from 'lucide-react';

const COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];

const RANGE_OPTIONS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: 'All', days: null },
];

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = ['title', 'department', 'status', 'duration_minutes', 'created_at'];
  const lines = [headers.join(',')];
  rows.forEach((m) => {
    const line = [
      m.title || '',
      m.department || '',
      m.status || '',
      Math.round((m.duration_seconds || 0) / 60),
      m.created_at || '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    lines.push(line);
  });
  return lines.join('\n');
}

function downloadCsv(rows) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `meetings-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { user } = useSupabaseAuth();
  const [allMeetings, setAllMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(30);

  useEffect(() => {
    if (!user) return;
    getMeetings(user.id).then(setAllMeetings).finally(() => setLoading(false));
  }, [user]);

  const meetings = useMemo(() => {
    if (!rangeDays) return allMeetings;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    return allMeetings.filter((m) => new Date(m.created_at) >= cutoff);
  }, [allMeetings, rangeDays]);

  const byDept = Object.entries(
    meetings.reduce((acc, m) => {
      const d = m.department || 'Unknown';
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const byStatus = [
    { name: 'Completed', value: meetings.filter(m => m.status === 'completed').length },
    { name: 'Processing', value: meetings.filter(m => m.status === 'processing').length },
    { name: 'Pending', value: meetings.filter(m => m.status === 'pending').length },
    { name: 'Failed', value: meetings.filter(m => m.status === 'failed').length },
  ].filter(s => s.value > 0);

  const total = meetings.length;
  const completed = meetings.filter(m => m.status === 'completed').length;
  const totalMins = meetings.reduce((s, m) => s + (m.duration_seconds || 0), 0) / 60;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm">
          <p className="text-gray-400">{label || payload[0].name}</p>
          <p className="text-blue-400 font-bold">{payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <AppLayout title="Reports">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-white text-xl font-bold">Analytics & Reports</h1>
            <p className="text-gray-400 text-sm">Meeting statistics and insights</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r.label}
                  onClick={() => setRangeDays(r.days)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    rangeDays === r.days ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => downloadCsv(meetings)}
              disabled={!meetings.length}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 hover:text-white text-xs font-semibold border border-gray-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Meetings', value: total },
            { label: 'Completed', value: completed },
            { label: 'Success Rate', value: total ? `${Math.round(completed / total * 100)}%` : '0%' },
            { label: 'Total Minutes', value: `${Math.round(totalMins)} min` },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-gray-400 text-sm">{s.label}</p>
              <p className="text-white text-2xl font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Department */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
            <h3 className="text-white font-semibold mb-1">Meetings by Department</h3>
            <p className="text-gray-500 text-sm mb-6">Distribution across teams</p>
            {byDept.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byDept} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59,130,246,0.05)' }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-sm py-10 text-center">No data yet</p>
            )}
          </div>

          {/* By Status */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
            <h3 className="text-white font-semibold mb-1">Status Breakdown</h3>
            <p className="text-gray-500 text-sm mb-6">Meeting processing outcomes</p>
            {byStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend formatter={(value) => <span className="text-gray-400 text-sm">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-sm py-10 text-center">No data yet</p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
