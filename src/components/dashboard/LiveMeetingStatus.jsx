import { Radio, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export default function LiveMeetingStatus({ active = [], startingSoon = [], loading }) {
  if (loading) return <div className="skeleton h-14 rounded-2xl" />;
  if (active.length === 0 && startingSoon.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center gap-3">
      {active.map((m) => (
        <Link
          key={m.id}
          to={`/meetings/${m.id}`}
          className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/25 rounded-xl px-3 py-2 hover:bg-cyan-500/15 transition-colors"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
          </span>
          <Radio className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-sm text-cyan-200 font-medium">Processing "{m.title}"</span>
        </Link>
      ))}
      {startingSoon.map((m) => (
        <div key={m.id} className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-sm text-amber-200 font-medium">"{m.title}" starts at {format(new Date(m.scheduled_at), 'h:mm a')}</span>
        </div>
      ))}
    </div>
  );
}
