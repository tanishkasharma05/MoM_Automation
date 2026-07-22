import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { supabase } from '@/lib/supabase';
import { useUserProfile } from '@/lib/rbac';
import { ClipboardList, ShieldCheck, UserMinus, KeyRound, Trash2 } from 'lucide-react';

const ACTION_ICON = {
  role_change: KeyRound,
  member_removed: UserMinus,
  meeting_deleted: Trash2,
};

function ActionIcon({ action }) {
  const Icon = ACTION_ICON[action] || ShieldCheck;
  return <Icon className="w-4 h-4" />;
}

export default function AuditLog() {
  const { workspaceId } = useUserProfile();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) { setLoading(false); return; }
    let cancelled = false;
    supabase
      .from('audit_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error(error);
        setLogs(data || []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [workspaceId]);

  return (
    <AppLayout title="Audit Log">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-white font-heading font-semibold text-xl flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-400" /> Audit Log
          </h1>
          <p className="text-gray-500 text-sm mt-1">Sensitive actions across your workspace — visible to admins and owners only</p>
        </div>

        <div className="glass-card rounded-2xl p-4 sm:p-6">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
            </div>
          ) : !workspaceId ? (
            <p className="text-gray-500 text-sm text-center py-8">
              No workspace found on your profile yet — run the Enterprise migration and refresh.
            </p>
          ) : logs.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">No audited actions yet.</p>
          ) : (
            <div className="space-y-2 -mx-2">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-2 py-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ActionIcon action={log.action} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">
                      {log.action.replace(/_/g, ' ')}
                      {log.target_type ? ` — ${log.target_type} ${log.target_id || ''}` : ''}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
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
