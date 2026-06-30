import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import AddEditContact from './pages/AddEditContact';
import Search from './pages/Search';
import Downloads from './pages/Downloads';
import Communications from './pages/Communications';
import Users from './pages/Users';
import Reports from './pages/Reports';
import Logs from './pages/Logs';
import Profile from './pages/Profile';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0D1526',
              color: '#F1F5F9',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#10B981', secondary: '#0D1526' } },
            error: { iconTheme: { primary: '#F43F5E', secondary: '#0D1526' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout>
                  <Outlet />
                </Layout>
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/contacts/new" element={<AddEditContact />} />
            <Route path="/contacts/:id/edit" element={<AddEditContact />} />
            <Route path="/search" element={<Search />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/comms" element={<Communications />} />
            <Route path="/users" element={<Users />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
