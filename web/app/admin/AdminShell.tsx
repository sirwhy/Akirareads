'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  FiGrid, FiBook, FiList, FiZap, FiRefreshCw, FiMonitor,
  FiUsers, FiSettings, FiLogOut, FiMenu, FiEye, FiShield,
} from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import AkiraLogo from '@/components/Logo';

export const ADMIN_NAV: { to: string; label: string; icon: typeof FiGrid; end?: boolean }[] = [
  { to: '/admin', label: 'Dashboard', icon: FiGrid, end: true },
  { to: '/admin/series', label: 'Seri', icon: FiBook },
  { to: '/admin/chapters', label: 'Chapter', icon: FiList },
  { to: '/admin/mirror', label: 'Mirror / Import', icon: FiZap },
  { to: '/admin/translate', label: 'Terjemahan', icon: FiRefreshCw },
  { to: '/admin/ads', label: 'Iklan (Ads)', icon: FiMonitor },
  { to: '/admin/users', label: 'Pengguna', icon: FiUsers },
  { to: '/admin/settings', label: 'Pengaturan', icon: FiSettings },
];

function isActive(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(to + '/');
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname() || '';
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Guard: admin tersembunyi — belum login → halaman login.
  useEffect(() => {
    if (!loading && !user) router.replace('/admin/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) {
    return <div className="min-h-screen bg-dark-900" />;
  }
  if (user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <FiShield className="text-4xl mx-auto mb-4 text-accent opacity-60" />
          <h1 className="text-xl font-bold mb-2">Akses ditolak</h1>
          <p className="text-white/40 text-sm mb-6">
            Halaman ini khusus administrator. Akun kamu ({user.email}) tidak punya akses admin.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/" className="btn-ghost text-sm">Kembali ke Website</Link>
            <button onClick={() => { logout(); router.replace('/admin/login'); }} className="btn-primary text-sm">
              Masuk Akun Lain
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleLogout = () => { logout(); router.replace('/admin/login'); };

  return (
    <div className="min-h-screen bg-dark-900 flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-dark-800 border-r border-white/5 flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-5 border-b border-white/5">
          <Link href="/admin"><AkiraLogo size={32} textSize="text-lg" /></Link>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1 ml-10">Admin Panel</p>
        </div>
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent/10 border border-accent/20 rounded-full flex items-center justify-center text-accent text-xs font-bold">
              {user.username?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <p className="text-xs text-white/30 truncate">{user.email}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {ADMIN_NAV.map(({ to, label, icon: Icon, end }) => (
            <Link key={to} href={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive(pathname, to, end)
                  ? 'bg-accent text-white shadow-lg shadow-accent/20'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}>
              <Icon className="text-base flex-shrink-0" /> {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5 space-y-0.5">
          <a href="/" target="_blank" rel="noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all">
            <FiEye className="text-base" /> Lihat Website
          </a>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <FiLogOut className="text-base" /> Keluar
          </button>
        </div>
      </aside>

      {/* Scrim (mobile) */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Content */}
      <div className="flex-1 lg:ml-60 min-h-screen flex flex-col">
        <div className="lg:hidden sticky top-0 z-30 bg-dark-800/95 backdrop-blur border-b border-white/5 h-14 flex items-center px-4 gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-white/60 hover:text-white"><FiMenu className="text-xl" /></button>
          <AkiraLogo size={28} textSize="text-lg" />
        </div>
        <div className="flex-1 p-6 max-w-6xl w-full mx-auto">{children}</div>
      </div>
    </div>
  );
}
