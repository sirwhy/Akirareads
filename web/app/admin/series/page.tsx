'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiSave, FiLink, FiUpload,
  FiRefreshCw, FiStar, FiChevronDown, FiArrowLeft,
} from 'react-icons/fi';
import AdminShell from '../AdminShell';
import { api, uploadForm } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { asArray, numOr, type SeriesRow } from '../types';
import ChapterManager from '../ChapterManager';

const GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Isekai', 'Magic', 'Martial Arts', 'Mystery', 'Romance', 'School', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'System', 'Thriller'];

interface SeriesForm {
  title: string; slug: string; description: string; author: string; artist: string;
  status: string; type: string; cover: string; featured: boolean; genres: string[];
}
const EMPTY_FORM: SeriesForm = { title: '', slug: '', description: '', author: '', artist: '', status: 'ONGOING', type: 'MANHWA', cover: '', featured: false, genres: [] };

function slugifyClient(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}


/* ── Series create/edit modal (port SeriesForm.js) ──────────────────────── */

function SeriesFormModal({ editing, onClose, onSaved }: {
  editing: SeriesRow | 'new'; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const isEdit = editing !== 'new';
  const [form, setForm] = useState<SeriesForm>(EMPTY_FORM);
  const [fetching, setFetching] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [genreInput, setGenreInput] = useState('');
  const [coverMode, setCoverMode] = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    api.getSeriesById(editing.id).then((d: Record<string, unknown>) => {
      setForm({
        title: String(d.title ?? ''), slug: String(d.slug ?? ''), description: String(d.description ?? ''),
        author: String(d.author ?? ''), artist: String(d.artist ?? ''), status: String(d.status ?? 'ONGOING'),
        type: String(d.type ?? 'MANHWA'), cover: String(d.cover ?? ''), featured: Boolean(d.featured),
        genres: Array.isArray(d.genres) ? (d.genres as string[]) : [],
      });
    }).catch(() => toast.error('Gagal memuat data')).finally(() => setFetching(false));
  }, [editing, isEdit, toast]);

  const set = <K extends keyof SeriesForm>(k: K, v: SeriesForm[K]) => setForm(f => ({ ...f, [k]: v }));
  const toggleGenre = (g: string) => setForm(f => ({ ...f, genres: f.genres.includes(g) ? f.genres.filter(x => x !== g) : [...f.genres, g] }));

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await uploadForm<{ url: string }>('/upload/image', fd);
      set('cover', res.url);
      toast.success('Cover berhasil diupload!');
    } catch (err) { toast.error('Upload gagal: ' + (err instanceof Error ? err.message : '')); }
    finally { setUploading(false); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.slug.trim()) { toast.error('Title dan slug wajib'); return; }
    setBusy(true);
    try {
      if (isEdit) { await api.updateSeries(editing.id, form); toast.success('Series diupdate!'); }
      else { await api.createSeries(form); toast.success('Series dibuat!'); }
      onSaved();
      onClose();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full max-w-2xl bg-dark-800 border border-white/10 rounded-2xl p-6 my-8 animate-slide-up space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <button type="button" onClick={onClose} className="p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/5"><FiArrowLeft /></button>
            {isEdit ? 'Edit Series' : 'Tambah Series Baru'}
          </h3>
          <button type="button" onClick={onClose} className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5"><FiX /></button>
        </div>

        {fetching ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 shimmer rounded-xl" />)}</div>
        ) : (
          <>
            {/* Cover */}
            <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5">
              <h4 className="font-semibold mb-4 text-sm">Cover</h4>
              <div className="flex gap-4">
                <div className="w-28 h-40 rounded-xl overflow-hidden bg-dark-600 border border-white/10 flex-shrink-0 flex items-center justify-center">
                  {form.cover
                    ? <img src={form.cover} alt="Cover" className="w-full h-full object-cover" onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
                    : <span className="text-xs text-white/20 text-center p-2">Preview</span>}
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex gap-1 bg-dark-600 rounded-lg p-1 w-fit">
                    {([['url', '🔗 URL'], ['upload', '📁 Upload']] as const).map(([m, l]) => (
                      <button key={m} type="button" onClick={() => setCoverMode(m)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${coverMode === m ? 'bg-dark-700 text-white' : 'text-white/40 hover:text-white'}`}>{l}</button>
                    ))}
                  </div>
                  {coverMode === 'url' ? (
                    <div className="relative">
                      <FiLink className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm" />
                      <input value={form.cover} onChange={e => set('cover', e.target.value)} placeholder="https://..." className="input text-sm pl-9" />
                    </div>
                  ) : (
                    <div>
                      <label className="btn-ghost text-sm inline-flex items-center gap-2 cursor-pointer disabled:opacity-60">
                        {uploading ? <FiRefreshCw className="animate-spin" /> : <FiUpload />}
                        {uploading ? 'Mengupload...' : 'Pilih Gambar'}
                        <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
                      </label>
                    </div>
                  )}
                  <p className="text-xs text-white/20">Rekomendasi: rasio 3:4, min 300×400px</p>
                </div>
              </div>
            </div>

            {/* Basic info */}
            <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5 space-y-4">
              <h4 className="font-semibold text-sm">Informasi Dasar</h4>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Judul <span className="text-accent">*</span></label>
                <input value={form.title} onChange={e => { set('title', e.target.value); if (!isEdit) set('slug', slugifyClient(e.target.value)); }} placeholder="Judul series" className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Slug <span className="text-accent">*</span></label>
                <input value={form.slug} onChange={e => set('slug', slugifyClient(e.target.value))} placeholder="judul-series" className="input text-sm font-mono" />
                <p className="text-xs text-white/20 mt-1">URL: /series/{form.slug || 'contoh'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input value={form.author} onChange={e => set('author', e.target.value)} placeholder="Penulis" className="input text-sm" />
                <input value={form.artist} onChange={e => set('artist', e.target.value)} placeholder="Ilustrator" className="input text-sm" />
              </div>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} placeholder="Sinopsis..." className="input text-sm resize-none" />
            </div>

            {/* Klasifikasi */}
            <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5 space-y-4">
              <h4 className="font-semibold text-sm">Klasifikasi</h4>
              <div className="grid grid-cols-2 gap-4">
                <select value={form.type} onChange={e => set('type', e.target.value)} className="input text-sm">
                  <option value="MANHWA">Manhwa</option><option value="MANGA">Manga</option><option value="MANHUA">Manhua</option>
                </select>
                <select value={form.status} onChange={e => set('status', e.target.value)} className="input text-sm">
                  <option value="ONGOING">Ongoing</option><option value="COMPLETED">Selesai</option><option value="HIATUS">Hiatus</option><option value="DROPPED">Drop</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => set('featured', !form.featured)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.featured ? 'bg-accent' : 'bg-white/10'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.featured ? 'translate-x-5' : ''}`} />
                </button>
                <span className="text-sm text-white/60">Tampilkan di Featured Hero Banner</span>
              </div>
            </div>

            {/* Genres */}
            <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5">
              <h4 className="font-semibold text-sm mb-4">Genre {form.genres.length > 0 && <span className="text-accent text-xs">({form.genres.length} dipilih)</span>}</h4>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {GENRES.map(g => (
                  <button type="button" key={g} onClick={() => toggleGenre(g)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.genres.includes(g) ? 'border-accent text-accent bg-accent/10' : 'border-white/10 text-white/40 hover:border-white/30'}`}>{g}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={genreInput} onChange={e => setGenreInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const g = genreInput.trim(); if (g && !form.genres.includes(g)) set('genres', [...form.genres, g]); setGenreInput(''); } }}
                  placeholder="Genre custom..." className="input text-sm flex-1" />
                <button type="button" onClick={() => { const g = genreInput.trim(); if (g && !form.genres.includes(g)) set('genres', [...form.genres, g]); setGenreInput(''); }}
                  className="btn-ghost text-sm px-4"><FiPlus /></button>
              </div>
              {form.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {form.genres.map(g => (
                    <span key={g} className="flex items-center gap-1 text-xs bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full">
                      {g} <button type="button" onClick={() => toggleGenre(g)}><FiX className="text-[10px]" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button type="submit" disabled={busy} className="btn-primary flex items-center gap-2 disabled:opacity-60">
                {busy ? <FiRefreshCw className="animate-spin" /> : <FiSave />} {isEdit ? 'Simpan Perubahan' : 'Buat Series'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

/* ── Series list ────────────────────────────────────────────────────────── */

function SeriesInner() {
  const toast = useToast();
  const [rows, setRows] = useState<SeriesRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPagesTotal] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formFor, setFormFor] = useState<SeriesRow | 'new' | null>(null);
  const [drawerFor, setDrawerFor] = useState<SeriesRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSeries({ page, limit: 20, search: debouncedQ || '' });
      setRows(asArray<SeriesRow>(res?.data));
      setTotal(numOr(res?.total));
      setPagesTotal(Math.max(1, numOr(res?.pages, 1)));
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal memuat series'); }
    finally { setLoading(false); }
  }, [page, debouncedQ, toast]);

  useEffect(() => { load(); }, [load]);

  const remove = async (s: SeriesRow) => {
    if (!window.confirm(`Hapus "${s.title}"? Semua chapter akan ikut terhapus.`)) return;
    setBusyId(s.id);
    try { await api.deleteSeries(s.id); toast.success('Series dihapus'); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal'); }
    finally { setBusyId(null); }
  };

  const toggleFeatured = async (s: SeriesRow) => {
    setBusyId(s.id);
    try {
      await api.updateSeries(s.id, { featured: !s.featured });
      setRows(r => r.map(x => x.id === s.id ? { ...x, featured: !s.featured } : x));
      toast.success(s.featured ? 'Dihapus dari featured' : 'Ditampilkan di featured');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Seri</h1>
          <p className="text-white/40 text-sm mt-1">{total} series total</p>
        </div>
        <button onClick={() => setFormFor('new')} className="btn-primary flex items-center gap-2 text-sm"><FiPlus /> Tambah Series</button>
      </div>

      <div className="relative mb-5">
        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari series..." className="input pl-11 text-sm" />
      </div>

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
                    <td className="p-4"><div className="h-6 shimmer rounded w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-white/30">
                  <span className="text-4xl opacity-20">📚</span><br />Belum ada series.
                </td></tr>
              ) : rows.map(s => (
                <tr key={s.id} className="hover:bg-white/2 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-dark-600">
                        {s.cover ? <img src={s.cover} alt={s.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><span className="text-white/10 text-xs">📖</span></div>}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium line-clamp-1 flex items-center gap-1.5">
                          {s.title}
                          {s.featured && <FiStar className="text-gold text-xs flex-shrink-0" title="Featured" />}
                        </p>
                        <p className="text-xs text-white/30 truncate">{s.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell"><span className="badge text-xs text-white/40 bg-white/5">{s.type}</span></td>
                  <td className="p-4 hidden md:table-cell">
                    <span className={`badge text-xs ${s.status === 'ONGOING' ? 'text-green-400 bg-green-400/10' : s.status === 'COMPLETED' ? 'text-blue-400 bg-blue-400/10' : 'text-yellow-400 bg-yellow-400/10'}`}>
                      {s.status === 'ONGOING' ? 'Ongoing' : s.status === 'COMPLETED' ? 'Tamat' : s.status}
                    </span>
                  </td>
                  <td className="p-4 hidden lg:table-cell text-white/50">{numOr(s._count?.chapters)}</td>
                  <td className="p-4 hidden lg:table-cell text-white/50">{numOr(s.views).toLocaleString()}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => setDrawerFor(s)} disabled={busyId === s.id} title="Chapter"
                        className="p-2 text-white/30 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors disabled:opacity-30">
                        <FiChevronDown className="text-sm" />
                      </button>
                      <button onClick={() => toggleFeatured(s)} disabled={busyId === s.id} title={s.featured ? 'Hapus dari featured' : 'Jadikan featured'}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-30 ${s.featured ? 'text-gold hover:bg-gold/10' : 'text-white/30 hover:text-gold hover:bg-gold/10'}`}>
                        <FiStar className="text-sm" />
                      </button>
                      <button onClick={() => setFormFor(s)} className="p-2 text-white/30 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors" title="Edit"><FiEdit2 className="text-sm" /></button>
                      <button onClick={() => remove(s)} disabled={busyId === s.id} className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30" title="Hapus"><FiTrash2 className="text-sm" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="border-t border-white/5 p-4 flex justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 disabled:opacity-30 hover:border-accent hover:text-accent transition-colors">← Prev</button>
            <span className="px-3 py-1.5 text-xs text-white/40">{page} / {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 disabled:opacity-30 hover:border-accent hover:text-accent transition-colors">Next →</button>
          </div>
        )}
      </div>

      {formFor && <SeriesFormModal editing={formFor} onClose={() => setFormFor(null)} onSaved={load} />}
      {drawerFor && <ChapterManager series={drawerFor} onClose={() => setDrawerFor(null)} />}
    </div>
  );
}

export default function AdminSeriesPage() {
  return (
    <AdminShell>
      <SeriesInner />
    </AdminShell>
  );
}
