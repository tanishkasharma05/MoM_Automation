import { Navigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/lib/SupabaseAuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useSupabaseAuth();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
}