import { Link } from 'react-router-dom';
import { Upload, Mic, Bot, FileText, UserPlus } from 'lucide-react';

const actions = [
  { title: 'Upload Audio', description: 'Upload meeting audio files', icon: Upload, color: 'from-blue-500 to-blue-700', href: '/upload' },
  { title: 'Live Recording', description: 'Start recording a meeting', icon: Mic, color: 'from-green-500 to-green-700', href: '/recording' },
  { title: 'Generate MoM', description: 'Generate AI meeting minutes', icon: Bot, color: 'from-purple-500 to-purple-700', href: '/processing' },
  { title: 'All Meetings', description: 'View meeting history', icon: FileText, color: 'from-red-500 to-red-700', href: '/meetings' },
  { title: 'Invite Team', description: 'Add new team members', icon: UserPlus, color: 'from-orange-500 to-orange-700', href: '/team' },
];

export default function QuickActions() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h3 className="text-white font-semibold mb-1">Quick Actions</h3>
      <p className="text-gray-500 text-sm mb-5">Frequently used actions</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              to={action.href}
              className="flex flex-col items-center gap-3 p-4 bg-gray-800 hover:bg-gray-750 rounded-xl border border-gray-700 hover:border-gray-600 transition-all group text-center"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white text-xs font-medium">{action.title}</p>
                <p className="text-gray-500 text-xs mt-0.5">{action.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}