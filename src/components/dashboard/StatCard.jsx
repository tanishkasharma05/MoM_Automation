export default function StatCard({ title, value, growth, color, icon: Icon, loading }) {
  const stripMap = {
    blue: 'bg-indigo-500',
    purple: 'bg-violet-500',
    green: 'bg-emerald-500',
    orange: 'bg-amber-500',
    red: 'bg-rose-500',
    cyan: 'bg-cyan-500',
  };
  const iconBg = {
    blue: 'bg-indigo-500/15 text-indigo-400',
    purple: 'bg-violet-500/15 text-violet-400',
    green: 'bg-emerald-500/15 text-emerald-400',
    orange: 'bg-amber-500/15 text-amber-400',
    red: 'bg-rose-500/15 text-rose-400',
    cyan: 'bg-cyan-500/15 text-cyan-400',
  };

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-5 h-[92px]">
        <div className="skeleton h-3 w-20 mb-3 rounded" />
        <div className="skeleton h-6 w-14 rounded" />
      </div>
    );
  }

  return (
    <div className="relative glass-card rounded-2xl p-5 flex items-center justify-between shadow-lg shadow-black/20 hover:bg-white/[0.05] transition-colors overflow-hidden group">
      <span className={`absolute left-0 top-0 h-full w-1 ${stripMap[color]}`} />
      <div className="pl-2">
        <p className="eyebrow mb-1.5">{title}</p>
        <p className="text-white text-2xl font-heading font-semibold tracking-tight">{value}</p>
        <p className="text-gray-500 text-xs mt-1">{growth}</p>
      </div>
      <div className={`w-11 h-11 rounded-xl ${iconBg[color]} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}
