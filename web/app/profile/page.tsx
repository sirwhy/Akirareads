'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { FiUser, FiBookmark, FiEdit, FiSave, FiX, FiLogOut, FiKey, FiImage } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import SeriesCard from '@/components/SeriesCard';
import type { Bookmark } from '@/components/types';

function ProfileInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get('tab') || 'profile';
  const { user, loading: authLoading, isLoggedIn, refresh, logout } = useAuth();
  const toast = useToast();

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) router.replace('/login');
  }, [authLoading, isLoggedIn, router]);

  useEffect(() => {
    setUsername(user?.username || '');
    setAvatar(user?.avatar || '');
  }, [user]);

  useEffect(() => {
    if (tab === 'bookmarks' && isLoggedIn) {
      setLoadingBookmarks(true);
      api.getMyBookmarks()
        .then(data => { setBookmarks(data || []); })
        .catch(() => setBookmarks([]))
        .finally(() => setLoadingBookmarks(false));
    }
  }, [tab, isLoggedIn]);

  const handleSaveProfile = async () => {
    if (!username.trim()) { toast.error('Username tidak boleh kosong'); return; }
    setSaving(true);
    try {
      await api.updateMe({ username: username.trim(), avatar: avatar.trim() || undefined });
      await refresh();
      toast.success('Profil diupdate');
      setEditing(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal update profil');
    } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!pwForm.oldPassword || !pwForm.newPassword) { toast.error('Isi semua field password'); return; }
    if (pwForm.newPassword.length < 6) { toast.error('Password baru minimal 6 karakter'); return; }
    if (pwForm.newPassword !== pwForm.confirm) { toast.error('Konfirmasi password tidak cocok'); return; }
    setChangingPw(true);
    try {
      await api.changePassword({ oldPassword: pwForm.oldPassword, newPassword: pwForm.newPassword });
      toast.success('Password diganti');
      setPwForm({ oldPassword: '', newPassword: '', confirm: '' });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal ganti password');
    } finally { setChangingPw(false); }
  };

  const handleLogout = () => { logout(); router.push('/'); };

  if (authLoading || !user) return null;

  const TABS = [
    { id: 'profile', label: 'Profil', icon: FiUser },
    { id: 'bookmarks', label: 'Bookmark', icon: FiBookmark },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 pt-24 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center overflow-hidden">
          {user.avatar
            ? <img src={user.avatar} alt={user.username} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            : <span className="text-2xl font-bold text-accent">{user.username?.[0]?.toUpperCase()}</span>}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user.username}</h1>
          <p className="text-white/40 text-sm">{user.email}</p>
        </div>
        {user.role === 'ADMIN' && (
          <Link href="/admin" className="ml-auto btn-primary text-sm py-2">Admin Panel</Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-dark-700/30 border border-white/5 rounded-xl p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => router.push(`/profile?tab=${id}`)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-dark-600 text-white shadow' : 'text-white/40 hover:text-white'}`}>
            <Icon className="text-xs" /> {label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Informasi Akun</h2>
              {!editing ? (
                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-accent transition-colors">
                  <FiEdit className="text-xs" /> Edit
                </button>
              ) : (
                <button onClick={() => { setEditing(false); setUsername(user.username || ''); setAvatar(user.avatar || ''); }} className="text-white/40 hover:text-white transition-colors"><FiX /></button>
              )}
            </div>
            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest block mb-2">Username</label>
              {editing ? (
                <input value={username} onChange={e => setUsername(e.target.value)} className="input text-sm" />
              ) : (
                <p className="text-sm font-medium">{user.username}</p>
              )}
            </div>
            {editing && (
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest block mb-2">Avatar URL</label>
                <div className="relative">
                  <FiImage className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="https://..." className="input text-sm pl-11" />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest block mb-2">Email</label>
              <p className="text-sm font-medium text-white/60">{user.email}</p>
            </div>
            <div>
              <label className="text-xs text-white/40 uppercase tracking-widest block mb-2">Role</label>
              <span className={`badge text-xs ${user.role === 'ADMIN' ? 'text-accent bg-accent/10' : 'text-white/40 bg-white/5'}`}>{user.role}</span>
            </div>
            {editing && (
              <button onClick={handleSaveProfile} disabled={saving} className="btn-primary flex items-center gap-2 text-sm py-2">
                <FiSave /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            )}
          </div>

          {/* Change password */}
          <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><FiKey className="text-accent text-sm" /> Ganti Password</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="password" value={pwForm.oldPassword} placeholder="Password lama"
                onChange={e => setPwForm(f => ({ ...f, oldPassword: e.target.value }))}
                className="input text-sm" autoComplete="current-password" />
              <input type="password" value={pwForm.newPassword} placeholder="Password baru"
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                className="input text-sm" autoComplete="new-password" />
              <input type="password" value={pwForm.confirm} placeholder="Konfirmasi"
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                className="input text-sm" autoComplete="new-password" />
            </div>
            <button onClick={handleChangePassword} disabled={changingPw} className="btn-primary text-sm py-2 disabled:opacity-60">
              {changingPw ? 'Menyimpan...' : 'Ganti Password'}
            </button>
          </div>

          {/* Logout */}
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors">
            <FiLogOut className="text-xs" /> Keluar dari akun
          </button>
        </div>
      )}

      {/* Bookmarks Tab */}
      {tab === 'bookmarks' && (
        <div>
          {loadingBookmarks ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array(6).fill(0).map((_, i) => <div key={i} className="card"><div className="aspect-[3/4] shimmer" /><div className="p-3 space-y-2"><div className="h-3 shimmer rounded" /><div className="h-2 shimmer rounded w-2/3" /></div></div>)}
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="text-center py-16 text-white/30">
              <FiBookmark className="text-4xl mx-auto mb-3 opacity-20" />
              <p>Belum ada bookmark.</p>
              <Link href="/browse" className="text-accent text-sm hover:underline mt-2 inline-block">Jelajahi series →</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {bookmarks.map(b => (
                <SeriesCard key={b.id} series={b.series} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-12">
        <div className="h-16 shimmer rounded-2xl w-full mb-6" />
        <div className="h-64 shimmer rounded-2xl w-full" />
      </div>
    }>
      <ProfileInner />
    </Suspense>
  );
}
