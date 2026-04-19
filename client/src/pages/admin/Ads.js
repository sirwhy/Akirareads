import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiSave, FiX, FiMonitor } from 'react-icons/fi';
import api from '../../api';
import toast from 'react-hot-toast';

const POSITIONS = ['HEADER', 'SIDEBAR', 'BETWEEN_CHAPTERS', 'FOOTER', 'POPUP'];
const POSITION_LABEL = { HEADER: 'Header', SIDEBAR: 'Sidebar', BETWEEN_CHAPTERS: 'Antara Chapter', FOOTER: 'Footer', POPUP: 'Popup' };
const INIT_AD = { name: '', position: 'SIDEBAR', code: '', imageUrl: '', linkUrl: '', active: true };

export default function AdminAds() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(INIT_AD);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setAds(await api.getAllAds()); }
    catch { toast.error('Gagal memuat iklan'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(INIT_AD); setEditing(null); setShowForm(true); };
  const openEdit = (ad) => { setForm({ name: ad.name, position: ad.position, code: ad.code || '', imageUrl: ad.imageUrl || '', linkUrl: ad.linkUrl || '', active: ad.active }); setEditing(ad.id); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleSave = async () => {
    if (!form.name || !form.position) { toast.error('Nama dan posisi wajib'); return; }
    setSaving(true);
    try {
      if (editing) { await api.updateAd(editing, form); toast.success('Iklan diupdate'); }
      else { await api.createAd(form); toast.success('Iklan dibuat'); }
      load(); closeForm();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Hapus iklan "${name}"?`)) return;
    try { await api.deleteAd(id); toast.success('Iklan dihapus'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const toggleActive = async (ad) => {
    try { await api.updateAd(ad.id, { ...ad, active: !ad.active }); load(); }
    catch { toast.error('Gagal update'); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Manajemen Iklan</h1>
          <p className="text-white/40 text-sm mt-1">Kelola iklan yang tampil di website</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm"><FiPlus /> Tambah Iklan</button>
      </div>

      {/* Info card */}
      <div className="bg-dark-700/30 border border-accent/10 rounded-2xl p-4 mb-6 text-sm text-white/50">
        <p className="font-semibold text-accent mb-2">💡 Cara Pasang Iklan</p>
        <p>Masukkan kode iklan (Google AdSense, dll) di kolom "Kode Iklan". Untuk banner gambar, gunakan URL gambar + URL tujuan. Pilih posisi yang sesuai dengan layout website.</p>
      </div>

      {/* Ads grid */}
      <div className="space-y-3">
        {loading ? Array(3).fill(0).map((_, i) => (
          <div key={i} className="bg-dark-700/30 border border-white/5 rounded-2xl p-4 flex gap-4">
            <div className="h-10 shimmer rounded flex-1" />
            <div className="h-10 shimmer rounded w-24" />
          </div>
        )) : ads.length === 0 ? (
          <div className="bg-dark-700/30 border border-white/5 rounded-2xl py-16 text-center text-white/30">
            <FiMonitor className="text-4xl mx-auto mb-3 opacity-20" />
            <p>Belum ada iklan. Klik "Tambah Iklan" untuk mulai.</p>
          </div>
        ) : ads.map(ad => (
          <div key={ad.id} className="bg-dark-700/30 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{ad.name}</span>
                <span className="badge text-xs text-white/30 bg-white/5">{POSITION_LABEL[ad.position]}</span>
              </div>
              {ad.code && <p className="text-xs text-white/30 font-mono truncate max-w-sm">{ad.code.substring(0, 60)}...</p>}
              {ad.imageUrl && <p className="text-xs text-white/30 truncate max-w-sm">🖼 {ad.imageUrl}</p>}
            </div>
            <div className="flex items-center gap-2">
              {/* Toggle active */}
              <button onClick={() => toggleActive(ad)}
                className={`relative w-9 h-5 rounded-full transition-colors ${ad.active ? 'bg-accent' : 'bg-white/10'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${ad.active ? 'translate-x-4' : ''}`} />
              </button>
              <button onClick={() => openEdit(ad)} className="p-2 text-white/30 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors"><FiEdit2 className="text-sm" /></button>
              <button onClick={() => handleDelete(ad.id, ad.name)} className="p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><FiTrash2 className="text-sm" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-dark-800 border border-white/10 rounded-2xl shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <h2 className="font-semibold">{editing ? 'Edit Iklan' : 'Tambah Iklan Baru'}</h2>
              <button onClick={closeForm} className="text-white/40 hover:text-white transition-colors"><FiX /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Nama Iklan *</label>
                <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Contoh: Google AdSense Header" className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Posisi *</label>
                <select value={form.position} onChange={e => setForm(f=>({...f,position:e.target.value}))} className="input text-sm">
                  {POSITIONS.map(p => <option key={p} value={p}>{POSITION_LABEL[p]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Kode Iklan (HTML/JS)</label>
                <textarea value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value}))} rows={4} placeholder='<script async src="https://pagead2.googlesyndication.com/..." />' className="input text-xs font-mono resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">URL Gambar Banner</label>
                  <input value={form.imageUrl} onChange={e => setForm(f=>({...f,imageUrl:e.target.value}))} placeholder="https://..." className="input text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Link Tujuan</label>
                  <input value={form.linkUrl} onChange={e => setForm(f=>({...f,linkUrl:e.target.value}))} placeholder="https://..." className="input text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setForm(f=>({...f,active:!f.active}))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.active ? 'bg-accent' : 'bg-white/10'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.active ? 'translate-x-5' : ''}`} />
                </button>
                <span className="text-sm text-white/60">Aktif ditampilkan</span>
              </div>
            </div>
            <div className="p-5 border-t border-white/5 flex gap-3">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiSave />}
                Simpan
              </button>
              <button onClick={closeForm} className="btn-ghost text-sm">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
