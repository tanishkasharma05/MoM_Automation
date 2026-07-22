import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.length) {
    const p = payload[0];
    return (
      <div className="bg-gray-900 border border-white/[0.08] rounded-xl px-3 py-2 text-sm shadow-xl">
        <p className="text-gray-300">{p.name}: <span className="font-semibold text-white">{p.value}</span></p>
      </div>
    );
  }
  return null;
};

export default function StatusDonut({ data = [], loading }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="glass-card rounded-2xl p-6 h-full flex flex-col">
      <p className="eyebrow mb-1">Meeting Status</p>
      <p className="text-gray-500 text-sm mb-2">Breakdown across all meetings</p>
      {loading ? (
        <div className="skeleton flex-1 rounded-xl min-h-[160px]" />
      ) : total === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">No meetings yet</div>
      ) : (
        <div className="flex-1 flex items-center gap-4">
          <div className="w-28 h-28 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={34} outerRadius={52} paddingAngle={3} stroke="none">
                  {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 flex-1 min-w-0">
            {data.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-400">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  {d.name}
                </span>
                <span className="text-white font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
