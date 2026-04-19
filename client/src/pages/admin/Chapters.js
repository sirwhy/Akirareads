import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';

import api from '../../api';
import toast from 'react-hot-toast';

export default function AdminChapters() {
  const [chapters, setChapters] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminChapters({ page, limit: 30 });
      setChapters(res.chapters || []);
      setTotal(res.total || 0);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]); // eslint-disable-line

  const handleDelete = async (id, num) => {
    if (!window.confirm(`Hapus Chapter ${num}?`)) return;
    setDeleting(id);
    try { await api.deleteChapter(id); toast.success('Chapter dihapus'); load(); }
    catch (err) { toast.error(err.message); }
    finally { setDeleting(null); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Chapters</h1>
          <p className="text-white/40 text-sm mt-1">{total} chapter total</p>
        </div>
        <Link to="/admin/chapters/new" className="btn-primary flex items-center gap-2 text-sm"><FiPlus /> Tambah Chapter</Link>
      </div>

      <div className="bg-dark-700/30 border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left p-4 text-xs text-white/30 uppercase tracking-widest">Series</th>
                <th className="text-left p-4 text-xs text-white/30 uppercase tracking-widest">Chapter</th>
                <th className="text-left p-4 text-xs text-white/30 uppercase tracking-widest hidden md:table-cell">Halaman</th>
                <th className="text-left p-4 text-xs text-white/30 uppercase tracking-widest hidden md:table-cell">Tanggal</th>
                <th className="text-right p-4 text-xs text-white/30 uppercase tracking-widest">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? Array(6).fill(0).map((_, i) => (
                <tr key={i}>
                  <td className="p-4"><div className="h-4 shimmer rounded w-32" /></td>
                  <td className="p-4"><div className="h-4 shimmer rounded w-20" /></td>
                  <td className="p-4 hidden md:table-cell"><div className="h-4 shimmer rounded w-12" /></td>
                  <td className="p-4 hidden md:table-cell"><div className="h-4 shimmer rounded w-24" /></td>
                  <td className="p-4"><div className="h-6 shimmer rounded w-16 ml-auto" /></td>
                </tr>
              )) : chapters.length === 0 ? (
                <tr><td colSpan={5} className="py-16 text-center text-white/30">
                  <span className="text-3xl opacity-20">📚</span> Belum ada chapter.
                </td></tr>
              ) : chapters.map(c => (
                <tr key={c.id} className="hover:bg-white/2 transition-colors">
                  <td className="p-4">
                    <p className="font-medium text-sm line-clamp-1">{c.series?.title || '—'}</p>
                  </td>
                  <td className="p-4 text-white/60">Ch {c.chapterNum}{c.title ? ` - ${c.title}` : ''}</td>
                  <td className="p-4 text-white/40 hidden md:table-cell">{c._count?.pages || 0} hal</td>
                  <td className="p-4 text-white/30 hidden md:table-cell text-xs">{new Date(c.createdAt).toLocaleDateString('id-ID')}</td>
                  <td className="p-4">
                    <div className="flex justify-end gap-1">
                      <Link to={`/admin/chapters/edit/${c.id}`} className="p-2 text-white/30 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"><FiEdit2 className="text-sm" /></Link>
                      <button onClick={() => handleDelete(c.id, c.chapterNum)} disabled={deleting===c.id} className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30"><FiTrash2 className="text-sm" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
