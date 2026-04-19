import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Browse from './pages/Browse';
import Latest from './pages/Latest';
import Series from './pages/Series';
import Reader from './pages/Reader';
import UserLogin from './pages/UserLogin';
import UserRegister from './pages/UserRegister';
import Profile from './pages/Profile';
import AdminLogin from './pages/admin/Login';
import AdminLayout from './pages/admin/Layout';
import AdminDashboard from './pages/admin/Dashboard';
import AdminSeries from './pages/admin/Series';
import AdminSeriesForm from './pages/admin/SeriesForm';
import AdminChapters from './pages/admin/Chapters';
import AdminChapterForm from './pages/admin/ChapterForm';
import AdminAds from './pages/admin/Ads';
import AdminSettings from './pages/admin/Settings';
import AdminUsers from './pages/admin/Users';
import AdminMirror from './pages/admin/Mirror';

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user || user.role !== 'ADMIN') return <Navigate to="/admin/login" replace />;
  return children;
}
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
function Spinner() {
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-dark-900 text-white flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#141420', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' },
            success: { iconTheme: { primary: '#e11d48', secondary: '#fff' } },
          }}
        />
        <Routes>
          {/* Public */}
          <Route path="/"             element={<PublicLayout><Home /></PublicLayout>} />
          <Route path="/browse"       element={<PublicLayout><Browse /></PublicLayout>} />
          <Route path="/latest"       element={<PublicLayout><Latest /></PublicLayout>} />
          <Route path="/series/:slug" element={<PublicLayout><Series /></PublicLayout>} />
          <Route path="/read/:id"     element={<Reader />} />
          <Route path="/login"        element={<PublicLayout><UserLogin /></PublicLayout>} />
          <Route path="/register"     element={<PublicLayout><UserRegister /></PublicLayout>} />
          <Route path="/profile"      element={<PrivateRoute><PublicLayout><Profile /></PublicLayout></PrivateRoute>} />

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index                    element={<AdminDashboard />} />
            <Route path="series"            element={<AdminSeries />} />
            <Route path="series/new"        element={<AdminSeriesForm />} />
            <Route path="series/edit/:id"   element={<AdminSeriesForm />} />
            <Route path="chapters"          element={<AdminChapters />} />
            <Route path="chapters/new"      element={<AdminChapterForm />} />
            <Route path="chapters/edit/:id" element={<AdminChapterForm />} />
            <Route path="mirror"            element={<AdminMirror />} />
            <Route path="ads"               element={<AdminAds />} />
            <Route path="settings"          element={<AdminSettings />} />
            <Route path="users"             element={<AdminUsers />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={
            <PublicLayout>
              <div className="flex items-center justify-center min-h-[60vh] text-center">
                <div>
                  <h1 className="font-display text-8xl text-accent mb-4">404</h1>
                  <p className="text-white/60">Halaman tidak ditemukan</p>
                </div>
              </div>
            </PublicLayout>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
