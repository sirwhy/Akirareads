import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiBook, FiList, FiUsers, FiEye, FiPlus, FiArrowRight, FiTrendingUp } from 'react-icons/fi';
import api from '../../api';

function StatCard({ icon: Icon, label, value, color = 'text-accent', link }) {
  const content = (
    <div className={`bg-dark-700/50 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all ${link ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${color}`}>
          <Icon className="text-xl" />
        </div>
        {link && <FiArrowRight className="text-white/20 text-sm" />}
      </div>
      <p className="text-3xl font-bold mb-1">{value}</p>
      <p className="text-sm text-white/40">{label}</p>
    </div>
  );
  return link ? <Link to={link}>{content}</Link> : content;
}

function SkeletonStat() {
  return <div className="bg-dark-700/50 border border-white/5 rounded-2xl p-5"><div className="h-10 w-10 shimmer rounded-xl mb-3" /><div className="h-8 shimmer rounded w-1/2 mb-2" /><div className="h-4 shimmer rounded w-2/3" /></div>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAdminStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-white/40 text-sm mt-1">Selamat datang di Akira Reader Admin</p>
        </div>
        <Link to="/admin/series/new" className="btn-primary flex items-center gap-2 text-sm">
          <FiPlus /> Tambah Series
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          Array(4).fill(0).map((_, i) => <SkeletonStat key={i} />)
        ) : stats ? (
          <>
            <StatCard icon={FiBook} label="Total Series" value={stats.totalSeries} link="/admin/series" />
            <StatCard icon={FiList} label="Total Chapter" value={stats.totalChapters} link="/admin/chapters" color="text-blue-400" />
            <StatCard icon={FiUsers} label="Total Users" value={stats.totalUsers} link="/admin/users" color="text-green-400" />
            <StatCard icon={FiEye} label="Total Views" value={stats.totalViews?.toLocaleString()} color="text-yellow-400" />
          </>
        ) : null}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { to: '/admin/series/new', icon: FiBook, label: 'Tambah Series Baru', desc: 'Upload manhwa, manga, atau manhua' },
          { to: '/admin/chapters/new', icon: FiList, label: 'Tambah Chapter', desc: 'Upload chapter dengan halaman' },
          { to: '/admin/ads', icon: FiTrendingUp, label: 'Kelola Iklan', desc: 'Pasang & atur iklan website' },
        ].map(({ to, icon: Icon, label, desc }) => (
          <Link key={to} to={to} className="bg-dark-700/30 border border-white/5 rounded-2xl p-5 hover:border-accent/30 hover:bg-dark-700/50 transition-all group">
            <Icon className="text-2xl text-accent mb-3" />
            <p className="font-semibold text-sm group-hover:text-accent transition-colors">{label}</p>
            <p className="text-xs text-white/30 mt-1">{desc}</p>
          </Link>
        ))}
      </div>

      {/* Recent series */}
      {stats?.recentSeries?.length > 0 && (
        <div className="bg-dark-700/30 border border-white/5 rounded-2xl overflow-hidden mb-6">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="font-semibold text-sm">Series Terbaru</h2>
            <Link to="/admin/series" className="text-xs text-accent hover:text-accent-light transition-colors flex items-center gap-1">Lihat semua <FiArrowRight /></Link>
          </div>
          <div className="divide-y divide-white/5">
            {stats.recentSeries.map(s => (
              <div key={s.id} className="flex items-center gap-4 p-4 hover:bg-white/2 transition-colors">
                <div className="w-9 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-dark-600">
                  {s.cover ? <img src={s.cover} alt={s.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/10 text-xs">N/A</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.title}</p>
                  <p className="text-xs text-white/30">{s.views?.toLocaleString()} views</p>
                </div>
                <Link to={`/admin/series/edit/${s.id}`} className="text-xs text-white/30 hover:text-accent transition-colors px-2">Edit</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent users */}
      {stats?.recentUsers?.length > 0 && (
        <div className="bg-dark-700/30 border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="font-semibold text-sm">Pengguna Terbaru</h2>
            <Link to="/admin/users" className="text-xs text-accent hover:text-accent-light transition-colors flex items-center gap-1">Lihat semua <FiArrowRight /></Link>
          </div>
          <div className="divide-y divide-white/5">
            {stats.recentUsers.map(u => (
              <div key={u.id} className="flex items-center gap-3 p-4">
                <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-white/40 text-xs font-bold flex-shrink-0">
                  {u.username?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.username}</p>
                  <p className="text-xs text-white/30 truncate">{u.email}</p>
                </div>
                <p className="text-xs text-white/20">{new Date(u.createdAt).toLocaleDateString('id-ID')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
