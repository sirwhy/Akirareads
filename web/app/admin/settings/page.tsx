'use client';

import { useCallback, useEffect, useState } from 'react';
import { FiSave, FiLock, FiEye, FiEyeOff, FiCheck, FiPlus, FiTrash2, FiSettings } from 'react-icons/fi';
import AdminShell from '../AdminShell';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';

// Field terkenal dari Settings.js lama + tambahan kontrak v3.
const KNOWN_TOGGLES: { key: string; label: string; desc: string }[] = [
  { key: 'ads_enabled', label: 'Aktifkan Iklan', desc: 'Tampilkan iklan di website' },
  { key: 'maintenance_mode', label: 'Mode Maintenance', desc: 'Matikan akses pengunjung umum' },
];

function SettingsInner() {
  const toast = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState('');

  // Password
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(typeof data === 'object' && data ? Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v ?? '')]),
      ) : {});
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal memuat pengaturan'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const pwChecks = {
    length: pwForm.newPassword.length >= 6,
    match: pwForm.newPassword.length > 0 && pwForm.newPassword === pwForm.confirm,
  };

  const set = (k: string, v: string) => setSettings(s => ({ ...s, [k]: v }));

  const saveAll = async () => {
    setSaving(true);
    const failed: string[] = [];
    for (const [k, v] of Object.entries(settings)) {
      try { await api.updateSetting(k, v); }
      catch (err) { failed.push(`${k}: ${err instanceof Error ? err.message : 'gagal'}`); }
    }
    setSaving(false);
    if (failed.length) toast.error(`${failed.length} key gagal: ${failed[0]}`);
    else toast.success('Pengaturan disimpan!');
  };

  const saveOne = async (k: string) => {
    try { await api.updateSetting(k, settings[k] ?? ''); toast.success(`"${k}" disimpan`); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal'); }
  };

  const removeKey = (k: string) => setSettings(s => { const n = { ...s }; delete n[k]; return n; });

  const addKey = () => {
    const k = newKey.trim();
    if (!k) return;
    if (settings[k] !== undefined) { toast.error('Key sudah ada'); return; }
    set(k, '');
    setNewKey('');
  };

  const changePassword = async () => {
    if (!pwForm.oldPassword) { toast.error('Masukkan password lama'); return; }
    if (!pwChecks.length) { toast.error('Password baru minimal 6 karakter'); return; }
    if (!pwChecks.match) { toast.error('Konfirmasi password tidak cocok'); return; }
    setSavingPw(true);
    try {
      await api.changePassword({ oldPassword: pwForm.oldPassword, newPassword: pwForm.newPassword });
      toast.success('Password berhasil diubah');
      setPwForm({ oldPassword: '', newPassword: '', confirm: '' });
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal mengubah password'); }
    finally { setSavingPw(false); }
  };

  const knownKeys = ['site_name', 'site_description', 'announcement'];
  const toggleKeys = KNOWN_TOGGLES.map(t => t.key);
  const extraKeys = Object.keys(settings).filter(k => !knownKeys.includes(k) && !toggleKeys.includes(k)).sort();

  return (
    <div className="animate-fade-in max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FiSettings className="text-accent" /> Pengaturan</h1>
        <p className="text-white/40 text-sm mt-1">Konfigurasi website dan keamanan akun</p>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 shimmer rounded-2xl" />)}</div>
      ) : (
        <>
          {/* Site settings */}
          <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-sm">Informasi Website</h2>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Nama Website</label>
              <input value={settings.site_name ?? ''} onChange={e => set('site_name', e.target.value)}
                className="input text-sm" placeholder="AKIRAREADS" />
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Deskripsi</label>
              <textarea value={settings.site_description ?? ''} onChange={e => set('site_description', e.target.value)}
                rows={3} className="input text-sm resize-none" placeholder="Platform baca manhwa terbaik" />
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Pengumuman (banner atas)</label>
              <input value={settings.announcement ?? ''} onChange={e => set('announcement', e.target.value)}
                className="input text-sm" placeholder="Kosongkan untuk menyembunyikan" />
            </div>
            <div className="space-y-3">
              {KNOWN_TOGGLES.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-white/30">{desc}</p></div>
                  <button type="button" onClick={() => set(key, settings[key] === 'true' ? 'false' : 'true')}
                    className={`relative w-10 h-5 rounded-full transition-colors ${settings[key] === 'true' ? 'bg-accent' : 'bg-white/10'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings[key] === 'true' ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              ))}
            </div>

            {/* Key/value editor untuk setting custom */}
            {extraKeys.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-white/40 uppercase tracking-widest">Setting Custom</p>
                {extraKeys.map(k => (
                  <div key={k} className="flex gap-2 items-center">
                    <span className="w-40 flex-shrink-0 text-xs font-mono text-white/50 truncate" title={k}>{k}</span>
                    <input value={settings[k]} onChange={e => set(k, e.target.value)} className="input text-sm flex-1" />
                    <button onClick={() => saveOne(k)} className="p-2 text-white/30 hover:text-accent" title="Simpan key ini"><FiSave className="text-sm" /></button>
                    <button onClick={() => removeKey(k)} className="p-2 text-white/30 hover:text-red-400" title="Hapus dari editor (server menyimpan nilai lama)"><FiTrash2 className="text-sm" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input value={newKey} onChange={e => setNewKey(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKey(); } }}
                placeholder="tambah key baru..." className="input text-sm flex-1" />
              <button onClick={addKey} className="btn-ghost text-sm px-4"><FiPlus /></button>
            </div>

            <button onClick={saveAll} disabled={saving}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiSave />}
              Simpan Semua
            </button>
          </div>

          {/* Change password */}
          <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <FiLock className="text-accent" />
              <h2 className="font-semibold text-sm">Ganti Password Admin</h2>
            </div>
            <div className="relative">
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Password Lama</label>
              <input type={showPw ? 'text' : 'password'} value={pwForm.oldPassword}
                onChange={e => setPwForm(f => ({ ...f, oldPassword: e.target.value }))}
                placeholder="Password saat ini" className="input text-sm pr-11" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-4 top-[calc(50%+6px)] text-white/30 hover:text-white transition-colors">
                {showPw ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Password Baru</label>
              <input type={showPw ? 'text' : 'password'} value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                placeholder="Minimal 6 karakter" className="input text-sm" />
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Konfirmasi Password Baru</label>
              <input type={showPw ? 'text' : 'password'} value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Ulangi password baru" className="input text-sm" />
            </div>
            {(pwForm.newPassword || pwForm.confirm) && (
              <div className="space-y-1.5 p-3 bg-dark-600/50 rounded-xl">
                {[[pwChecks.length, 'Minimal 6 karakter'], [pwChecks.match, 'Password cocok']].map(([ok, label]) => (
                  <div key={String(label)} className={`flex items-center gap-2 text-xs ${ok ? 'text-green-400' : 'text-white/30'}`}>
                    <FiCheck className={ok ? 'opacity-100' : 'opacity-30'} /> {String(label)}
                  </div>
                ))}
              </div>
            )}
            <button onClick={changePassword} disabled={savingPw || !pwChecks.length || !pwChecks.match || !pwForm.oldPassword}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
              {savingPw ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiLock />}
              Ganti Password
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <AdminShell>
      <SettingsInner />
    </AdminShell>
  );
}
