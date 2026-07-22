import { Users } from 'lucide-react';

function initialsOf(nameOrEmail) {
  const base = nameOrEmail.split('@')[0].replace(/[._]/g, ' ');
  return base.split(' ').filter(Boolean).map((p) => p[0]).join('').toUpperCase().slice(0, 2) || '?';
}

export default function AttendeeRoster({ attendees = [] }) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-indigo-400" />
        <h3 className="text-white font-heading font-semibold">Attendance</h3>
        <span className="bg-indigo-500/10 text-indigo-400 text-xs px-2 py-0.5 rounded-full">{attendees.length}</span>
      </div>
      {attendees.length === 0 ? (
        <p className="text-gray-500 text-sm">No attendees recorded for this meeting.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {attendees.map((a, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-xl pl-1.5 pr-3 py-1.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                {initialsOf(a)}
              </div>
              <span className="text-sm text-gray-300 truncate max-w-[160px]">{a}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
