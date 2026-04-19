import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiClock, FiList } from 'react-icons/fi';

import api from '../api';

function timeAgo(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return `${diff}d yang lalu`;
  if (diff < 3600) return `${Math.floor(diff/60)}m yang lalu`;
  if (diff < 86400) return `${Math.floor(diff/3600)}j yang lalu`;
  return `${Math.floor(diff/86400)} hari yang lalu`;
}

export default function Latest() {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.getSeries({ sort: 'updatedAt', order: 'desc', limit: 30, page });
        setSeries(res.series || []);
        setPages(res.pages || 1);
      } finally { setLoading(false); }
    }
    load();
  }, [page]);

  return (
    <div className="max-w-5xl mx-auto px-4 pt-24 pb-12 animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-1 h-6 bg-accent rounded-full" />
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FiClock className="text-accent" /> Update Terbaru</h1>
          <p className="text-white/30 text-sm mt-0.5">Series yang baru diupdate</p>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="card p-4 flex gap-4">
              <div className="w-14 h-20 shimmer rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 shimmer rounded w-2/3" />
                <div className="h-3 shimmer rounded w-1/3" />
                <div className="h-3 shimmer rounded w-1/2" />
              </div>
            </div>
          ))
        ) : series.map(s => (
          <Link key={s.id} to={`/series/${s.slug}`}
            className="card p-4 flex gap-4 hover:border-accent/30 group transition-all">
            <div className="flex-shrink-0 w-14 h-20 rounded-lg overflow-hidden border border-white/5">
              {s.cover ? <img src={s.cover} alt={s.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full bg-dark-600 flex items-center justify-center"><span className="text-lg opacity-30">📖</span></div>}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm group-hover:text-accent transition-colors line-clamp-1">{s.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-white/30 badge bg-white/5">{s.type}</span>
                <span className={`text-xs badge ${s.status === 'ONGOING' ? 'text-green-400 bg-green-400/10' : s.status === 'COMPLETED' ? 'text-blue-400 bg-blue-400/10' : 'text-yellow-400 bg-yellow-400/10'}`}>
                  {s.status === 'ONGOING' ? 'Ongoing' : s.status === 'COMPLETED' ? 'Tamat' : 'Hiatus'}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-white/30">
                <span className="flex items-center gap-1"><FiList /> {s._count?.chapters || 0} chapter</span>
                <span className="flex items-center gap-1"><FiClock /> {timeAgo(s.updatedAt)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {!loading && series.length === 0 && (
        <div className="text-center py-24 text-white/30">
          <span className="text-5xl opacity-20">📚</span>
          <p>Belum ada konten.</p>
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="px-4 py-2 rounded-lg border border-white/10 text-sm disabled:opacity-30 hover:border-accent hover:text-accent transition-colors">← Sebelumnya</button>
          <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page === pages} className="px-4 py-2 rounded-lg border border-white/10 text-sm disabled:opacity-30 hover:border-accent hover:text-accent transition-colors">Selanjutnya →</button>
        </div>
      )}
    </div>
  );
}
