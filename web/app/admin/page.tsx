'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FiBook, FiList, FiUsers, FiEye, FiPlus, FiArrowRight, FiZap, FiRefreshCw, FiTrendingUp } from 'react-icons/fi';
import AdminShell from './AdminShell';
import { api } from '@/lib/client';
import { asArray, firstStr, numOr, timeAgo, type MirrorJob, type SeriesRow } from './types';

interface Stats {
  totalSeries: number;
  totalChapters: number;
  totalUsers: number;
  totalViews: number;
  mirrorActive: number;
  mirrorDone: number;
  mirrorFailed: number;
  recentMirror: MirrorJob[];
}

function StatCard({ icon: Icon, label, value, color = 'text-accent', href }: {
  icon: typeof FiBook; label: string; value: string | number; color?: string; href?: string;
}) {
  const inner = (
    <div className={`bg-dark-700/50 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all ${href ? 'cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${color}`}>
          <Icon className="text-xl" />
        </div>
        {href && <FiArrowRight className="text-white/20 text-sm" />}
      </div>
      <p className="text-3xl font-bold mb-1">{value}</p>
      <p className="text-sm text-white/40">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function SkeletonStat() {
  return (
    <div className="bg-dark-700/50 border border-white/5 rounded-2xl p-5">
      <div className="h-10 w-10 shimmer rounded-xl mb-3" />
      <div className="h-8 shimmer rounded w-1/2 mb-2" />
      <div className="h-4 shimmer rounded w-2/3" />
    </div>
  );
}

const MIRROR_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Antri', color: 'text-yellow-400 bg-yellow-400/10' },
  RUNNING: { label: 'Proses', color: 'text-blue-400 bg-blue-400/10' },
  DONE: { label: 'Selesai', color: 'text-green-400 bg-green-400/10' },
  FAILED: { label: 'Gagal', color: 'text-red-400 bg-red-400/10' },
};


function AdminDashboardInner() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // v3 tidak punya endpoint stats global → agregasi dari list API.
      const [seriesRes, usersRes, mirrorRes] = await Promise.all([
        api.getSeries({ page: 1, limit: 100 }),
        api.getAllUsers({ page: 1, limit: 1 }),
        api.mirrorJobs().catch(() => ({ jobs: [] })),
      ]);
      const jobs = asArray<MirrorJob>(mirrorRes?.jobs ?? mirrorRes);
      const rows = asArray<SeriesRow>(seriesRes?.data);
      setStats({
        totalSeries: numOr(seriesRes?.total, rows.length),
        totalChapters: rows.reduce((a, s) => a + numOr(s._count?.chapters), 0),
        totalUsers: numOr(usersRes?.total),
        totalViews: rows.reduce((a, s) => a + numOr(s.views), 0),
        mirrorActive: jobs.filter(j => j.status === 'PENDING' || j.status === 'RUNNING').length,
        mirrorDone: jobs.filter(j => j.status === 'DONE').length,
        mirrorFailed: jobs.filter(j => j.status === 'FAILED').length,
        recentMirror: jobs.slice(0, 5),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-white/40 text-sm mt-1">Selamat datang di AKIRAREADS Admin</p>
        </div>
        <Link href="/admin/series" className="btn-primary flex items-center gap-2 text-sm">
          <FiPlus /> Kelola Series
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          Array(4).fill(0).map((_, i) => <SkeletonStat key={i} />)
        ) : stats ? (
          <>
            <StatCard icon={FiBook} label="Total Series" value={stats.totalSeries.toLocaleString()} href="/admin/series" />
            <StatCard icon={FiList} label="Chapter (100 series terakhir)" value={stats.totalChapters.toLocaleString()} color="text-blue-400" />
            <StatCard icon={FiUsers} label="Total Users" value={stats.totalUsers.toLocaleString()} color="text-green-400" href="/admin/users" />
            <StatCard icon={FiEye} label="Views (100 series terakhir)" value={stats.totalViews.toLocaleString()} color="text-yellow-400" />
          </>
        ) : null}
      </div>

      {/* Mirror summary + quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {loading ? (
          Array(3).fill(0).map((_, i) => <SkeletonStat key={i} />)
        ) : stats ? (
          <>
            <StatCard icon={FiZap} label="Import berjalan / antri" value={stats.mirrorActive} href="/admin/mirror" />
            <StatCard icon={FiTrendingUp} label="Import selesai" value={stats.mirrorDone} color="text-green-400" href="/admin/mirror" />
            <StatCard icon={FiRefreshCw} label="Import gagal" value={stats.mirrorFailed} color="text-red-400" href="/admin/mirror" />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { href: '/admin/mirror', icon: FiZap, title: 'Mirror / Import URL', desc: 'Import seri dari MangaDex, madara, atau browser import' },
          { href: '/admin/translate', icon: FiRefreshCw, title: 'Terjemahkan Chapter', desc: 'Jalankan pipeline AI translate per seri' },
          { href: '/admin/settings', icon: FiBook, title: 'Pengaturan Situs', desc: 'Nama situs, pengumuman, maintenance' },
        ].map(({ href, icon: Icon, title, desc }) => (
          <Link key={href} href={href} className="bg-dark-700/30 border border-white/5 rounded-2xl p-5 hover:border-accent/40 transition-all flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
              <Icon className="text-lg" />
            </div>
            <div>
              <p className="font-semibold text-sm">{title}</p>
              <p className="text-xs text-white/40 mt-0.5">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent mirror jobs */}
      {stats && stats.recentMirror.length > 0 && (
        <div className="bg-dark-700/30 border border-white/5 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="font-semibold text-sm flex items-center gap-2"><FiZap className="text-accent" /> Mirror Job Terbaru</h2>
            <Link href="/admin/mirror" className="text-xs text-accent hover:underline">Lihat semua →</Link>
          </div>
          <div className="divide-y divide-white/5">
            {stats.recentMirror.map(j => {
              const cfg = MIRROR_STATUS[firstStr(j.status, 'PENDING')] || MIRROR_STATUS.PENDING;
              return (
                <div key={firstStr(j.id)} className="px-5 py-3 flex items-center gap-3 min-w-0">
                  <span className={`badge text-xs ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-xs text-white/30 font-mono truncate flex-1" title={firstStr(j.sourceUrl)}>{firstStr(j.sourceUrl)}</span>
                  <span className="text-xs text-white/20 whitespace-nowrap">{timeAgo(j.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminShell>
      <AdminDashboardInner />
    </AdminShell>
  );
}
