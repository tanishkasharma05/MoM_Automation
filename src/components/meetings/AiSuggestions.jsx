import { Sparkles, AlertTriangle, ArrowRightCircle, Flag } from 'lucide-react';

function Group({ icon: Icon, title, items, tone }) {
  const toneMap = {
    indigo: 'bg-indigo-500/15 text-indigo-400',
    rose: 'bg-rose-500/15 text-rose-400',
    cyan: 'bg-cyan-500/15 text-cyan-400',
  };
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <h4 className="text-white text-sm font-semibold">{title}</h4>
      </div>
      {items.length === 0 ? (
        <p className="text-gray-500 text-sm pl-9">Nothing flagged here.</p>
      ) : (
        <ul className="space-y-2 pl-9">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-gray-300 flex gap-2">
              <span className="text-gray-600">—</span> {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AiSuggestions({ mom }) {
  return (
    <div className="glass-card rounded-2xl p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-400" />
        <h3 className="text-white font-heading font-semibold">AI Suggestions</h3>
      </div>
      <Group icon={ArrowRightCircle} title="Recommended Next Steps" items={mom.next_steps || []} tone="cyan" />
      <Group icon={AlertTriangle} title="Risks & Concerns" items={mom.risks_concerns || []} tone="rose" />
      <Group icon={Flag} title="Follow-up Recommendations" items={mom.follow_up_items || []} tone="indigo" />
    </div>
  );
}
