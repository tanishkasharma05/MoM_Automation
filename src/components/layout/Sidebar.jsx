import { Link, useLocation } from 'react-router-dom';
import { useSupabaseAuth } from '@/lib/SupabaseAuthContext';
import { useUserProfile, isAtLeast } from '@/lib/rbac';
import BrandMark from '@/components/BrandMark';
import {
  LayoutDashboard, Upload, Mic, Bot, ClipboardList,
  Users, BarChart2, Settings, LogOut, X, TrendingUp, CalendarDays, ShieldCheck, StickyNote
} from 'lucide-react';

const menuItems = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Upload Audio', href: '/upload', icon: Upload },
  { title: 'Live Recording', href: '/recording', icon: Mic },
  { title: 'AI Notes', href: '/notes', icon: StickyNote },
  { title: 'Meetings', href: '/meetings', icon: ClipboardList },
  { title: 'AI Processing', href: '/processing', icon: Bot },
  { title: 'Calendar', href: '/calendar', icon: CalendarDays },
  { title: 'Analytics', href: '/analytics', icon: TrendingUp },
  { title: 'Team', href: '/team', icon: Users },
  { title: 'Reports', href: '/reports', icon: BarChart2 },
  { title: 'Audit Log', href: '/audit', icon: ShieldCheck, minRole: 'admin' },
  { title: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar({ open = false, onClose = () => {} }) {
  const location = useLocation();
  const { user, signOut } = useSupabaseAuth();
  const { role } = useUserProfile();
  const visibleItems = menuItems.filter((item) => !item.minRole || isAtLeast(role, item.minRole));

  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <>
      {/* Mobile/tablet backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed left-0 top-0 h-full w-64 bg-gray-950/95 lg:bg-gray-950/80 glass-card border-r border-white/[0.06] flex flex-col z-50 transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark />
            <div className="min-w-0">
              <h1 className="text-white font-heading font-semibold text-[15px] leading-tight tracking-tight truncate">Digital Meeting<br />Controller</h1>
              <p className="eyebrow mt-1">Command Center</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={`relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/25'
                    : 'text-gray-400 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full bg-cyan-400" />}
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-white' : ''}`} />
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 ring-2 ring-gray-900 flex items-center justify-center text-white text-sm font-bold shadow-md flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{name}</p>
              <p className="text-gray-500 text-xs truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-gray-400 hover:bg-white/[0.05] hover:text-rose-400 text-sm font-medium transition-all"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>
    </>
  );
}
