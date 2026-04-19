import React, { useState, useEffect } from 'react';
import { FiUsers } from 'react-icons/fi';
import api from '../../api';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    api.getAllUsers({ page, limit: 20 }).then(res => {
      setUsers(res.users || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    }).catch(console.error).finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-white/40 text-sm mt-1">{total} pengguna terdaftar</p>
      </div>

      <div className="bg-dark-700/30 border border-white/5 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left p-4 text-xs text-white/30 uppercase tracking-widest">Pengguna</th>
              <th className="text-left p-4 text-xs text-white/30 uppercase tracking-widest hidden md:table-cell">Email</th>
              <th className="text-left p-4 text-xs text-white/30 uppercase tracking-widest">Role</th>
              <th className="text-left p-4 text-xs text-white/30 uppercase tracking-widest hidden md:table-cell">Bergabung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? Array(6).fill(0).map((_, i) => (
              <tr key={i}>
                <td className="p-4"><div className="flex gap-3 items-center"><div className="w-8 h-8 shimmer rounded-full" /><div className="h-4 shimmer rounded w-24" /></div></td>
                <td className="p-4 hidden md:table-cell"><div className="h-4 shimmer rounded w-36" /></td>
                <td className="p-4"><div className="h-4 shimmer rounded w-14" /></td>
                <td className="p-4 hidden md:table-cell"><div className="h-4 shimmer rounded w-20" /></td>
              </tr>
            )) : users.length === 0 ? (
              <tr><td colSpan={4} className="py-12 text-center text-white/30">
                <FiUsers className="text-4xl mx-auto mb-3 opacity-20" />Belum ada user.
              </td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="hover:bg-white/2 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-white/40 text-xs font-bold flex-shrink-0">
                      {u.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium">{u.username}</span>
                  </div>
                </td>
                <td className="p-4 text-white/40 hidden md:table-cell">{u.email}</td>
                <td className="p-4">
                  <span className={`badge text-xs ${u.role === 'ADMIN' ? 'text-accent bg-accent/10' : 'text-white/30 bg-white/5'}`}>{u.role}</span>
                </td>
                <td className="p-4 text-white/30 text-xs hidden md:table-cell">{new Date(u.createdAt).toLocaleDateString('id-ID')}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
