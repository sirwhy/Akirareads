import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiFilter, FiSearch, FiX } from 'react-icons/fi';
import SeriesCard from '../components/SeriesCard';
import api from '../api';

const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Isekai', 'Magic', 'Martial Arts', 'Mystery', 'Romance', 'School', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'System', 'Thriller'];
const TYPES = ['MANHWA', 'MANGA', 'MANHUA'];
const STATUSES = [{ val: 'ONGOING', label: 'Ongoing' }, { val: 'COMPLETED', label: 'Tamat' }, { val: 'HIATUS', label: 'Hiatus' }];
const SORTS = [{ val: 'updatedAt', label: 'Terbaru' }, { val: 'views', label: 'Terpopuler' }, { val: 'title', label: 'A-Z' }, { val: 'createdAt', label: 'Ditambahkan' }];

function SkeletonCard() {
  return <div className="card"><div className="aspect-[3/4] shimmer" /><div className="p-3 space-y-2"><div className="h-3 shimmer rounded w-3/4" /><div className="h-2 shimmer rounded w-1/2" /></div></div>;
}

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const [series, setSeries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState(params.get('q') || '');

  const filters = {
    q: params.get('q') || '',
    genre: params.get('genre') || '',
    status: params.get('status') || '',
    type: params.get('type') || '',
    sort: params.get('sort') || 'updatedAt',
    order: params.get('order') || 'desc',
  };

  const setFilter = (key, val) => {
    const p = new URLSearchParams(params);
    if (val) p.set(key, val); else p.delete(key);
    p.delete('page');
    setParams(p);
    setPage(1);
  };

  const clearFilter = (key) => setFilter(key, '');
  const clearAll = () => { setParams({}); setSearch(''); setPage(1); };

  const fetchSeries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSeries({ ...filters, page, limit: 24 });
      setSeries(res.series || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
    } catch { setSeries([]); }
    finally { setLoading(false); }
  }, [params, page]); // eslint-disable-line

  useEffect(() => { fetchSeries(); }, [params, page]); // eslint-disable-line

  const activeFilters = Object.entries(filters).filter(([k, v]) => v && k !== 'sort' && k !== 'order');

  return (
    <div className="max-w-7xl mx-auto px-4 pt-24 pb-12 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Jelajahi</h1>
          <p className="text-white/40 text-sm mt-1">{total} series ditemukan</p>
        </div>
        <button onClick={() => setFilterOpen(!filterOpen)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${filterOpen ? 'border-accent text-accent bg-accent/10' : 'border-white/10 text-white/60 hover:border-white/30'}`}>
          <FiFilter /> Filter {activeFilters.length > 0 && <span className="bg-accent text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{activeFilters.length}</span>}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') setFilter('q', search); }}
          placeholder="Cari judul manhwa..." className="input pl-11" />
        {search && <button onClick={() => { setSearch(''); clearFilter('q'); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"><FiX /></button>}
      </div>

      {/* Filters panel */}
      {filterOpen && (
        <div className="bg-dark-700/50 border border-white/5 rounded-xl p-5 mb-6 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Genre */}
            <div>
              <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Genre</p>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {GENRES.map(g => (
                  <button key={g} onClick={() => setFilter('genre', filters.genre === g ? '' : g)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filters.genre === g ? 'border-accent text-accent bg-accent/10' : 'border-white/10 text-white/40 hover:border-white/30'}`}>{g}</button>
                ))}
              </div>
            </div>
            {/* Type */}
            <div>
              <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Tipe</p>
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map(t => (
                  <button key={t} onClick={() => setFilter('type', filters.type === t ? '' : t)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filters.type === t ? 'border-accent text-accent bg-accent/10' : 'border-white/10 text-white/40 hover:border-white/30'}`}>{t}</button>
                ))}
              </div>
              <p className="text-xs text-white/40 uppercase tracking-widest mb-3 mt-4">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map(s => (
                  <button key={s.val} onClick={() => setFilter('status', filters.status === s.val ? '' : s.val)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filters.status === s.val ? 'border-accent text-accent bg-accent/10' : 'border-white/10 text-white/40 hover:border-white/30'}`}>{s.label}</button>
                ))}
              </div>
            </div>
            {/* Sort */}
            <div>
              <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Urutkan</p>
              <div className="space-y-1">
                {SORTS.map(s => (
                  <button key={s.val} onClick={() => setFilter('sort', s.val)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${filters.sort === s.val ? 'text-accent bg-accent/10' : 'text-white/50 hover:bg-white/5'}`}>{s.label}</button>
                ))}
              </div>
              {activeFilters.length > 0 && (
                <button onClick={clearAll} className="mt-4 text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><FiX /> Hapus semua filter</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active filter tags */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {activeFilters.map(([key, val]) => (
            <span key={key} className="flex items-center gap-1.5 text-xs bg-accent/10 text-accent border border-accent/20 px-2.5 py-1 rounded-full">
              {val} <button onClick={() => clearFilter(key)}><FiX className="text-[10px]" /></button>
            </span>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array(12).fill(0).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : series.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {series.map(s => <SeriesCard key={s.id} series={s} />)}
          </div>
          {/* Pagination */}
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="px-4 py-2 rounded-lg border border-white/10 text-sm disabled:opacity-30 hover:border-accent hover:text-accent transition-colors">←</button>
              {Array.from({ length: Math.min(7, pages) }, (_, i) => {
                const p = i + 1;
                return <button key={p} onClick={() => setPage(p)} className={`w-9 h-9 rounded-lg text-sm transition-colors ${p === page ? 'bg-accent text-white' : 'border border-white/10 hover:border-accent hover:text-accent'}`}>{p}</button>;
              })}
              <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page === pages} className="px-4 py-2 rounded-lg border border-white/10 text-sm disabled:opacity-30 hover:border-accent hover:text-accent transition-colors">→</button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-24 text-white/30">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-lg">Tidak ada series yang ditemukan</p>
          <button onClick={clearAll} className="mt-4 text-accent text-sm hover:underline">Hapus filter</button>
        </div>
      )}
    </div>
  );
}
