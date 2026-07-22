import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useSupabaseAuth } from '@/lib/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';
import { User, Lock, Bell, Shield, Loader2, CheckCircle } from 'lucide-react';

export default function Settings() {
  const { user } = useSupabaseAuth();
  const [tab, setTab] = useState('profile');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const saveProfile = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: fullName } });
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const savePassword = async () => {
    if (!newPassword || newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword(''); setCurrentPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <AppLayout title="Settings">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-white text-xl font-bold">Settings</h1>
          <p className="text-gray-400 text-sm">Manage your account and preferences</p>
        </div>

        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => { setTab(t.id); setError(''); setSaved(false); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>}
        {saved && <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2"><CheckCircle className="w-4 h-4" />Changes saved successfully!</div>}

        {tab === 'profile' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
            <h3 className="text-white font-semibold">Profile Settings</h3>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                {fullName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
              </div>
              <div>
                <p className="text-white font-medium">{fullName || 'User'}</p>
                <p className="text-gray-400 text-sm">{email}</p>
              </div>
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">Full Name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">Email Address</label>
              <input value={email} disabled
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-gray-500 text-sm cursor-not-allowed" />
              <p className="text-gray-600 text-xs mt-1">Email cannot be changed here</p>
            </div>
            <button onClick={saveProfile} disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save Changes
            </button>
          </div>
        )}

        {tab === 'security' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
            <h3 className="text-white font-semibold">Change Password</h3>
            <div>
              <label className="text-gray-400 text-sm mb-1.5 block">New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 6 chars)"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <button onClick={savePassword} disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Update Password
            </button>
          </div>
        )}

        {tab === 'notifications' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-white font-semibold">Notification Preferences</h3>
            {[
              { label: 'MoM Ready', desc: 'Notify when AI finishes generating minutes' },
              { label: 'Upload Complete', desc: 'Notify when audio upload is done' },
              { label: 'Processing Failed', desc: 'Alert on transcription errors' },
            ].map(n => (
              <div key={n.label} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-white text-sm font-medium">{n.label}</p>
                  <p className="text-gray-500 text-xs">{n.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-700 peer-checked:bg-blue-600 rounded-full peer transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-5 after:h-5 after:bg-white after:rounded-full after:transition-all peer-checked:after:translate-x-5" />
                </label>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}