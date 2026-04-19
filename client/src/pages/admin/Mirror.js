import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  FiLink, FiTrash2, FiRefreshCw, FiCheck, FiX, FiClock,
  FiZap, FiList, FiAlertCircle, FiTerminal, FiCopy, FiInfo
} from 'react-icons/fi';
import api from '../../api';
import toast from 'react-hot-toast';

const STATUS_CFG = {
  PENDING: { label:'Antri',   color:'text-yellow-400 bg-yellow-400/10', icon:FiClock },
  RUNNING: { label:'Proses',  color:'text-blue-400 bg-blue-400/10',    icon:FiRefreshCw },
  DONE:    { label:'Selesai', color:'text-green-400 bg-green-400/10',  icon:FiCheck },
  FAILED:  { label:'Gagal',   color:'text-red-400 bg-red-400/10',      icon:FiX },
};
function timeAgo(d) {
  const s=Math.floor((Date.now()-new Date(d))/1000);
  if(s<60)return `${s}d lalu`;if(s<3600)return `${Math.floor(s/60)}m lalu`;return `${Math.floor(s/3600)}j lalu`;
}

export default function AdminMirror() {
  const [jobs,       setJobs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [urlInput,   setUrlInput]   = useState('');
  const [bulkUrls,   setBulkUrls]   = useState('');
  const [mode,       setMode]       = useState('single'); // single|bulk|browser
  const [submitting, setSubmitting] = useState(false);
  const [browserSite,setBrowserSite]= useState('ikiru');
  const [bookmarklet,setBookmarklet]= useState('');
  const [loadingScript,setLoadingScript]=useState(false);
  const pollRef = useRef(null);

  const loadJobs = async () => {
    try { setJobs(await api.getMirrorJobs()); } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    loadJobs();
    pollRef.current = setInterval(() => {
      setJobs(prev => {
        if (prev.some(j=>j.status==='RUNNING'||j.status==='PENDING')) loadJobs();
        return prev;
      });
    }, 3000);
    return () => clearInterval(pollRef.current);
  }, []); // eslint-disable-line

  const handleSingle = async () => {
    if (!urlInput.trim().startsWith('http')) { toast.error('URL harus dimulai dari http/https'); return; }
    setSubmitting(true);
    try {
      const res = await api.startMirror(urlInput.trim());
      toast.success(`✅ Job dimulai (${res.site})!`);
      setUrlInput(''); setTimeout(loadJobs, 500);
    } catch(err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const handleBulk = async () => {
    const urls = bulkUrls.split('\n').map(u=>u.trim()).filter(u=>u.startsWith('http'));
    if (!urls.length) { toast.error('Tidak ada URL valid'); return; }
    setSubmitting(true);
    try {
      const res = await api.startBulkMirror(urls);
      toast.success(`✅ ${res.jobs.length} job dibuat!`);
      setBulkUrls(''); setTimeout(loadJobs, 500);
    } catch(err) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const loadBookmarklet = async () => {
    setLoadingScript(true);
    try {
      const res = await api.getMirrorBookmarklet(browserSite);
      setBookmarklet(res.script);
    } catch(err) { toast.error('Gagal load script: ' + err.message); }
    finally { setLoadingScript(false); }
  };

  const copyScript = () => {
    navigator.clipboard.writeText(bookmarklet);
    toast.success('Script disalin!');
  };

  const handleDelete = async (id) => {
    try { await api.deleteMirrorJob(id); toast.success('Job dihapus'); loadJobs(); }
    catch(err) { toast.error(err.message); }
  };

  const runningCount = jobs.filter(j=>j.status==='RUNNING'||j.status==='PENDING').length;

  const MODES = [
    { id:'single',  label:'🔗 MangaDex / URL' },
    { id:'bulk',    label:'📋 Bulk (banyak)' },
    { id:'browser', label:'🌐 Browser Import (ikiru / shinigami)' },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FiZap className="text-accent"/> Mirror / Import
          </h1>
          <p className="text-white/40 text-sm mt-1">Import manhwa/manga dari URL sumber</p>
        </div>
        {runningCount > 0 && (
          <span className="badge text-xs text-blue-400 bg-blue-400/10 flex items-center gap-1">
            <FiRefreshCw className="animate-spin text-[10px]"/> {runningCount} berjalan
          </span>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 mb-5 bg-dark-700/30 border border-white/5 rounded-xl p-1">
        {MODES.map(m=>(
          <button key={m.id} onClick={()=>setMode(m.id)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all text-center ${mode===m.id?'bg-dark-600 text-white shadow':'text-white/40 hover:text-white'}`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Single URL */}
      {mode==='single' && (
        <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5 mb-6">
          <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-xl mb-4 text-xs text-green-400">
            <strong>✅ MangaDex</strong> — semua chapter diimport otomatis (fix: limit sekarang 500/request, semua bahasa)<br/>
            <strong className="text-yellow-400">🟡 Madara sites</strong> — ikiru.id/komiku.id: berhasil jika Cloudflare tidak aktif
          </div>
          <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">URL Series</label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <FiLink className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"/>
              <input value={urlInput} onChange={e=>setUrlInput(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter')handleSingle();}}
                placeholder="https://mangadex.org/title/UUID/... atau https://ikiru.id/manga/judul/"
                className="input pl-11 text-sm"/>
            </div>
            <button onClick={handleSingle} disabled={submitting||!urlInput}
              className="btn-primary flex items-center gap-2 text-sm whitespace-nowrap disabled:opacity-60">
              {submitting?<FiRefreshCw className="animate-spin"/>:<FiZap/>} Import
            </button>
          </div>
        </div>
      )}

      {/* Bulk */}
      {mode==='bulk' && (
        <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5 mb-6">
          <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">URL (1 per baris, maks 20)</label>
          <textarea value={bulkUrls} onChange={e=>setBulkUrls(e.target.value)} rows={6}
            placeholder={'https://mangadex.org/title/UUID-1/\nhttps://mangadex.org/title/UUID-2/\nhttps://ikiru.id/manga/judul-1/'}
            className="input text-sm font-mono resize-none mb-3"/>
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/30">
              {bulkUrls.split('\n').filter(u=>u.trim().startsWith('http')).length} URL valid
            </p>
            <button onClick={handleBulk} disabled={submitting}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60">
              {submitting?<FiRefreshCw className="animate-spin"/>:<FiZap/>} Import Semua
            </button>
          </div>
        </div>
      )}

      {/* Browser Import */}
      {mode==='browser' && (
        <div className="space-y-4 mb-6">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4">
            <div className="flex items-start gap-2">
              <FiInfo className="text-blue-400 flex-shrink-0 mt-0.5"/>
              <div className="text-sm text-white/60">
                <p className="font-semibold text-blue-400 mb-1">Kenapa perlu Browser Import?</p>
                <p>ikiru.id dan shinigami.asia menggunakan <strong>Cloudflare anti-bot</strong> yang memblokir akses server langsung. Satu-satunya cara adalah: <strong>kamu buka di browser sendiri</strong> (CF sudah lolos), lalu script otomatis ambil data dan kirim ke server AKIRAREADS.</p>
              </div>
            </div>
          </div>

          <div className="bg-dark-700/30 border border-white/5 rounded-2xl p-5">
            <h3 className="font-semibold mb-4 text-sm">Pilih Website</h3>
            <div className="flex gap-2 mb-4">
              {[['ikiru','ikiru.id / 03.ikiru.wtf'],['shinigami','shinigami.asia']].map(([id,label])=>(
                <button key={id} onClick={()=>{ setBrowserSite(id); setBookmarklet(''); }}
                  className={`px-4 py-2 rounded-lg text-sm border transition-colors ${browserSite===id?'border-accent text-accent bg-accent/10':'border-white/10 text-white/50 hover:border-white/30'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-3 mb-4">
              <p className="text-xs text-white/40 font-semibold uppercase tracking-widest">Cara Pakai:</p>
              {[
                `Buka halaman series di ${browserSite==='shinigami'?'shinigami.asia':'ikiru.id'} di browser kamu (Chrome/Firefox)`,
                'Klik tombol "Generate Script" di bawah',
                'Copy script yang muncul',
                'Di halaman tersebut, tekan F12 → tab Console',
                'Paste script → tekan Enter',
                'Tunggu notifikasi "✅ Berhasil dikirim ke AKIRAREADS!"',
                'Kembali ke sini dan lihat hasilnya di bawah',
              ].map((step,i)=>(
                <div key={i} className="flex items-start gap-3 text-xs text-white/50">
                  <span className="w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center flex-shrink-0 font-bold">{i+1}</span>
                  {step}
                </div>
              ))}
            </div>

            <button onClick={loadBookmarklet} disabled={loadingScript}
              className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60 mb-4">
              {loadingScript?<FiRefreshCw className="animate-spin"/>:<FiTerminal/>}
              Generate Script untuk {browserSite==='shinigami'?'Shinigami':'ikiru.id'}
            </button>

            {bookmarklet && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-white/40">Script (copy ke Console browser):</p>
                  <button onClick={copyScript} className="flex items-center gap-1 text-xs text-accent hover:text-accent-light transition-colors">
                    <FiCopy className="text-[10px]"/> Copy
                  </button>
                </div>
                <textarea readOnly value={bookmarklet} rows={8}
                  className="input text-xs font-mono resize-none bg-dark-900 text-green-400 cursor-text"
                  onClick={e=>e.target.select()}/>
                <p className="text-xs text-yellow-400/70 mt-2">
                  ⚠️ Script ini berisi token login admin kamu. Jangan share ke orang lain.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <FiList/> Riwayat Import ({jobs.length})
          </h2>
          <button onClick={loadJobs} className="text-xs text-white/30 hover:text-accent transition-colors flex items-center gap-1">
            <FiRefreshCw className="text-[10px]"/> Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-24 shimmer rounded-2xl"/>)}</div>
        ) : jobs.length===0 ? (
          <div className="text-center py-12 text-white/30">
            <FiZap className="text-4xl mx-auto mb-3 opacity-20"/>
            <p>Belum ada import.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(job=>{
              const cfg=STATUS_CFG[job.status]||STATUS_CFG.PENDING;
              const Icon=cfg.icon;
              let result=null; try{result=JSON.parse(job.result);}catch{}
              return (
                <div key={job.id} className="bg-dark-700/30 border border-white/5 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                      <Icon className={`text-sm ${job.status==='RUNNING'?'animate-spin':''}`}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`badge text-xs ${cfg.color}`}>{cfg.label}</span>
                        <span className="badge text-xs text-white/30 bg-white/5">{job.sourceSite||'generic'}</span>
                        <span className="text-xs text-white/20">{timeAgo(job.createdAt)}</span>
                      </div>
                      <p className="text-xs text-white/30 font-mono truncate mb-1">{job.sourceUrl}</p>
                      {job.message&&(
                        <p className={`text-xs ${job.status==='FAILED'?'text-red-400/80':'text-white/50'}`}>{job.message}</p>
                      )}
                      {job.status==='RUNNING'&&job.total>0&&(
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-white/30 mb-1">
                            <span>Progress</span><span>{job.progress}/{job.total} chapter</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-accent rounded-full transition-all"
                              style={{width:`${Math.round((job.progress/job.total)*100)}%`}}/>
                          </div>
                        </div>
                      )}
                      {result&&job.status==='DONE'&&(
                        <Link to={`/series/${result.slug}`} target="_blank"
                          className="inline-flex items-center gap-1 mt-2 text-xs text-accent hover:underline">
                          📖 {result.title} →
                        </Link>
                      )}
                    </div>
                    <button onClick={()=>handleDelete(job.id)}
                      className="text-white/20 hover:text-red-400 transition-colors p-1 flex-shrink-0">
                      <FiTrash2 className="text-sm"/>
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
