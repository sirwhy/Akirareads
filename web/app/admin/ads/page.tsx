'use client';

import { useCallback, useEffect, useState } from 'react';
import { FiMonitor, FiRefreshCw } from 'react-icons/fi';
import AdminShell from '../AdminShell';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { asArray, fmtDate, type AdRow } from '../types';

const POSITION_LABEL: Record<string, string> = {
  HEADER: 'Header', SIDEBAR: 'Sidebar', BETWEEN_CHAPTERS: 'Antara Chapter', FOOTER: 'Footer', POPUP: 'Popup',
};

/**
 * Ads READ-ONLY: CRUD iklan sengaja tidak dibangun ulang di v3
 * (hanya GET /api/ads publik — list menampilkan slot aktif).
 */
function AdsInner() {
  const toast = useToast();
  const [ads, setAds] = useState<AdRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setAds(asArray<AdRow>(await api.getAds())); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Gagal memuat iklan'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FiMonitor className="text-accent" /> Iklan (Ads)</h1>
          <p className="text-white/40 text-sm mt-1">Hanya-tampil — pengelolaan iklan dilakukan langsung di database</p>
        </div>
        <button onClick={load} className="btn-ghost text-sm flex items-center gap-2"><FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      <div className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl mb-5 text-xs text-yellow-400">
        ℹ️ CRUD iklan tidak tersedia di versi 3. Data di bawah adalah slot iklan <strong>aktif</strong> dari <code>GET /api/ads</code>.
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 shimmer rounded-2xl" />)}
        </div>
      ) : ads.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <FiMonitor className="text-4xl mx-auto mb-3 opacity-20" />
          <p>Belum ada iklan aktif.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ads.map(ad => (
            <div key={ad.id} className="bg-dark-700/30 border border-white/5 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-sm truncate">{ad.name}</p>
                <span className={`badge text-xs ${ad.active ? 'text-green-400 bg-green-400/10' : 'text-white/30 bg-white/5'}`}>
                  {ad.active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/40 mb-2">
                <span className="badge text-white/40 bg-white/5">{POSITION_LABEL[ad.position] || ad.position}</span>
                <span>sejak {fmtDate(ad.createdAt)}</span>
              </div>
              {ad.imageUrl && (
                <div className="w-full h-24 rounded-lg overflow-hidden bg-dark-600 mb-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ad.imageUrl} alt={ad.name} className="w-full h-full object-contain" />
                </div>
              )}
              {ad.linkUrl && <p className="text-xs text-accent truncate mb-1" title={ad.linkUrl}>→ {ad.linkUrl}</p>}
              <details className="mt-1">
                <summary className="text-xs text-white/30 cursor-pointer hover:text-white/60">Lihat kode ({(ad.code || '').length} char)</summary>
                <pre className="text-[10px] font-mono text-white/40 bg-dark-900 rounded-lg p-2 mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all">{ad.code}</pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminAdsPage() {
  return (
    <AdminShell>
      <AdsInner />
    </AdminShell>
  );
}
