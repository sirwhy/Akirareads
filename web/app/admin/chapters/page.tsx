'use client';

import { useCallback, useEffect, useState } from 'react';
import { FiList, FiRefreshCw } from 'react-icons/fi';
import AdminShell from '../AdminShell';
import ChapterManager from '../ChapterManager';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { asArray, numOr, type SeriesRow } from '../types';

function ChaptersInner() {
  const toast = useToast();
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [seriesId, setSeriesId] = useState('');
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSeries({ page: 1, limit: 100, sort: 'updates' });
      const rows = asArray<SeriesRow>(res?.data);
      setSeries(rows);
      setSeriesId(prev => prev || (rows[0]?.id ?? ''));
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal memuat daftar series'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const selected = series.find(s => s.id === seriesId);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FiList className="text-accent" /> Chapters</h1>
          <p className="text-white/40 text-sm mt-1">
            {numOr(selected?._count?.chapters)} chapter di seri terpilih · {series.length} series (100 terbaru)
          </p>
        </div>
        <button onClick={() => { load(); setReloadKey(k => k + 1); }} className="btn-ghost text-sm flex items-center gap-2">
          <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Muat ulang
        </button>
      </div>

      <div className="mb-5 max-w-md">
        <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Pilih Series</label>
        <select value={seriesId} onChange={e => setSeriesId(e.target.value)} className="input text-sm">
          {loading && <option>Memuat…</option>}
          {!loading && series.length === 0 && <option value="">(belum ada series)</option>}
          {series.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </div>

      {selected ? (
        <div className="bg-dark-800 border border-white/5 rounded-2xl min-h-[400px]">
          <ChapterManager key={`${selected.id}-${reloadKey}`} series={selected} />
        </div>
      ) : (
        !loading && <p className="text-center text-white/30 py-16">Tidak ada series. Buat lewat tab <strong>Seri</strong> atau Mirror Import.</p>
      )}
    </div>
  );
}

export default function AdminChaptersPage() {
  return (
    <AdminShell>
      <ChaptersInner />
    </AdminShell>
  );
}
