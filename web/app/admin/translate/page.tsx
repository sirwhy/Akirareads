'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FiRefreshCw, FiChevronDown, FiZap, FiCheck, FiX, FiClock, FiGlobe } from 'react-icons/fi';
import AdminShell from '../AdminShell';
import { api, request } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { asArray, numOr, type ChapterRow, type SeriesRow, type TranslateJobLite } from '../types';

interface StatusInfo { job: TranslateJobLite | null; done: boolean }

const JOB_STATUS: Record<string, { label: string; color: string; icon: typeof FiClock }> = {
  PENDING: { label: 'Antri', color: 'text-yellow-400 bg-yellow-400/10', icon: FiClock },
  RUNNING: { label: 'Proses', color: 'text-blue-400 bg-blue-400/10', icon: FiRefreshCw },
  DONE: { label: 'Selesai', color: 'text-green-400 bg-green-400/10', icon: FiCheck },
  FAILED: { label: 'Gagal', color: 'text-red-400 bg-red-400/10', icon: FiX },
};

function TranslateInner() {
  const toast = useToast();
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [seriesId, setSeriesId] = useState('');
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, StatusInfo | 'loading'>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState('id');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSeries({ page: 1, limit: 100, sort: 'updates' });
      const rows = asArray<SeriesRow>(res?.data);
      setSeries(rows);
      setSeriesId(prev => prev || (rows[0]?.id ?? ''));
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal memuat series'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Chapters seri terpilih (urut turun seperti API) — status lazy per chapter.
  useEffect(() => {
    if (!seriesId) { setChapters([]); return; }
    let alive = true;
    setChapters([]); setStatuses({}); setExpanded(null);
    api.getChaptersBySeries(seriesId).then(res => {
      if (alive) setChapters(asArray<ChapterRow>(res?.chapters ?? res));
    }).catch(err => { if (alive) toast.error(err instanceof Error ? err.message : 'Gagal memuat chapter'); });
    return () => { alive = false; };
  }, [seriesId, toast]);

  const fetchStatus = useCallback(async (chapterId: string) => {
    try {
      const res = await api.translateStatus(chapterId);
      setStatuses(s => ({ ...s, [chapterId]: { job: (res?.job as TranslateJobLite) ?? null, done: Boolean(res?.done) } }));
    } catch {
      setStatuses(s => ({ ...s, [chapterId]: 'loading' }));
    }
  }, []);

  const toggleExpand = (chapterId: string) => {
    if (expanded === chapterId) { setExpanded(null); return; }
    setExpanded(chapterId);
    setStatuses(s => (s[chapterId] ? s : { ...s, [chapterId]: 'loading' }));
    void fetchStatus(chapterId);
  };

  // Poll status chapter yang sedang dibuka selagi job-nya aktif.
  useEffect(() => {
    if (!expanded) return;
    const st = statuses[expanded];
    if (!st || st === 'loading') return;
    const active = st.job && (st.job.status === 'PENDING' || st.job.status === 'RUNNING');
    if (!active) return;
    pollRef.current = window.setInterval(() => void fetchStatus(expanded), 4000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [expanded, statuses, fetchStatus]);

  const translateOne = async (chapterId: string) => {
    setBusy(true);
    try {
      const res = await api.translateChapter(chapterId, targetLang);
      toast.success(res?.queued === false ? 'Chapter sudah dalam antrian' : 'Job translate dibuat!');
      setStatuses(s => ({ ...s, [chapterId]: 'loading' }));
      void fetchStatus(chapterId);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal'); }
    finally { setBusy(false); }
  };

  const translateAll = async () => {
    if (!window.confirm('Terjemahkan SEMUA chapter yang belum jadi di seri ini?')) return;
    setBusy(true);
    try {
      const res = await request<{ queued: number }>(`/translate/series/${seriesId}`, {
        method: 'POST',
        body: JSON.stringify({ targetLang }),
      });
      toast.success(`${numOr(res?.queued)} job diantrekan.`);
      if (expanded) void fetchStatus(expanded);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal'); }
    finally { setBusy(false); }
  };

  const selected = series.find(s => s.id === seriesId);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FiRefreshCw className="text-accent" /> Terjemahan AI</h1>
          <p className="text-white/40 text-sm mt-1">Pipeline OCR → inpaint → MT → render dijalankan worker</p>
        </div>
        <div className="flex items-center gap-2">
          <FiGlobe className="text-white/30" />
          <select value={targetLang} onChange={e => setTargetLang(e.target.value)} className="input text-sm w-28 py-2">
            <option value="id">Indonesia</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div className="mb-5 flex gap-3 items-end flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Pilih Series</label>
          <select value={seriesId} onChange={e => setSeriesId(e.target.value)} className="input text-sm">
            {loading && <option>Memuat…</option>}
            {series.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
        <button onClick={translateAll} disabled={!seriesId || busy}
          className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
          {busy ? <FiRefreshCw className="animate-spin" /> : <FiZap />} Translate semua chapter belum jadi
        </button>
      </div>

      {!selected ? (
        <p className="text-center text-white/30 py-16 text-sm">{loading ? 'Memuat…' : 'Tidak ada series.'}</p>
      ) : chapters.length === 0 ? (
        <p className="text-center text-white/30 py-16 text-sm">Seri ini belum punya chapter.</p>
      ) : (
        <div className="space-y-2">
          {chapters.map(c => {
            const st = statuses[c.id];
            const open = expanded === c.id;
            const info = st && st !== 'loading' ? st : null;
            const job = info?.job ?? null;
            const cfg = job ? (JOB_STATUS[job.status] || JOB_STATUS.PENDING) : null;
            const Icon = cfg?.icon || FiClock;
            return (
              <div key={c.id} className="bg-dark-700/30 border border-white/5 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 min-w-0">
                  <button onClick={() => toggleExpand(c.id)} className="p-1 text-white/30 hover:text-white rounded" title="Status terjemahan">
                    <FiChevronDown className={`text-sm transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">Ch {c.chapterNum}{c.title ? ` — ${c.title}` : ''}</p>
                    <p className="text-xs text-white/30">{numOr(c._count?.pages)} halaman</p>
                  </div>
                  {!open && st && st !== 'loading' && (
                    st.done
                      ? <span className="badge text-xs text-green-400 bg-green-400/10 flex items-center gap-1"><FiCheck className="text-[10px]" /> Jadi</span>
                      : st.job
                        ? <span className={`badge text-xs ${JOB_STATUS[st.job.status]?.color || 'text-white/30 bg-white/5'}`}>{JOB_STATUS[st.job.status]?.label || st.job.status}</span>
                        : <span className="badge text-xs text-white/30 bg-white/5">Belum</span>
                  )}
                  <button onClick={() => translateOne(c.id)} disabled={busy}
                    className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-50 whitespace-nowrap">
                    <FiZap className="text-[10px]" /> Translate
                  </button>
                </div>
                {open && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/5">
                    {st === 'loading' || !st ? (
                      <div className="h-6 shimmer rounded w-1/3 mt-3" />
                    ) : info && info.done && (!job || job.status !== 'RUNNING') ? (
                      <p className="text-xs text-green-400 mt-2 flex items-center gap-1"><FiCheck /> Semua halaman sudah punya hasil terjemahan.</p>
                    ) : job ? (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge text-xs ${cfg?.color || ''}`}><Icon className={`inline text-[10px] mr-1 ${job.status === 'RUNNING' ? 'animate-spin' : ''}`} />{cfg?.label || job.status}</span>
                          <span className="text-xs text-white/30">{job.targetLang || 'id'} · {numOr(job.done)}/{numOr(job.total)}</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${Math.min(100, numOr(job.progress))}%` }} />
                        </div>
                        {(job.message || job.error) && <p className={`text-xs mt-1.5 ${job.status === 'FAILED' ? 'text-red-400/80' : 'text-white/50'}`}>{job.error || job.message}</p>}
                      </div>
                    ) : (
                      <p className="text-xs text-white/30 mt-2">Belum pernah diterjemahkan.</p>
                    )}
                    {info && !info.done && (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => translateOne(c.id)} disabled={busy} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                          {job?.status === 'FAILED' ? 'Coba ulang' : 'Jalankan sekarang'}
                        </button>
                        <Link href={`/read/${c.id}`} target="_blank" className="btn-ghost text-xs px-3 py-1.5">Buka Reader</Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminTranslatePage() {
  return (
    <AdminShell>
      <TranslateInner />
    </AdminShell>
  );
}
