import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ContributorDashboard from './pages/ContributorDashboard';
import ValidatorDashboard from './pages/ValidatorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import TaskDetail from './pages/TaskDetail';
import SubmissionHistory from './pages/SubmissionHistory';
import WalletPage from './pages/WalletPage';
import AdminTasks from './pages/AdminTasks';
import AdminUsers from './pages/AdminUsers';
import AdminSubmissions from './pages/AdminSubmissions';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
    mutations: { retry: 0 },
  },
});

// ── Protected route wrapper ───────────────────────────────────────────────────
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
};

// ── Smart home redirect based on role ────────────────────────────────────────
const HomeRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const paths = { admin: '/admin', validator: '/validator', contributor: '/dashboard' };
  return <Navigate to={paths[user.role] || '/dashboard'} replace />;
};

function AppRoutes() {
  return (
    <Routes>
    
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Smart redirect */}
      <Route path="/" element={<HomeRedirect />} />

      {/* Contributor routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute roles={['contributor']}>
          <ContributorDashboard />
        </ProtectedRoute>
      } />
      <Route path="/tasks/:id" element={
        <ProtectedRoute roles={['contributor']}>
          <TaskDetail />
        </ProtectedRoute>
      } />
      <Route path="/submissions" element={
        <ProtectedRoute roles={['contributor']}>
          <SubmissionHistory />
        </ProtectedRoute>
      } />

      {/* Validator routes */}
      <Route path="/validator" element={
        <ProtectedRoute roles={['validator']}>
          <ValidatorDashboard />
        </ProtectedRoute>
      } />

      {/* Shared: wallet */}
      <Route path="/wallet" element={
        <ProtectedRoute roles={['contributor', 'validator']}>
          <WalletPage />
        </ProtectedRoute>
      } />

      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedRoute roles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/tasks" element={
        <ProtectedRoute roles={['admin']}>
          <AdminTasks />
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute roles={['admin']}>
          <AdminUsers />
        </ProtectedRoute>
      } />
      <Route path="/admin/submissions" element={
        <ProtectedRoute roles={['admin']}>
          <AdminSubmissions />
        </ProtectedRoute>
      } />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { fontSize: '14px', maxWidth: '400px' },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
