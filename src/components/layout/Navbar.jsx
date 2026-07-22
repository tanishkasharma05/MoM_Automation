import { Bell, Search, Menu } from 'lucide-react';
import { useSupabaseAuth } from '@/lib/SupabaseAuthContext';

export default function Navbar({ title, onMenuClick = () => {} }) {
  const { user } = useSupabaseAuth();
  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <header className="h-16 bg-gray-950/70 glass-card border-b border-white/[0.06] flex items-center justify-between px-3 sm:px-6 flex-shrink-0 gap-2">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden flex-shrink-0 w-9 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white transition-all border border-white/[0.06]"
          aria-label="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>
        <h2 className="text-white font-heading font-semibold text-base sm:text-lg tracking-tight truncate">{title}</h2>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search meetings, tasks, people…"
            className="bg-white/[0.04] text-gray-300 placeholder-gray-500 text-sm pl-9 pr-4 py-2 rounded-xl border border-white/[0.08] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 w-56 lg:w-64 transition-all"
          />
        </div>
        <button className="relative w-9 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-gray-400 hover:text-white transition-all border border-white/[0.06] flex-shrink-0">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-cyan-400 rounded-full ring-2 ring-gray-950" />
        </button>
        <div className="flex items-center gap-2 pl-2 sm:pl-3 sm:border-l border-white/[0.08]">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 ring-2 ring-gray-900 flex items-center justify-center text-white text-sm font-bold shadow-md flex-shrink-0">
            {initials}
          </div>
          <div className="hidden md:block">
            <p className="text-white text-sm font-semibold">{name}</p>
            <p className="text-gray-500 text-xs">Administrator</p>
          </div>
        </div>
      </div>
    </header>
  );
}
