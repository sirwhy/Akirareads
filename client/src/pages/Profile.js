import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FiUser, FiBookmark, FiClock, FiEdit, FiSave, FiX } from 'react-icons/fi';

import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'profile';
  const [bookmarks, setBookmarks] = useState([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tab === 'bookmarks') {
      setLoadingBookmarks(true);
      api.getMyBookmarks().then(data => { setBookmarks(data || []); }).finally(() => setLoadingBookmarks(false));
    }
  }, [tab]);

  const handleSaveProfile = async () => {
    if (!username.trim()) return;
    setSaving(true);
    try {
      await api.updateMe({ username });
      toast.success('Profil diupdate');
      setEditing(false);
      window.location.reload();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const TABS = [
    { id: 'profile', label: 'Profil', icon: FiUser },
    { id: 'bookmarks', label: 'Bookmark', icon: FiBookmark },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 pt-24 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-accent/10 border border-accent/20 rounded-2xl flex items-center justify-center text-2xl font-bold text-accent">
          {user?.username?.[0]?.toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{user?.username}</h1>
          <p className="text-white/40 text-sm">{user?.email}</p>
        </div>
        {user?.role === 'ADMIN' && (
          <Link to="/admin" className="ml-auto btn-primary text-sm py-2">Admin Panel</Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-dark-700/30 border border-white/5 rounded-xl p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setParams({ tab: id })}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-dark-600 text-white shadow' : 'text-white/40 hover:text-white'}`}>
            <Icon className="text-xs" /> {label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Informasi Akun</h2>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm text-white/40 hover:text-accent transition-colors">
                <FiEdit className="text-xs" /> Edit
              </button>
            ) : (
              <button onClick={() => { setEditing(false); setUsername(user?.username || ''); }} className="text-white/40 hover:text-white transition-colors"><FiX /></button>
            )}
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-widest block mb-2">Username</label>
            {editing ? (
              <input value={username} onChange={e => setUsername(e.target.value)} className="input text-sm" />
            ) : (
              <p className="text-sm font-medium">{user?.username}</p>
            )}
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-widest block mb-2">Email</label>
            <p className="text-sm font-medium text-white/60">{user?.email}</p>
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-widest block mb-2">Role</label>
            <span className={`badge text-xs ${user?.role === 'ADMIN' ? 'text-accent bg-accent/10' : 'text-white/40 bg-white/5'}`}>{user?.role}</span>
          </div>
          {editing && (
            <button onClick={handleSaveProfile} disabled={saving} className="btn-primary flex items-center gap-2 text-sm py-2">
              <FiSave /> {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          )}
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
              <Link to="/browse" className="text-accent text-sm hover:underline mt-2 inline-block">Jelajahi series →</Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {bookmarks.map(b => (
                <Link key={b.id} to={`/series/${b.series.slug}`} className="card group">
                  <div className="aspect-[3/4] overflow-hidden">
                    {b.series.cover ? <img src={b.series.cover} alt={b.series.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full bg-dark-600 flex items-center justify-center"><span className="text-2xl opacity-30">📖</span></div>}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium line-clamp-2 group-hover:text-accent transition-colors">{b.series.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
