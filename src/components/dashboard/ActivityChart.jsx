import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

const EMPTY_WEEK = [
  { day: 'Mon', meetings: 0 },
  { day: 'Tue', meetings: 0 },
  { day: 'Wed', meetings: 0 },
  { day: 'Thu', meetings: 0 },
  { day: 'Fri', meetings: 0 },
  { day: 'Sat', meetings: 0 },
  { day: 'Sun', meetings: 0 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-gray-900 border border-white/[0.08] rounded-xl px-3 py-2 text-sm shadow-xl">
        <p className="text-gray-400">{label}</p>
        <p className="text-cyan-400 font-semibold">{payload[0].value} meetings</p>
      </div>
    );
  }
  return null;
};

export default function ActivityChart({ data = EMPTY_WEEK, loading }) {
  return (
    <div className="glass-card rounded-2xl p-6 h-full">
      <h3 className="text-white font-heading font-semibold mb-1">Meeting Activity</h3>
      <p className="text-gray-500 text-sm mb-6">Meetings conducted this week</p>
      {loading ? (
        <div className="skeleton h-[200px] rounded-xl" />
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="day" stroke="#6b7280" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79,70,229,0.08)' }} />
            <Bar dataKey="meetings" fill="url(#brandGrad)" radius={[6, 6, 0, 0]} />
            <defs>
              <linearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22D3EE" />
                <stop offset="100%" stopColor="#4F46E5" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
