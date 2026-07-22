import { Toaster } from "@/components/ui/toaster";
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { SupabaseAuthProvider, useSupabaseAuth } from '@/lib/SupabaseAuthContext';
import ScrollToTop from './components/ScrollToTop';
import ErrorBoundary from './components/ErrorBoundary';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Meetings from './pages/Meetings';
import MeetingDetail from './pages/MeetingDetail';
import Recording from './pages/Recording';
import Processing from './pages/Processing';
import Reports from './pages/Reports';
import Team from './pages/Team';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import Calendar from './pages/Calendar';
import AuditLog from './pages/AuditLog';
import RequireRole from './components/layout/RequireRole';

function SupabaseProtectedRoute({ children }) {
  const { user, loading } = useSupabaseAuth();
  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
      <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

const AuthenticatedApp = () => {
  return (
    <SupabaseAuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<SupabaseProtectedRoute><Dashboard /></SupabaseProtectedRoute>} />
        <Route path="/upload" element={<SupabaseProtectedRoute><Upload /></SupabaseProtectedRoute>} />
        <Route path="/meetings" element={<SupabaseProtectedRoute><Meetings /></SupabaseProtectedRoute>} />
        <Route path="/meetings/:id" element={<SupabaseProtectedRoute><MeetingDetail /></SupabaseProtectedRoute>} />
        <Route path="/recording" element={<SupabaseProtectedRoute><Recording /></SupabaseProtectedRoute>} />
        <Route path="/processing" element={<SupabaseProtectedRoute><Processing /></SupabaseProtectedRoute>} />
        <Route path="/reports" element={<SupabaseProtectedRoute><Reports /></SupabaseProtectedRoute>} />
        <Route path="/analytics" element={<SupabaseProtectedRoute><Analytics /></SupabaseProtectedRoute>} />
        <Route path="/calendar" element={<SupabaseProtectedRoute><Calendar /></SupabaseProtectedRoute>} />
        <Route path="/team" element={<SupabaseProtectedRoute><Team /></SupabaseProtectedRoute>} />
        <Route path="/audit" element={<SupabaseProtectedRoute><RequireRole min="admin"><AuditLog /></RequireRole></SupabaseProtectedRoute>} />
        <Route path="/settings" element={<SupabaseProtectedRoute><Settings /></SupabaseProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </SupabaseAuthProvider>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;