import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Circle, User, CalendarDays } from 'lucide-react';
import { setActionItemStatus } from '@/lib/actionItems';

export default function ActionItemsPanel({ items, loading, onChange }) {
  const [pendingIds, setPendingIds] = useState(new Set());
  const [filter, setFilter] = useState('all');

  const toggle = async (item) => {
    const nextStatus = item.status === 'completed' ? 'pending' : 'completed';
    setPendingIds((prev) => new Set(prev).add(item.id));
    try {
      await setActionItemStatus(item.id, nextStatus);
      onChange?.(item.id, nextStatus);
    } catch (e) {
      console.error('Failed to update action item:', e);
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const total = items.length;
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const filteredItems = items.filter((i) => {
    if (filter === 'pending') return i.status !== 'completed';
    if (filter === 'completed') return i.status === 'completed';
    return true;
  });

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'completed', label: 'Completed' },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-semibold">Action Items Tracker</h3>
          <span className="bg-blue-500/10 text-blue-400 text-xs px-2 py-0.5 rounded-full">{completedCount}/{total}</span>
        </div>
        <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filter === t.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {total > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>Completion progress</span>
            <span className="text-white font-medium">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <p className="text-gray-500 text-sm py-6 text-center">
          {total === 0
            ? "No action items yet — they'll show up here once a meeting is processed."
            : `No ${filter} items.`}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isDone = item.status === 'completed';
            const isBusy = pendingIds.has(item.id);
            return (
              <div key={item.id} className="flex items-start gap-3 bg-gray-800/60 rounded-xl p-3">
                <button
                  onClick={() => toggle(item)}
                  disabled={isBusy}
                  className="mt-0.5 flex-shrink-0 disabled:opacity-50"
                  aria-label={isDone ? 'Mark as pending' : 'Mark as completed'}
                >
                  {isDone ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-600 hover:text-gray-400 transition-colors" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm ${isDone ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                      {item.text}
                    </p>
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        isDone
                          ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                          : 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                      }`}
                    >
                      {isDone ? 'completed' : 'pending'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                    {item.assignee && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" /> {item.assignee}
                      </span>
                    )}
                    {item.due_date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> {item.due_date}
                      </span>
                    )}
                    {item.meetings?.title && (
                      <Link
                        to={`/meetings/${item.meeting_id}`}
                        className="text-blue-400/80 hover:text-blue-400 truncate"
                      >
                        {item.meetings.title}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
