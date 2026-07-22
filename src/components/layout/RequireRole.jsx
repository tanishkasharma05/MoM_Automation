import { Navigate } from 'react-router-dom';
import { useUserProfile, isAtLeast } from '@/lib/rbac';
import { ShieldAlert } from 'lucide-react';

// Wrap a route element to gate it behind a minimum role, e.g.:
//   <Route path="/audit" element={<RequireRole min="admin"><AuditLog /></RequireRole>} />
export default function RequireRole({ min = 'admin', children, redirectTo = '/dashboard' }) {
  const { role, loading } = useUserProfile();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAtLeast(role, min)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

// Small inline banner variant for sections within a shared page rather
// than gating the whole route.
export function RoleGate({ min = 'admin', children, fallback = null }) {
  const { role, loading } = useUserProfile();
  if (loading) return null;
  if (!isAtLeast(role, min)) return fallback;
  return children;
}

export function InsufficientRoleNotice() {
  return (
    <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
      <ShieldAlert className="w-4 h-4 flex-shrink-0" />
      You need admin access to view this section.
    </div>
  );
}
