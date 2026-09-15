'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FiChevronLeft, FiChevronRight, FiX, FiList, FiHome, FiSettings, FiArrowUp, FiRefreshCw } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/client';
import type { ChapterFull, TranslateJob, ReaderPage } from '@/components/types';

const WIDTHS: [string, string][] = [['max-w-2xl', 'Kecil'], ['max-w-3xl', 'Sedang'], ['max-w-4xl', 'Besar'], ['max-w-full', 'Penuh']];

export default function Reader() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const [chapter, setChapter] = useState<ChapterFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readMode, setReadMode] = useState<'vertical' | 'single'>('vertical');
  const [currentPage, setCurrentPage] = useState(0);
  const [imgWidth, setImgWidth] = useState('max-w-3xl');
  const [zoom, setZoom] = useState(100); // percent
  const [aiTranslate, setAiTranslate] = useState(false);
  const [job, setJob] = useState<TranslateJob | null>(null);
  const [showTop, setShowTop] = useState(false);
  const pollRef = useRef<number | null>(null);

  // Load chapter
  const loadChapter = useCallback(async (id: string, scrollReset: boolean) => {
    setLoading(true);
    if (scrollReset) window.scrollTo(0, 0);
    try {
      const data: ChapterFull = await api.getChapter(id);
      setChapter(data);
      setJob(data.translateJob || null);
      setCurrentPage(0);
      if (isLoggedIn) api.saveReadHistory(id).catch(() => {});
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [isLoggedIn]);

  useEffect(() => {
    loadChapter(chapterId, true);
  }, [chapterId, loadChapter]);

  // Poll translate status while a job is RUNNING/PENDING (every 4s); refresh chapter when it finishes.
  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (!chapter || !job || (job.status !== 'RUNNING' && job.status !== 'PENDING')) return;
    pollRef.current = window.setInterval(async () => {
      try {
        const res = await api.translateStatus(chapter.id);
        const next: TranslateJob | null = res.job || null;
        setJob(next);
        if (!next || (next.status !== 'RUNNING' && next.status !== 'PENDING')) {
          // Job finished (or cleared) — reload pages so translatedUrl is fresh
          const fresh: ChapterFull = await api.getChapter(chapter.id);
          setChapter(fresh);
          setJob(fresh.translateJob || null);
        }
      } catch { /* transient poll error */ }
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [chapter, job]);

  // Back-to-top visibility
  useEffect(() => {
    const h = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  const goNext = useCallback(() => {
    if (readMode === 'single') {
      if (currentPage < (chapter?.pages?.length || 0) - 1) { setCurrentPage(p => p + 1); window.scrollTo(0, 0); }
      else if (chapter?.nextChapter) router.push(`/read/${chapter.nextChapter.id}`);
    } else if (chapter?.nextChapter) {
      router.push(`/read/${chapter.nextChapter.id}`);
    }
  }, [readMode, currentPage, chapter, router]);

  const goPrev = useCallback(() => {
    if (readMode === 'single') {
      if (currentPage > 0) { setCurrentPage(p => p - 1); window.scrollTo(0, 0); }
      else if (chapter?.prevChapter) router.push(`/read/${chapter.prevChapter.id}`);
    } else if (chapter?.prevChapter) {
      router.push(`/read/${chapter.prevChapter.id}`);
    }
  }, [readMode, currentPage, chapter, router]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev]);

  if (loading) return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mx-auto mb-4 opacity-30">📖</div>
        <p className="text-white/30 text-sm">Memuat chapter...</p>
      </div>
    </div>
  );

  if (!chapter) return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center text-center">
      <div>
        <p className="text-white/40 mb-4">Chapter tidak ditemukan</p>
        <Link href="/" className="btn-primary">Kembali ke Beranda</Link>
      </div>
    </div>
  );

  const pages: ReaderPage[] = chapter.pages || [];
  const activeSrc = (p: ReaderPage) => (aiTranslate && p.translatedUrl ? p.translatedUrl : p.imageUrl);
  const aiReady = pages.filter(p => !!p.translatedUrl).length;
  const jobRunning = job && (job.status === 'RUNNING' || job.status === 'PENDING');

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-dark-900/95 backdrop-blur-md border-b border-white/5 h-12 flex items-center px-4 gap-3">
        <Link href={chapter.series ? `/series/${chapter.series.slug}` : '/'} className="text-white/60 hover:text-white p-1 transition-colors">
          <FiChevronLeft className="text-xl" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{chapter.series?.title}</p>
          <p className="text-xs text-white/40">Chapter {chapter.chapterNum}{chapter.title ? ` - ${chapter.title}` : ''}</p>
        </div>
        <div className="flex items-center gap-1">
          {/* AI Translate toggle */}
          <button
            onClick={() => setAiTranslate(v => !v)}
            title="Terjemahan AI"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${aiTranslate ? 'border-accent text-accent bg-accent/10' : 'border-white/10 text-white/50 hover:border-white/30'}`}>
            🇮🇩 <span className="hidden sm:inline">AI Translate</span>
            {jobRunning && <FiRefreshCw className="animate-spin text-[10px]" />}
          </button>
          <button onClick={() => setSettingsOpen(!settingsOpen)} className={`p-2 transition-colors rounded-lg hover:bg-white/5 ${settingsOpen ? 'text-accent' : 'text-white/60 hover:text-white'}`}>
            <FiSettings className="text-sm" />
          </button>
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5">
            <FiList className="text-sm" />
          </button>
        </div>
      </div>

      {/* Translate progress bar (top) */}
      {jobRunning && (
        <div className="fixed top-12 left-0 right-0 z-50 bg-dark-800/95 backdrop-blur-md border-b border-white/5 px-4 py-2">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-accent font-medium">Menerjemahkan dengan AI...</span>
            <span className="text-white/40 font-mono">{job!.done}/{job!.total} halaman · {job!.progress}%</span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${job!.progress}%` }} />
          </div>
        </div>
      )}

      {/* Settings panel */}
      {settingsOpen && (
        <div className="fixed top-12 right-0 z-50 w-64 bg-dark-800 border border-white/10 border-t-0 p-4 shadow-2xl">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Mode Baca</p>
          <div className="flex gap-2 mb-4">
            {([['vertical', 'Vertikal'], ['single', 'Per Halaman']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setReadMode(val)} className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${readMode === val ? 'border-accent text-accent bg-accent/10' : 'border-white/10 text-white/50 hover:border-white/30'}`}>{label}</button>
            ))}
          </div>
          <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Lebar Gambar</p>
          <div className="flex gap-2 mb-4">
            {WIDTHS.map(([val, label]) => (
              <button key={val} onClick={() => setImgWidth(val)} className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${imgWidth === val ? 'border-accent text-accent bg-accent/10' : 'border-white/10 text-white/50 hover:border-white/30'}`}>{label}</button>
            ))}
          </div>
          <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Zoom</p>
          <div className="flex items-center gap-3">
            <input type="range" min={50} max={150} step={10} value={zoom}
              onChange={e => setZoom(parseInt(e.target.value, 10))}
              className="flex-1 accent-[#e11d48]" />
            <span className="text-xs text-white/60 font-mono w-10 text-right">{zoom}%</span>
          </div>
          <p className="text-[10px] text-white/30 mt-3 leading-relaxed">
            AI Translate {aiReady > 0 ? `tersedia untuk ${aiReady}/${pages.length} halaman.` : 'belum tersedia untuk chapter ini.'}
          </p>
        </div>
      )}

      {/* Chapter list sidebar */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1" onClick={() => setMenuOpen(false)} />
          <div className="w-72 bg-dark-800 border-l border-white/10 flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Daftar Chapter</h3>
              <button onClick={() => setMenuOpen(false)} className="text-white/40 hover:text-white"><FiX /></button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-white/5">
              <Link href={chapter.series ? `/series/${chapter.series.slug}` : '/'} className="flex items-center gap-2 p-4 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                <FiHome /> Kembali ke halaman series
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className={jobRunning ? 'pt-24' : 'pt-12'}>
        {readMode === 'vertical' ? (
          <div className={`mx-auto ${imgWidth}`}>
            {pages.length === 0 ? (
              <div className="py-32 text-center text-white/30"><p>Halaman belum tersedia.</p></div>
            ) : (
              <>
                {aiTranslate && aiReady === 0 && !jobRunning && (
                  <p className="text-center text-xs text-white/30 py-4">Terjemahan AI belum tersedia — menampilkan halaman asli.</p>
                )}
                {pages.map((page, i) => (
                  <div key={page.id} className="relative">
                    <img src={activeSrc(page)} alt={`Page ${i + 1}`} referrerPolicy="no-referrer"
                      className="block select-none mx-auto"
                      style={{ width: `${zoom}%` }}
                      loading={i < 3 ? 'eager' : 'lazy'} />
                    {aiTranslate && page.translatedUrl && (
                      <span className="absolute top-2 right-2 badge text-[10px] bg-accent/90 text-white">AI</span>
                    )}
                    {aiTranslate && !page.translatedUrl && (
                      <span className="absolute bottom-2 left-2 text-[10px] text-white/50 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">versi asli</span>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center min-h-screen justify-center px-4">
            {pages.length === 0 ? (
              <div className="text-white/30">Halaman belum tersedia.</div>
            ) : (
              <div className={`w-full ${imgWidth} relative mx-auto`}>
                <img src={activeSrc(pages[currentPage] ?? pages[0])} alt={`Page ${currentPage + 1}`} referrerPolicy="no-referrer"
                  className="select-none mx-auto" style={{ width: `${zoom}%` }} />
                {aiTranslate && pages[currentPage]?.translatedUrl && (
                  <span className="absolute top-2 right-2 badge text-[10px] bg-accent/90 text-white">AI</span>
                )}
                {aiTranslate && !pages[currentPage]?.translatedUrl && (
                  <span className="absolute bottom-2 left-2 text-[10px] text-white/50 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">versi asli</span>
                )}
                {/* Click zones */}
                <button onClick={goPrev} className="absolute left-0 top-0 w-1/3 h-full opacity-0 cursor-pointer" aria-label="Previous" />
                <button onClick={goNext} className="absolute right-0 top-0 w-1/3 h-full opacity-0 cursor-pointer" aria-label="Next" />
              </div>
            )}
            {/* Page counter */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-dark-800/90 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 text-sm text-white/60">
              {currentPage + 1} / {pages.length}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="sticky bottom-0 bg-dark-900/95 backdrop-blur-md border-t border-white/5 p-4">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
            {chapter.prevChapter ? (
              <Link href={`/read/${chapter.prevChapter.id}`} className="flex items-center gap-2 text-sm text-white/60 hover:text-accent transition-colors">
                <FiChevronLeft /> Ch {chapter.prevChapter.chapterNum}
              </Link>
            ) : <div />}

            <Link href={chapter.series ? `/series/${chapter.series.slug}` : '/'} className="text-xs text-white/30 hover:text-white transition-colors text-center">
              Daftar Chapter
            </Link>

            {chapter.nextChapter ? (
              <Link href={`/read/${chapter.nextChapter.id}`} className="flex items-center gap-2 text-sm text-white/60 hover:text-accent transition-colors">
                Ch {chapter.nextChapter.chapterNum} <FiChevronRight />
              </Link>
            ) : <div />}
          </div>
        </div>
      </div>

      {/* Back to top */}
      {showTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-20 right-4 z-40 w-10 h-10 bg-dark-800/90 backdrop-blur-sm border border-white/10 rounded-full flex items-center justify-center text-white/60 hover:text-accent hover:border-accent transition-colors">
          <FiArrowUp />
        </button>
      )}
    </div>
  );
}
