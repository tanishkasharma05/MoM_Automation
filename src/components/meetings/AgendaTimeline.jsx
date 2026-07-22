import { ListTree } from 'lucide-react';

export default function AgendaTimeline({ points = [] }) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <ListTree className="w-4 h-4 text-indigo-400" />
        <h3 className="text-white font-heading font-semibold">Agenda</h3>
      </div>
      {points.length === 0 ? (
        <p className="text-gray-500 text-sm">No agenda items captured for this meeting.</p>
      ) : (
        <ol className="relative space-y-5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-white/[0.08]">
          {points.map((point, i) => (
            <li key={i} className="relative flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-indigo-500/15 ring-1 ring-indigo-500/30 text-indigo-300 flex items-center justify-center text-[11px] font-bold flex-shrink-0 z-10">
                {i + 1}
              </span>
              <p className="text-sm text-gray-300 pt-0.5">{point}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
