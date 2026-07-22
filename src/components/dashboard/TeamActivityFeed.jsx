import { CheckCircle2, FileText, Loader2, ListTodo } from 'lucide-react';

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const iconFor = (event) => {
  if (event.kind === 'action_item') return event.label.startsWith('New') ? ListTodo : CheckCircle2;
  if (event.label.startsWith('Processing')) return Loader2;
  return FileText;
};

export default function TeamActivityFeed({ events = [], loading }) {
  return (
    <div className="glass-card rounded-2xl p-6 h-full">
      <h3 className="text-white font-heading font-semibold mb-1">Team Activity</h3>
      <p className="text-gray-500 text-sm mb-4">Live feed of meetings and action items</p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded-xl" />)}
        </div>
      ) : events.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No activity yet.</p>
      ) : (
        <ol className="relative space-y-4 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-px before:bg-white/[0.08]">
          {events.map((event) => {
            const Icon = iconFor(event);
            return (
              <li key={event.id} className="relative flex items-start gap-3 pl-0">
                <div className="w-7 h-7 rounded-full bg-gray-900 ring-1 ring-white/[0.08] flex items-center justify-center flex-shrink-0 z-10">
                  <Icon className={`w-3.5 h-3.5 text-indigo-400 ${event.label.startsWith('Processing') ? 'animate-spin' : ''}`} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm text-gray-300 leading-snug">{event.label}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{timeAgo(event.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
