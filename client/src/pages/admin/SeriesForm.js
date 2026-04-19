import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiArrowLeft, FiPlus, FiX, FiUpload, FiLink } from 'react-icons/fi';
import api from '../../api';
import toast from 'react-hot-toast';

const GENRES = ['Action','Adventure','Comedy','Drama','Fantasy','Horror','Isekai','Magic','Martial Arts','Mystery','Romance','School','Sci-Fi','Slice of Life','Sports','Supernatural','System','Thriller'];
const INIT   = { title:'', slug:'', description:'', author:'', artist:'', status:'ONGOING', type:'MANHWA', cover:'', featured:false, genres:[] };

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}

export default function AdminSeriesForm() {
  const { id } = useParams();
  const navigate  = useNavigate();
  const isEdit    = !!id;
  const [form,    setForm]    = useState(INIT);
  const [loading, setLoading] = useState(false);
  const [fetching,setFetching]= useState(isEdit);
  const [genreInput, setGenreInput] = useState('');
  const [coverMode,  setCoverMode]  = useState('url'); // url | upload
  const [uploading,  setUploading]  = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (isEdit) {
      api.getSeriesById(id).then(d => {
        setForm({ title:d.title||'', slug:d.slug||'', description:d.description||'', author:d.author||'', artist:d.artist||'', status:d.status||'ONGOING', type:d.type||'MANHWA', cover:d.cover||'', featured:d.featured||false, genres:d.genres||[] });
      }).catch(() => toast.error('Gagal memuat data')).finally(() => setFetching(false));
    }
  }, [id, isEdit]);

  const set = (k, v) => setForm(f => ({...f, [k]:v}));

  const handleTitleChange = (v) => { set('title', v); if (!isEdit) set('slug', slugify(v)); };

  const toggleGenre = (g) => setForm(f => ({...f, genres: f.genres.includes(g) ? f.genres.filter(x=>x!==g) : [...f.genres, g]}));

  const addCustomGenre = () => {
    const g = genreInput.trim();
    if (g && !form.genres.includes(g)) setForm(f => ({...f, genres:[...f.genres, g]}));
    setGenreInput('');
  };

  // Upload cover dari file/galeri
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.uploadImage(file);
      set('cover', res.url);
      toast.success('Cover berhasil diupload!');
    } catch (err) { toast.error('Upload gagal: ' + err.message); }
    finally { setUploading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.slug.trim()) { toast.error('Title dan slug wajib'); return; }
    setLoading(true);
    try {
      if (isEdit) { await api.updateSeries(id, form); toast.success('Series diupdate!'); }
      else        { await api.createSeries(form);     toast.success('Series dibuat!'); }
      navigate('/admin/series');
    } catch (err) { toast.error(err.message || 'Gagal'); }
    finally { setLoading(false); }
  };

  if (fetching) return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3 mb-7">
        <button onClick={() => navigate('/admin/series')} className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5"><FiArrowLeft/></button>
        <div>
          <h1 className="text-2xl font-bold">{isEdit ? 'Edit Series' : 'Tambah Series Baru'}</h1>
          <p className="text-white/30 text-sm mt-0.5">{isEdit ? form.title : 'Manhwa, manga, atau manhua baru'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Cover */}
        <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5">
          <h2 className="font-semibold mb-4 text-sm">Cover</h2>
          <div className="flex gap-4">
            {/* Preview */}
            <div className="w-28 h-40 rounded-xl overflow-hidden bg-dark-600 border border-white/10 flex-shrink-0 flex items-center justify-center">
              {form.cover
                ? <img src={form.cover} alt="Cover" className="w-full h-full object-cover" onError={e => e.target.style.display='none'}/>
                : <span className="text-xs text-white/20 text-center p-2">Preview</span>}
            </div>
            <div className="flex-1 space-y-3">
              {/* Mode toggle */}
              <div className="flex gap-1 bg-dark-600 rounded-lg p-1 w-fit">
                {[['url','🔗 URL'],['upload','📁 Upload']].map(([m,l]) => (
                  <button key={m} type="button" onClick={() => setCoverMode(m)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${coverMode===m ? 'bg-dark-700 text-white' : 'text-white/40 hover:text-white'}`}>{l}</button>
                ))}
              </div>

              {coverMode === 'url' ? (
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">URL Cover</label>
                  <div className="relative">
                    <FiLink className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm"/>
                    <input value={form.cover} onChange={e => set('cover', e.target.value)}
                      placeholder="https://..." className="input text-sm pl-9"/>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Upload dari Galeri/File</label>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload}/>
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="btn-ghost text-sm flex items-center gap-2 disabled:opacity-60">
                    {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <FiUpload/>}
                    {uploading ? 'Mengupload...' : 'Pilih Gambar'}
                  </button>
                  {form.cover && <p className="text-xs text-green-400 mt-2 flex items-center gap-1">✅ Gambar berhasil diupload</p>}
                </div>
              )}
              <p className="text-xs text-white/20">Rekomendasi: rasio 3:4, min 300×400px</p>
            </div>
          </div>
        </div>

        {/* Basic info */}
        <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-sm">Informasi Dasar</h2>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Judul <span className="text-accent">*</span></label>
            <input value={form.title} onChange={e => handleTitleChange(e.target.value)} placeholder="Judul series" className="input text-sm"/>
          </div>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Slug <span className="text-accent">*</span></label>
            <input value={form.slug} onChange={e => set('slug', slugify(e.target.value))} placeholder="judul-series" className="input text-sm font-mono"/>
            <p className="text-xs text-white/20 mt-1">URL: /series/{form.slug || 'contoh'}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Penulis</label>
              <input value={form.author} onChange={e => set('author', e.target.value)} placeholder="Nama penulis" className="input text-sm"/>
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Ilustrator</label>
              <input value={form.artist} onChange={e => set('artist', e.target.value)} placeholder="Nama ilustrator" className="input text-sm"/>
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Deskripsi</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} placeholder="Sinopsis..." className="input text-sm resize-none"/>
          </div>
        </div>

        {/* Type, Status */}
        <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-sm">Klasifikasi</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Tipe</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className="input text-sm">
                <option value="MANHWA">Manhwa</option>
                <option value="MANGA">Manga</option>
                <option value="MANHUA">Manhua</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="input text-sm">
                <option value="ONGOING">Ongoing</option>
                <option value="COMPLETED">Selesai</option>
                <option value="HIATUS">Hiatus</option>
                <option value="DROPPED">Drop</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => set('featured', !form.featured)}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.featured?'bg-accent':'bg-white/10'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.featured?'translate-x-5':''}`}/>
            </button>
            <span className="text-sm text-white/60">Tampilkan di Featured Hero Banner</span>
          </div>
        </div>

        {/* Genres */}
        <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5">
          <h2 className="font-semibold text-sm mb-4">Genre {form.genres.length > 0 && <span className="text-accent text-xs">({form.genres.length} dipilih)</span>}</h2>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {GENRES.map(g => (
              <button type="button" key={g} onClick={() => toggleGenre(g)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.genres.includes(g) ? 'border-accent text-accent bg-accent/10' : 'border-white/10 text-white/40 hover:border-white/30'}`}>{g}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={genreInput} onChange={e => setGenreInput(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter'){ e.preventDefault(); addCustomGenre(); }}}
              placeholder="Genre custom..." className="input text-sm flex-1"/>
            <button type="button" onClick={addCustomGenre} className="btn-ghost text-sm px-4"><FiPlus/></button>
          </div>
          {form.genres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {form.genres.map(g => (
                <span key={g} className="flex items-center gap-1 text-xs bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full">
                  {g} <button type="button" onClick={() => toggleGenre(g)}><FiX className="text-[10px]"/></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2 disabled:opacity-60">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <FiSave/>}
            {isEdit ? 'Simpan Perubahan' : 'Buat Series'}
          </button>
          <button type="button" onClick={() => navigate('/admin/series')} className="btn-ghost text-sm">Batal</button>
        </div>
      </form>
    </div>
  );
}
