'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiMail, FiLock, FiEye, FiEyeOff, FiShield } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/Toast';
import AkiraLogo from '@/components/Logo';

function AdminLoginInner() {
  const { user, isAdmin, loading, login, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sudah login sebagai admin → langsung masuk panel.
  useEffect(() => {
    if (!loading && isAdmin) router.replace('/admin');
  }, [loading, isAdmin, router]);

  // Sesi aktif ternyata bukan admin → keluarkan token, minta login admin.
  useEffect(() => {
    if (!loading && user && !isAdmin) {
      logout();
      toast.error('Akun ini bukan admin. Silakan login dengan akun admin.');
    }
  }, [loading, user, isAdmin, logout, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Isi semua field'); return; }
    setBusy(true);
    try {
      await login(form.email, form.password, true);
      toast.success('Login admin berhasil!');
      router.replace('/admin');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Login gagal');
    } finally {
      setBusy(false);
    }
  };

  if (!loading && isAdmin) return <div className="min-h-screen bg-dark-900" />;

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4 py-16">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 30% 50%, rgba(225,29,72,0.06) 0%, transparent 60%)' }} />
      <div className="w-full max-w-md relative animate-slide-up">
        <div className="bg-dark-700/50 border border-white/5 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <AkiraLogo size={44} textSize="text-2xl" />
            </div>
            <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mt-3">
              <FiShield className="text-accent text-xs" />
              <span className="text-xs text-accent font-medium uppercase tracking-widest">Admin Access</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Email Admin</label>
              <div className="relative">
                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="admin@akirareads.com" className="input pl-11" autoComplete="email" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Password</label>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••" className="input pl-11 pr-11" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                  {showPass ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={busy}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60 mt-2">
              {busy
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><FiShield /> Masuk ke Admin Panel</>}
            </button>
          </form>
          <div className="mt-6 text-center">
            <Link href="/login" className="text-xs text-white/20 hover:text-white/40 transition-colors">← Login sebagai pengguna biasa</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-dark-900" />}>
      <AdminLoginInner />
    </Suspense>
  );
}
