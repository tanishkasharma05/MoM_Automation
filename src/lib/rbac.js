import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useSupabaseAuth } from './SupabaseAuthContext';

// Fetches (and subscribes to) the current user's profile — role +
// workspace — from the `profiles` table created by the Enterprise
// migration (supabase/migrations/0004_enterprise_rbac.sql).
export function useUserProfile() {
  const { user } = useSupabaseAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setProfile(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // Profile row may not exist yet (e.g. migration not run) —
          // fail open to 'member' rather than crashing the UI.
          setProfile({ role: 'member', workspace_id: null });
        } else {
          setProfile(data);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [user]);

  return { profile, loading, role: profile?.role || 'member', workspaceId: profile?.workspace_id || null };
}

export function isAtLeast(role, minRole) {
  const order = { member: 0, admin: 1, owner: 2 };
  return (order[role] ?? 0) >= (order[minRole] ?? 0);
}

// Writes an append-only audit log row. Never throws to the caller —
// audit logging should never block the primary action.
export async function logAudit({ actorId, workspaceId, action, targetType, targetId, metadata }) {
  try {
    await supabase.from('audit_logs').insert([{
      actor_id: actorId,
      workspace_id: workspaceId,
      action,
      target_type: targetType,
      target_id: targetId ? String(targetId) : null,
      metadata: metadata || null,
    }]);
  } catch (e) {
    console.error('audit log failed', e);
  }
}
