import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiArrowLeft, FiPlus, FiTrash2, FiUpload, FiLink } from 'react-icons/fi';
import api from '../../api';
import toast from 'react-hot-toast';

export default function AdminChapterForm() {
  const { id }  = useParams();
  const navigate = useNavigate();
  const isEdit   = !!id;
  const [allSeries, setAllSeries] = useState([]);
  const [form,    setForm]    = useState({ seriesId:'', chapterNum:'', title:'' });
  const [pages,   setPages]   = useState(['']);
  const [loading, setLoading] = useState(false);
  const [fetching,setFetching]= useState(isEdit);
  const [pageMode,setPageMode]= useState('url');   // url | upload
  const [uploading,setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef(null);

  useEffect(() => {
    api.getSeries({ limit: 300 }).then(r => setAllSeries(r.series || []));
    if (isEdit) {
      api.getChapter(id).then(d => {
        setForm({ seriesId: d.seriesId||'', chapterNum: d.chapterNum||'', title: d.title||'' });
        if (d.pages?.length) setPages(d.pages.map(p => p.imageUrl));
        else setPages(['']);
      }).catch(() => toast.error('Gagal memuat chapter')).finally(() => setFetching(false));
    }
  }, [id, isEdit]);

  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const handlePage = (i, v) => setPages(p => { const a=[...p]; a[i]=v; return a; });
  const addPage = () => setPages(p => [...p,'']);
  const removePage = (i) => setPages(p => p.filter((_,idx)=>idx!==i));

  const handleBulkPaste = (text) => {
    const urls = text.split('\n').map(l=>l.trim()).filter(Boolean);
    if (urls.length > 0) setPages(urls);
  };

  // Upload pages dari file/galeri (multiple)
  const handleFilesUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      toast.loading(`Mengupload ${files.length} gambar...`, { id:'upload' });
      const res = await api.uploadImages(files);
      setPages(prev => {
        const existing = prev.filter(p => p.trim());
        return [...existing, ...res.urls];
      });
      setUploadProgress(100);
      toast.success(`${res.count} halaman berhasil diupload!`, { id:'upload' });
    } catch (err) {
      toast.error('Upload gagal: ' + err.message, { id:'upload' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.seriesId || !form.chapterNum) { toast.error('Series dan nomor chapter wajib'); return; }
    const validPages = pages.filter(p => p.trim());
    setLoading(true);
    try {
      if (isEdit) {
        await api.updateChapter(id, { title: form.title, chapterNum: form.chapterNum });
        if (validPages.length > 0) await api.addPages(id, validPages);
        toast.success('Chapter diupdate!');
      } else {
        await api.createChapter({ ...form, chapterNum: parseFloat(form.chapterNum), pages: validPages });
        toast.success('Chapter dibuat!');
      }
      navigate('/admin/chapters');
    } catch (err) { toast.error(err.message || 'Gagal'); }
    finally { setLoading(false); }
  };

  if (fetching) return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"/></div>;

  const validPageCount = pages.filter(p => p.trim()).length;

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3 mb-7">
        <button onClick={() => navigate('/admin/chapters')} className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5"><FiArrowLeft/></button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Chapter' : 'Tambah Chapter'}</h1>
          <p className="text-white/30 text-sm mt-0.5">Upload halaman via URL atau file dari galeri</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Info */}
        <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-sm">Informasi Chapter</h2>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Series <span className="text-accent">*</span></label>
            <select value={form.seriesId} onChange={e => set('seriesId', e.target.value)} className="input text-sm" disabled={isEdit}>
              <option value="">-- Pilih Series --</option>
              {allSeries.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Nomor Chapter <span className="text-accent">*</span></label>
              <input type="number" step="0.1" value={form.chapterNum} onChange={e => set('chapterNum', e.target.value)} placeholder="1, 1.5, 2..." className="input text-sm"/>
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Judul (opsional)</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Judul chapter" className="input text-sm"/>
            </div>
          </div>
        </div>

        {/* Pages */}
        <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-sm">Halaman</h2>
              <p className="text-xs text-white/30 mt-0.5">{validPageCount} halaman valid</p>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 bg-dark-600 rounded-lg p-1 w-fit mb-4">
            {[['url','🔗 Paste URL'],['upload','📁 Upload File']].map(([m,l]) => (
              <button key={m} type="button" onClick={() => setPageMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${pageMode===m?'bg-dark-700 text-white':'text-white/40 hover:text-white'}`}>{l}</button>
            ))}
          </div>

          {pageMode === 'upload' ? (
            <div className="space-y-3">
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesUpload}/>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full border-2 border-dashed border-white/10 hover:border-accent/50 rounded-xl p-8 text-center transition-colors disabled:opacity-60">
                {uploading ? (
                  <div>
                    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2"/>
                    <p className="text-sm text-white/60">Mengupload...</p>
                  </div>
                ) : (
                  <div>
                    <FiUpload className="text-3xl text-white/20 mx-auto mb-2"/>
                    <p className="text-sm text-white/60 font-medium">Klik untuk pilih gambar dari galeri</p>
                    <p className="text-xs text-white/30 mt-1">JPG, PNG, WebP — bisa pilih banyak sekaligus</p>
                    <p className="text-xs text-white/20 mt-1">Pastikan nama file sudah urut (01.jpg, 02.jpg, ...)</p>
                  </div>
                )}
              </button>
              {validPageCount > 0 && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-sm text-green-400">
                  ✅ {validPageCount} halaman siap — akan disimpan saat submit
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Bulk paste */}
              <div className="p-3 bg-dark-600/50 rounded-xl border border-white/5">
                <p className="text-xs text-white/40 mb-2">📋 Paste massal (1 URL per baris):</p>
                <textarea rows={4}
                  placeholder={"https://cdn.example.com/page01.jpg\nhttps://cdn.example.com/page02.jpg\n..."}
                  className="input text-xs font-mono resize-none mb-2"
                  onBlur={e => { if (e.target.value.includes('\n') || e.target.value.trim()) { handleBulkPaste(e.target.value); e.target.value=''; }}}/>
                <p className="text-xs text-white/20">Tab keluar/blur dari textarea untuk menerapkan URL</p>
              </div>

              {/* Individual inputs */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/40">URL individual:</p>
                <button type="button" onClick={addPage} className="text-xs text-accent hover:text-accent-light flex items-center gap-1"><FiPlus/> Tambah</button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {pages.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-white/20 w-7 text-right flex-shrink-0">{i+1}</span>
                    <div className="relative flex-1">
                      <FiLink className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 text-xs"/>
                      <input value={url} onChange={e => handlePage(i, e.target.value)}
                        placeholder={`https://cdn.example.com/p${String(i+1).padStart(2,'0')}.jpg`}
                        className="input text-xs font-mono pl-8"/>
                    </div>
                    {pages.length > 1 && (
                      <button type="button" onClick={() => removePage(i)} className="text-white/20 hover:text-red-400 transition-colors"><FiTrash2 className="text-xs"/></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 disabled:opacity-60">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <FiSave/>}
            {isEdit ? 'Simpan' : 'Buat Chapter'}
          </button>
          <button type="button" onClick={() => navigate('/admin/chapters')} className="btn-ghost text-sm">Batal</button>
        </div>
      </form>
    </div>
  );
}
