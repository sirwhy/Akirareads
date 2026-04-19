import React, { useState, useEffect } from 'react';
import { FiSave, FiLock, FiEye, FiEyeOff, FiCheck } from 'react-icons/fi';
import api from '../../api';
import toast from 'react-hot-toast';

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    site_name: '', site_description: '', ads_enabled: 'true', maintenance_mode: 'false'
  });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  // Change password state
  const [pwForm,    setPwForm]    = useState({ currentPassword:'', newPassword:'', confirm:'' });
  const [showPw,    setShowPw]    = useState(false);
  const [savingPw,  setSavingPw]  = useState(false);
  const [pwChecks,  setPwChecks]  = useState({ length:false, match:false });

  useEffect(() => {
    api.getSettings().then(d => setSettings(s => ({...s,...d}))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPwChecks({
      length: pwForm.newPassword.length >= 6,
      match:  pwForm.newPassword === pwForm.confirm && pwForm.confirm !== '',
    });
  }, [pwForm]);

  const set = (k,v) => setSettings(s => ({...s,[k]:v}));

  const handleSaveSettings = async () => {
    setSaving(true);
    try { await api.updateSettings(settings); toast.success('Pengaturan disimpan!'); }
    catch (err) { toast.error(err.message || 'Gagal menyimpan'); }
    finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (!pwForm.currentPassword) { toast.error('Masukkan password lama'); return; }
    if (!pwChecks.length) { toast.error('Password baru minimal 6 karakter'); return; }
    if (!pwChecks.match)  { toast.error('Konfirmasi password tidak cocok'); return; }
    setSavingPw(true);
    try {
      await api.adminChangePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast.success('Password berhasil diubah!');
      setPwForm({ currentPassword:'', newPassword:'', confirm:'' });
    } catch (err) { toast.error(err.message || 'Gagal mengubah password'); }
    finally { setSavingPw(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="animate-fade-in max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pengaturan</h1>
        <p className="text-white/40 text-sm mt-1">Konfigurasi website dan keamanan akun</p>
      </div>

      {/* Site settings */}
      <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-sm">Informasi Website</h2>
        <div>
          <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Nama Website</label>
          <input value={settings.site_name} onChange={e => set('site_name', e.target.value)}
            className="input text-sm" placeholder="Akira Reader"/>
        </div>
        <div>
          <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Deskripsi</label>
          <textarea value={settings.site_description} onChange={e => set('site_description', e.target.value)}
            rows={3} className="input text-sm resize-none" placeholder="Platform baca manhwa terbaik"/>
        </div>
        <div className="space-y-3">
          {[
            {key:'ads_enabled',      label:'Aktifkan Iklan',       desc:'Tampilkan iklan di website'},
            {key:'maintenance_mode', label:'Mode Maintenance',     desc:'Matikan akses pengunjung umum'},
          ].map(({key,label,desc}) => (
            <div key={key} className="flex items-center justify-between">
              <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-white/30">{desc}</p></div>
              <button type="button" onClick={() => set(key, settings[key]==='true'?'false':'true')}
                className={`relative w-10 h-5 rounded-full transition-colors ${settings[key]==='true'?'bg-accent':'bg-white/10'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings[key]==='true'?'translate-x-5':''}`}/>
              </button>
            </div>
          ))}
        </div>
        <button onClick={handleSaveSettings} disabled={saving}
          className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60">
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <FiSave/>}
          Simpan Pengaturan
        </button>
      </div>

      {/* Change Password */}
      <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <FiLock className="text-accent"/>
          <h2 className="font-semibold text-sm">Ganti Password Admin</h2>
        </div>

        <div className="relative">
          <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Password Lama</label>
          <input type={showPw ? 'text' : 'password'} value={pwForm.currentPassword}
            onChange={e => setPwForm(f => ({...f, currentPassword: e.target.value}))}
            placeholder="Password saat ini" className="input text-sm pr-11"/>
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="absolute right-4 top-[calc(50%+6px)] text-white/30 hover:text-white transition-colors">
            {showPw ? <FiEyeOff/> : <FiEye/>}
          </button>
        </div>

        <div>
          <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Password Baru</label>
          <input type={showPw ? 'text' : 'password'} value={pwForm.newPassword}
            onChange={e => setPwForm(f => ({...f, newPassword: e.target.value}))}
            placeholder="Minimal 6 karakter" className="input text-sm"/>
        </div>

        <div>
          <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Konfirmasi Password Baru</label>
          <input type={showPw ? 'text' : 'password'} value={pwForm.confirm}
            onChange={e => setPwForm(f => ({...f, confirm: e.target.value}))}
            placeholder="Ulangi password baru" className="input text-sm"/>
        </div>

        {(pwForm.newPassword || pwForm.confirm) && (
          <div className="space-y-1.5 p-3 bg-dark-600/50 rounded-xl">
            {[
              [pwChecks.length, 'Minimal 6 karakter'],
              [pwChecks.match,  'Password cocok'],
            ].map(([ok, label]) => (
              <div key={label} className={`flex items-center gap-2 text-xs ${ok ? 'text-green-400' : 'text-white/30'}`}>
                <FiCheck className={ok ? 'opacity-100' : 'opacity-30'}/> {label}
              </div>
            ))}
          </div>
        )}

        <button onClick={handleChangePassword} disabled={savingPw || !pwChecks.length || !pwChecks.match || !pwForm.currentPassword}
          className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
          {savingPw ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <FiLock/>}
          Ganti Password
        </button>
      </div>
    </div>
  );
}
