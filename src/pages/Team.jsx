import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/lib/SupabaseAuthContext';
import { updateTeamMemberRole, removeTeamMember } from '@/lib/team';
import { useUserProfile, logAudit } from '@/lib/rbac';
import { Users, Mail, Shield, UserPlus, Loader2, Trash2, ChevronDown } from 'lucide-react';

const ROLES = ['member', 'admin'];

export default function Team() {
  const { user } = useSupabaseAuth();
  const { workspaceId } = useUserProfile();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);

  const reload = async () => {
    const { data } = await supabase.from('team_members').select('*').order('email');
    setMembers(data || []);
  };

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const inviteMember = async () => {
    if (!inviteEmail) return;
    setInviting(true); setMessage('');
    try {
      const { error } = await supabase.from('team_members').insert([{
        email: inviteEmail, invited_by: user.id, role: 'member', status: 'invited'
      }]);
      if (error) throw error;

      const inviterName = user?.user_metadata?.full_name || user?.email;
      const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: { email: inviteEmail, inviterName, role: 'member' },
      });

      if (emailError) {
        setMessage('Invite saved, but the email failed to send. They can still be added manually.');
      } else {
        setMessage('Invitation sent!');
      }

      setInviteEmail('');
      await reload();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (member, role) => {
    if (role === member.role) return;
    setBusyId(member.id);
    try {
      await updateTeamMemberRole(member.id, role);
      await logAudit({
        actorId: user.id, workspaceId, action: 'role_change',
        targetType: 'team_member', targetId: member.id,
        metadata: { email: member.email, from: member.role, to: role },
      });
      await reload();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (member) => {
    setBusyId(member.id);
    try {
      await removeTeamMember(member.id);
      await logAudit({
        actorId: user.id, workspaceId, action: 'member_removed',
        targetType: 'team_member', targetId: member.id,
        metadata: { email: member.email },
      });
      await reload();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AppLayout title="Team">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-white text-xl font-bold">Team Management</h1>
          <p className="text-gray-400 text-sm">Manage team members and permissions</p>
        </div>

        {/* Invite */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><UserPlus className="w-5 h-5 text-blue-400" /> Invite Member</h3>
          {message && <div className="bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm rounded-xl px-4 py-3">{message}</div>}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com" type="email"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <button onClick={inviteMember} disabled={inviting || !inviteEmail}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-5 py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
              {inviting && <Loader2 className="w-4 h-4 animate-spin" />} Invite
            </button>
          </div>
        </div>

        {/* Members list */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 sm:p-6">
          <h3 className="text-white font-semibold flex items-center gap-2 mb-4"><Users className="w-5 h-5 text-blue-400" /> Team Members</h3>
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : members.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No team members yet. Invite someone!</p>
          ) : (
            <div className="space-y-3">
              {members.map(m => (
                <div key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 bg-gray-800 rounded-xl">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {m.email?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{m.email}</p>
                      <p className="text-gray-500 text-xs">{m.status === 'invited' ? 'Invitation pending' : 'Active'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="relative">
                      <select
                        value={m.role}
                        disabled={busyId === m.id}
                        onChange={(e) => changeRole(m, e.target.value)}
                        className="appearance-none flex items-center gap-1 pl-8 pr-7 py-1.5 rounded-full text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer"
                      >
                        {ROLES.map((r) => <option key={r} value={r} className="bg-gray-900 text-white">{r}</option>)}
                      </select>
                      <Shield className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
                      <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
                    </div>
                    <button
                      onClick={() => remove(m)}
                      disabled={busyId === m.id}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                      aria-label="Remove member"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
