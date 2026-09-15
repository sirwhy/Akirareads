'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FiLink, FiTrash2, FiRefreshCw, FiCheck, FiX, FiClock,
  FiZap, FiList, FiTerminal, FiCopy, FiInfo, FiAlertCircle,
} from 'react-icons/fi';
import AdminShell from '../AdminShell';
import { api, getToken } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { asArray, firstStr, numOr, timeAgo, type MirrorJob } from '../types';
import { buildMadaraImportScript, buildShinigamiImportScript } from '../browser-import';

const STATUS_CFG: Record<string, { label: string; color: string; icon: typeof FiClock }> = {
  PENDING: { label: 'Antri', color: 'text-yellow-400 bg-yellow-400/10', icon: FiClock },
  RUNNING: { label: 'Proses', color: 'text-blue-400 bg-blue-400/10', icon: FiRefreshCw },
  DONE: { label: 'Selesai', color: 'text-green-400 bg-green-400/10', icon: FiCheck },
  FAILED: { label: 'Gagal', color: 'text-red-400 bg-red-400/10', icon: FiX },
};

function MirrorInner() {
  const toast = useToast();
  const [jobs, setJobs] = useState<MirrorJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [urlInput, setUrlInput] = useState('');
  const [bulkUrls, setBulkUrls] = useState('');
  const [mode, setMode] = useState<'single' | 'bulk' | 'browser'>('single');
  const [submitting, setSubmitting] = useState(false);
  const [browserSite, setBrowserSite] = useState<'ikiru' | 'shinigami'>('ikiru');
  const [script, setScript] = useState('');
  const pollRef = useRef<number | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const res = await api.mirrorJobs();
      setJobs(asArray<MirrorJob>(res?.jobs ?? res));
    } catch { /* toast sekali di awal; polling senyap */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadJobs();
    // Auto-refresh 5 detik selama masih ada job aktif (kontrak: poll list).
    pollRef.current = window.setInterval(() => {
      setJobs(prev => {
        if (prev.some(j => j.status === 'RUNNING' || j.status === 'PENDING')) void loadJobs();
        return prev;
      });
    }, 5000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [loadJobs]);

  const handleSingle = async () => {
    if (!urlInput.trim().startsWith('http')) { toast.error('URL harus dimulai dari http/https'); return; }
    setSubmitting(true);
    try {
      await api.mirrorCreate(urlInput.trim());
      toast.success('✅ Job dibuat! Worker akan memproses.');
      setUrlInput('');
      setTimeout(loadJobs, 500);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal'); }
    finally { setSubmitting(false); }
  };

  const handleBulk = async () => {
    const urls = bulkUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (!urls.length) { toast.error('Tidak ada URL valid'); return; }
    setSubmitting(true);
    let ok = 0;
    const errors: string[] = [];
    for (const u of urls.slice(0, 20)) {
      try { await api.mirrorCreate(u); ok++; }
      catch (err) { errors.push(`${u}: ${err instanceof Error ? err.message : 'gagal'}`); }
    }
    setSubmitting(false);
    if (ok) toast.success(`✅ ${ok} job dibuat!`);
    if (errors.length) toast.error(`${errors.length} URL gagal: ${errors[0]}`);
    setBulkUrls('');
    setTimeout(loadJobs, 500);
  };

  const generateScript = () => {
    // Script console: target ${window.location.origin}/api/import/batch,
    // X-Admin-Key dari NEXT_PUBLIC_ADMIN_KEY (kosong → prompt saat runtime),
    // Bearer = token admin sesi ini.
    const key = process.env.NEXT_PUBLIC_ADMIN_KEY || '';
    const token = getToken() || '';
    const built = browserSite === 'shinigami'
      ? buildShinigamiImportScript(key, token)
      : buildMadaraImportScript(key, token);
    setScript(built);
    toast.success('Script siap! Copy ke Console browser.');
  };

  const copyScript = () => {
    navigator.clipboard.writeText(script).then(
      () => toast.success('Script disalin!'),
      () => toast.error('Browser menolak copy — seleksi manual textarea.'),
    );
  };

  const handleDelete = async (job: MirrorJob) => {
    const running = job.status === 'RUNNING';
    if (!window.confirm(running ? `Batalkan job berjalan ini?` : `Hapus job ini dari riwayat?`)) return;
    try {
      const res = await api.mirrorDelete(job.id);
      toast.success(res?.cancelled ? 'Job dibatalkan' : 'Job dihapus');
      loadJobs();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal'); }
  };

  const runningCount = jobs.filter(j => j.status === 'RUNNING' || j.status === 'PENDING').length;

  const MODES: { id: typeof mode; label: string }[] = [
    { id: 'single', label: '🔗 URL Series' },
    { id: 'bulk', label: '📋 Bulk (banyak)' },
    { id: 'browser', label: '🌐 Browser Import (ikiru / shinigami)' },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FiZap className="text-accent" /> Mirror / Import</h1>
          <p className="text-white/40 text-sm mt-1">Import manhwa/manga dari URL sumber</p>
        </div>
        {runningCount > 0 && (
          <span className="badge text-xs text-blue-400 bg-blue-400/10 flex items-center gap-1">
            <FiRefreshCw className="animate-spin text-[10px]" /> {runningCount} berjalan
          </span>
        )}
      </div>

      <div className="flex gap-1 mb-5 bg-dark-700/30 border border-white/5 rounded-xl p-1">
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all text-center ${mode === m.id ? 'bg-dark-600 text-white shadow' : 'text-white/40 hover:text-white'}`}>
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'single' && (
        <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5 mb-6">
          <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-xl mb-4 text-xs text-green-400">
            <strong>✅ MangaDex</strong> — semua chapter diimport otomatis<br />
            <strong className="text-yellow-400">🟡 Madara sites</strong> — ikiru.id/komiku.id: berhasil jika Cloudflare tidak aktif
          </div>
          <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">URL Series</label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <FiLink className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSingle(); }}
                placeholder="https://mangadex.org/title/UUID/... atau https://ikiru.id/manga/judul/"
                className="input pl-11 text-sm" />
            </div>
            <button onClick={handleSingle} disabled={submitting || !urlInput}
              className="btn-primary flex items-center gap-2 text-sm whitespace-nowrap disabled:opacity-60">
              {submitting ? <FiRefreshCw className="animate-spin" /> : <FiZap />} Import
            </button>
          </div>
        </div>
      )}

      {mode === 'bulk' && (
        <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5 mb-6">
          <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">URL (1 per baris, maks 20)</label>
          <textarea value={bulkUrls} onChange={e => setBulkUrls(e.target.value)} rows={6}
            placeholder={'https://mangadex.org/title/UUID-1/\nhttps://ikiru.id/manga/judul-1/'}
            className="input text-sm font-mono resize-none mb-3" />
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/30">{bulkUrls.split('\n').filter(u => u.trim().startsWith('http')).length} URL valid</p>
            <button onClick={handleBulk} disabled={submitting}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60">
              {submitting ? <FiRefreshCw className="animate-spin" /> : <FiZap />} Import Semua
            </button>
          </div>
        </div>
      )}

      {mode === 'browser' && (
        <div className="space-y-4 mb-6">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4">
            <div className="flex items-start gap-2">
              <FiInfo className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-white/60">
                <p className="font-semibold text-blue-400 mb-1">Kenapa perlu Browser Import?</p>
                <p>ikiru.id dan shinigami.asia menggunakan <strong>Cloudflare anti-bot</strong> yang memblokir akses server langsung. Satu-satunya cara: <strong>kamu buka di browser sendiri</strong> (CF sudah lolos), lalu script otomatis ambil data dan kirim ke <code className="text-accent">/api/import/batch</code> AKIRAREADS.</p>
              </div>
            </div>
          </div>

          <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5">
            <h3 className="font-semibold mb-4 text-sm">Pilih Website</h3>
            <div className="flex gap-2 mb-4">
              {([['ikiru', 'ikiru.id / 03.ikiru.wtf'], ['shinigami', 'shinigami.asia']] as const).map(([id, label]) => (
                <button key={id} onClick={() => { setBrowserSite(id); setScript(''); }}
                  className={`px-4 py-2 rounded-lg text-sm border transition-colors ${browserSite === id ? 'border-accent text-accent bg-accent/10' : 'border-white/10 text-white/50 hover:border-white/30'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-3 mb-4">
              <p className="text-xs text-white/40 font-semibold uppercase tracking-widest">Cara Pakai:</p>
              {[
                `Buka halaman series di ${browserSite === 'shinigami' ? 'shinigami.asia' : 'ikiru.id'} di browser kamu (Chrome/Firefox)`,
                'Klik tombol "Generate Script" di bawah',
                'Copy script yang muncul',
                'Di halaman tersebut, tekan F12 → tab Console',
                'Paste script → tekan Enter',
                'Tunggu notifikasi "✅ Berhasil dikirim ke AKIRAREADS!"',
                'Kembali ke sini dan buka tab Seri untuk melihat hasilnya',
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3 text-xs text-white/50">
                  <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center flex-shrink-0 font-bold">{i + 1}</span>
                  {step}
                </div>
              ))}
            </div>

            <button onClick={generateScript}
              className="btn-primary flex items-center gap-2 text-sm mb-4">
              <FiTerminal /> Generate Script untuk {browserSite === 'shinigami' ? 'Shinigami' : 'ikiru.id'}
            </button>

            {script && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-white/40">Script (copy ke Console browser):</p>
                  <button onClick={copyScript} className="flex items-center gap-1 text-xs text-accent hover:text-accent-light transition-colors">
                    <FiCopy className="text-[10px]" /> Copy
                  </button>
                </div>
                <textarea readOnly value={script} rows={10}
                  className="input text-xs font-mono resize-none bg-dark-900 text-green-400 cursor-text"
                  onClick={e => (e.target as HTMLTextAreaElement).select()} />
                <p className="text-xs text-yellow-400/70 mt-2 flex items-center gap-1">
                  <FiAlertCircle className="text-[10px]" /> Script ini berisi token login admin kamu. Jangan share ke orang lain.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm flex items-center gap-2"><FiList /> Riwayat Import ({jobs.length})</h2>
          <button onClick={loadJobs} className="text-xs text-white/30 hover:text-accent transition-colors flex items-center gap-1">
            <FiRefreshCw className="text-[10px]" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 shimmer rounded-2xl" />)}</div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12 text-white/30">
            <FiZap className="text-4xl mx-auto mb-3 opacity-20" />
            <p>Belum ada import.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => {
              const cfg = STATUS_CFG[firstStr(job.status, 'PENDING')] || STATUS_CFG.PENDING;
              const Icon = cfg.icon;
              const progress = numOr(job.progress);
              const total = numOr(job.total);
              return (
                <div key={job.id} className="bg-dark-700/30 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                      <Icon className={`text-sm ${job.status === 'RUNNING' ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`badge text-xs ${cfg.color}`}>{cfg.label}</span>
                        <span className="badge text-xs text-white/30 bg-white/5">{firstStr(job.sourceSite, 'generic')}</span>
                        <span className="text-xs text-white/20">{timeAgo(job.createdAt)}</span>
                      </div>
                      <p className="text-xs text-white/30 font-mono truncate mb-1" title={job.sourceUrl}>{job.sourceUrl}</p>
                      {job.message && (
                        <p className={`text-xs ${job.status === 'FAILED' ? 'text-red-400/80' : 'text-white/50'}`}>{job.message}</p>
                      )}
                      {job.status === 'RUNNING' && total > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-white/30 mb-1">
                            <span>Progress</span><span>{progress}/{total}</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-accent rounded-full transition-all"
                              style={{ width: `${Math.min(100, Math.round((progress / total) * 100))}%` }} />
                          </div>
                        </div>
                      )}
                      {job.status === 'DONE' && job.seriesId && (
                        <Link href="/admin/series" className="inline-flex items-center gap-1 mt-2 text-xs text-accent hover:underline">
                          📖 Import selesai — buka di daftar Seri →
                        </Link>
                      )}
                    </div>
                    <button onClick={() => handleDelete(job)}
                      className="text-white/20 hover:text-red-400 transition-colors p-1 flex-shrink-0"
                      title={job.status === 'RUNNING' ? 'Batalkan' : 'Hapus'}>
                      {job.status === 'RUNNING' ? <FiX className="text-sm" /> : <FiTrash2 className="text-sm" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminMirrorPage() {
  return (
    <AdminShell>
      <MirrorInner />
    </AdminShell>
  );
}
