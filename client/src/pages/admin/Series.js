import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiEdit2, FiTrash2, FiSearch } from 'react-icons/fi';

import api from '../../api';
import toast from 'react-hot-toast';

export default function AdminSeries() {
  const [series, setSeries] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState('');
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminSeries({ page, limit: 20, q });
      setSeries(res.series || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, q]); // eslint-disable-line

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Hapus "${title}"? Semua chapter akan ikut terhapus.`)) return;
    setDeleting(id);
    try {
      await api.deleteSeries(id);
      toast.success('Series dihapus');
      load();
    } catch (err) { toast.error(err.message); }
    finally { setDeleting(null); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Series</h1>
          <p className="text-white/40 text-sm mt-1">{total} series total</p>
        </div>
        <Link to="/admin/series/new" className="btn-primary flex items-center gap-2 text-sm">
          <FiPlus /> Tambah Series
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Cari series..." className="input pl-11 text-sm" />
      </div>

      {/* Table */}
      <div className="bg-dark-700/30 border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left p-4 text-xs text-white/30 uppercase tracking-widest font-medium">Series</th>
                <th className="text-left p-4 text-xs text-white/30 uppercase tracking-widest font-medium hidden md:table-cell">Tipe</th>
                <th className="text-left p-4 text-xs text-white/30 uppercase tracking-widest font-medium hidden md:table-cell">Status</th>
                <th className="text-left p-4 text-xs text-white/30 uppercase tracking-widest font-medium hidden lg:table-cell">Chapter</th>
                <th className="text-left p-4 text-xs text-white/30 uppercase tracking-widest font-medium hidden lg:table-cell">Views</th>
                <th className="text-right p-4 text-xs text-white/30 uppercase tracking-widest font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array(8).fill(0).map((_, i) => (
                  <tr key={i}>
                    <td className="p-4"><div className="flex gap-3 items-center"><div className="w-9 h-12 shimmer rounded" /><div className="space-y-2"><div className="h-4 shimmer rounded w-32" /><div className="h-3 shimmer rounded w-20" /></div></div></td>
                    <td className="p-4 hidden md:table-cell"><div className="h-4 shimmer rounded w-16" /></td>
                    <td className="p-4 hidden md:table-cell"><div className="h-4 shimmer rounded w-16" /></td>
                    <td className="p-4 hidden lg:table-cell"><div className="h-4 shimmer rounded w-8" /></td>
                    <td className="p-4 hidden lg:table-cell"><div className="h-4 shimmer rounded w-12" /></td>
                    <td className="p-4"><div className="h-6 shimmer rounded w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : series.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-white/30">
                  <span className="text-4xl opacity-20">📚</span>
                  Belum ada series.
                </td></tr>
              ) : series.map(s => (
                <tr key={s.id} className="hover:bg-white/2 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-dark-600">
                        {s.cover ? <img src={s.cover} alt={s.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><span className="text-white/10 text-xs">📖</span></div>}
                      </div>
                      <div>
                        <p className="font-medium line-clamp-1">{s.title}</p>
                        <p className="text-xs text-white/30">{s.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell"><span className="badge text-xs text-white/40 bg-white/5">{s.type}</span></td>
                  <td className="p-4 hidden md:table-cell">
                    <span className={`badge text-xs ${s.status === 'ONGOING' ? 'text-green-400 bg-green-400/10' : s.status === 'COMPLETED' ? 'text-blue-400 bg-blue-400/10' : 'text-yellow-400 bg-yellow-400/10'}`}>
                      {s.status === 'ONGOING' ? 'Ongoing' : s.status === 'COMPLETED' ? 'Tamat' : s.status}
                    </span>
                  </td>
                  <td className="p-4 hidden lg:table-cell text-white/50">{s._count?.chapters || 0}</td>
                  <td className="p-4 hidden lg:table-cell text-white/50">{s.views?.toLocaleString()}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/admin/series/edit/${s.id}`} className="p-2 text-white/30 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors">
                        <FiEdit2 className="text-sm" />
                      </Link>
                      <button onClick={() => handleDelete(s.id, s.title)} disabled={deleting === s.id}
                        className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30">
                        <FiTrash2 className="text-sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="border-t border-white/5 p-4 flex justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 disabled:opacity-30 hover:border-accent hover:text-accent transition-colors">← Prev</button>
            <span className="px-3 py-1.5 text-xs text-white/40">{page} / {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page===pages} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 disabled:opacity-30 hover:border-accent hover:text-accent transition-colors">Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}
