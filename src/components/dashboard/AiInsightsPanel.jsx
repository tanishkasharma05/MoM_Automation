import { AlertTriangle, ArrowUpRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AiInsightsPanel({ insights = [], loading }) {
  return (
    <div className="glass-card rounded-2xl p-6 h-full">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-indigo-400" />
        <h3 className="text-white font-heading font-semibold">AI Insights</h3>
      </div>
      <p className="text-gray-500 text-sm mb-4">Risks and follow-ups surfaced from recent minutes</p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : insights.length === 0 ? (
        <div className="text-center py-8">
          <Sparkles className="w-8 h-8 text-gray-700 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No AI insights yet. They'll appear here once meetings are processed.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {insights.map((item, i) => (
            <Link
              key={i}
              to={`/meetings/${item.meetingId}`}
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.05] transition-colors group"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                item.type === 'risk' ? 'bg-rose-500/15 text-rose-400' : 'bg-cyan-500/15 text-cyan-400'
              }`}>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-300 line-clamp-2">{item.text}</p>
                <p className="text-xs text-gray-600 mt-0.5 truncate">{item.meetingTitle}</p>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-400 flex-shrink-0 mt-1 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
