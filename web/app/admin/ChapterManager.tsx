'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiSave, FiRefreshCw, FiList, FiImage } from 'react-icons/fi';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { asArray, fmtDate, numOr, type ChapterRow, type SeriesRow } from './types';

/**
 * Panel manajemen chapter satu series: list + create/edit/delete + tambah
 * halaman (textarea URL, 1 per baris). Dipakai drawer di tab Seri dan
 * halaman penuh di tab Chapter.
 */
export default function ChapterManager({ series, onClose }: { series: SeriesRow; onClose?: () => void }) {
  const toast = useToast();
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [nf, setNf] = useState({ chapterNum: '', title: '', pages: '' });
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ef, setEf] = useState({ chapterNum: '', title: '' });
  const [pagesFor, setPagesFor] = useState<string | null>(null);
  const [pagesText, setPagesText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getChaptersBySeries(series.id);
      setChapters(asArray<ChapterRow>(res?.chapters ?? res));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat chapter');
    } finally { setLoading(false); }
  }, [series.id, toast]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const num = parseFloat(nf.chapterNum);
    if (!Number.isFinite(num)) { toast.error('Nomor chapter harus angka'); return; }
    const pages = nf.pages.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    setBusy(true);
    try {
      await api.createChapter({ seriesId: series.id, chapterNum: num, title: nf.title || undefined, pages });
      toast.success('Chapter dibuat!');
      setNf({ chapterNum: '', title: '', pages: '' });
      setShowNew(false);
      load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal'); }
    finally { setBusy(false); }
  };

  const saveEdit = async (id: string) => {
    const num = parseFloat(ef.chapterNum);
    if (!Number.isFinite(num)) { toast.error('Nomor chapter harus angka'); return; }
    setBusy(true);
    try {
      await api.updateChapter(id, { chapterNum: num, title: ef.title || null });
      toast.success('Chapter diupdate');
      setEditingId(null);
      load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal'); }
    finally { setBusy(false); }
  };

  const addPages = async (id: string) => {
    const urls = pagesText.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (!urls.length) { toast.error('Tidak ada URL gambar valid (1 per baris)'); return; }
    setBusy(true);
    try {
      const res = await api.addChapterPages(id, urls);
      toast.success(res?.message || `${urls.length} halaman ditambahkan`);
      setPagesFor(null); setPagesText('');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal'); }
    finally { setBusy(false); }
  };

  const remove = async (c: ChapterRow) => {
    if (!window.confirm(`Hapus Chapter ${c.chapterNum}${c.title ? ` — ${c.title}` : ''}?`)) return;
    try { await api.deleteChapter(c.id); toast.success('Chapter dihapus'); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal'); }
  };

  return (
    <div className={onClose ? 'fixed inset-0 z-[70] flex justify-end' : ''}>
      {onClose && <div className="absolute inset-0 bg-black/70" onClick={onClose} />}
      <div className={`relative bg-dark-800 border-l border-white/10 h-full overflow-y-auto p-5 animate-slide-up ${onClose ? 'w-full max-w-xl' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <h3 className="font-bold flex items-center gap-2"><FiList className="text-accent" /> Chapter — <span className="truncate">{series.title}</span></h3>
            <p className="text-xs text-white/30 mt-1">{chapters.length} chapter · <Link className="text-accent hover:underline" href={`/series/${series.slug}`} target="_blank">buka halaman publik →</Link></p>
          </div>
          {onClose && <button onClick={onClose} className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5"><FiX /></button>}
        </div>

        <button onClick={() => setShowNew(v => !v)} className="btn-primary text-sm w-full flex items-center justify-center gap-2 mb-4">
          <FiPlus /> Tambah Chapter
        </button>

        {showNew && (
          <div className="bg-dark-700/50 border border-white/10 rounded-2xl p-4 mb-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <input value={nf.chapterNum} onChange={e => setNf(f => ({ ...f, chapterNum: e.target.value }))} placeholder="No (cth: 12.5)" className="input text-sm col-span-1" />
              <input value={nf.title} onChange={e => setNf(f => ({ ...f, title: e.target.value }))} placeholder="Judul chapter (opsional)" className="input text-sm col-span-2" />
            </div>
            <textarea value={nf.pages} onChange={e => setNf(f => ({ ...f, pages: e.target.value }))} rows={5}
              placeholder={'URL halaman, 1 per baris:\nhttps://.../page1.jpg\nhttps://.../page2.jpg'}
              className="input text-xs font-mono resize-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="btn-ghost text-sm">Batal</button>
              <button onClick={create} disabled={busy} className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60">
                {busy ? <FiRefreshCw className="animate-spin" /> : <FiSave />} Simpan
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-14 shimmer rounded-xl" />)}</div>
        ) : chapters.length === 0 ? (
          <p className="text-center text-white/30 py-10 text-sm">Belum ada chapter.</p>
        ) : (
          <div className="space-y-2">
            {chapters.map(c => (
              <div key={c.id} className="bg-dark-700/40 border border-white/5 rounded-xl px-4 py-3">
                {editingId === c.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <input value={ef.chapterNum} onChange={e => setEf(f => ({ ...f, chapterNum: e.target.value }))} className="input text-sm" placeholder="Nomor" />
                      <input value={ef.title} onChange={e => setEf(f => ({ ...f, title: e.target.value }))} className="input text-sm col-span-2" placeholder="Judul" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingId(null)} className="btn-ghost text-xs px-3 py-1.5">Batal</button>
                      <button onClick={() => saveEdit(c.id)} disabled={busy} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-60">Simpan</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Ch {c.chapterNum}{c.title ? ` — ${c.title}` : ''}</p>
                        <p className="text-xs text-white/30">{numOr(c._count?.pages)} halaman · {numOr(c.views).toLocaleString()} views · {fmtDate(c.createdAt)}</p>
                      </div>
                      <button onClick={() => { setEditingId(c.id); setEf({ chapterNum: String(c.chapterNum), title: c.title || '' }); }}
                        className="p-1.5 text-white/30 hover:text-accent hover:bg-accent/10 rounded-lg" title="Edit"><FiEdit2 className="text-sm" /></button>
                      <button onClick={() => { setPagesFor(pagesFor === c.id ? null : c.id); setPagesText(''); }}
                        className="p-1.5 text-white/30 hover:text-accent hover:bg-accent/10 rounded-lg" title="Tambah halaman"><FiImage className="text-sm" /></button>
                      <button onClick={() => remove(c)} className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg" title="Hapus"><FiTrash2 className="text-sm" /></button>
                    </div>
                    {pagesFor === c.id && (
                      <div className="mt-2 space-y-2">
                        <textarea value={pagesText} onChange={e => setPagesText(e.target.value)} rows={4}
                          placeholder={'URL baru, 1 per baris (ditambahkan setelah halaman terakhir)'}
                          className="input text-xs font-mono resize-none" />
                        <div className="flex justify-end">
                          <button onClick={() => addPages(c.id)} disabled={busy} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-60">
                            {busy ? <FiRefreshCw className="animate-spin" /> : <FiPlus />} Tambah
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
