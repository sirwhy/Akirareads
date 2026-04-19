import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight, FiMenu, FiX, FiList, FiHome, FiSettings } from 'react-icons/fi';

import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function Reader() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readMode, setReadMode] = useState('vertical'); // vertical | single
  const [currentPage, setCurrentPage] = useState(0);
  const [imgWidth, setImgWidth] = useState('max-w-3xl');

  useEffect(() => {
    async function load() {
      setLoading(true);
      window.scrollTo(0, 0);
      try {
        const data = await api.getChapter(id);
        setChapter(data);
        setCurrentPage(0);
        if (isLoggedIn) api.saveReadHistory(id).catch(() => {});
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [id, isLoggedIn]);

  const goNext = useCallback(() => {
    if (readMode === 'single') {
      if (currentPage < (chapter?.pages?.length || 0) - 1) { setCurrentPage(p => p + 1); window.scrollTo(0, 0); }
      else if (chapter?.nextChapter) navigate(`/read/${chapter.nextChapter.id}`);
    } else {
      if (chapter?.nextChapter) navigate(`/read/${chapter.nextChapter.id}`);
    }
  }, [readMode, currentPage, chapter, navigate]);

  const goPrev = useCallback(() => {
    if (readMode === 'single') {
      if (currentPage > 0) { setCurrentPage(p => p - 1); window.scrollTo(0, 0); }
      else if (chapter?.prevChapter) navigate(`/read/${chapter.prevChapter.id}`);
    } else {
      if (chapter?.prevChapter) navigate(`/read/${chapter.prevChapter.id}`);
    }
  }, [readMode, currentPage, chapter, navigate]);

  useEffect(() => {
    const handleKey = (e) => {
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
        <Link to="/" className="btn-primary">Kembali ke Beranda</Link>
      </div>
    </div>
  );

  const pages = chapter.pages || [];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-dark-900/95 backdrop-blur-md border-b border-white/5 h-12 flex items-center px-4 gap-3">
        <Link to={chapter.series ? `/series/${chapter.series.slug}` : '/'} className="text-white/60 hover:text-white p-1 transition-colors">
          <FiChevronLeft className="text-xl" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{chapter.series?.title}</p>
          <p className="text-xs text-white/40">Chapter {chapter.chapterNum}{chapter.title ? ` - ${chapter.title}` : ''}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setSettingsOpen(!settingsOpen)} className="p-2 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5">
            <FiSettings className="text-sm" />
          </button>
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/5">
            <FiList className="text-sm" />
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {settingsOpen && (
        <div className="fixed top-12 right-0 z-50 w-64 bg-dark-800 border border-white/10 border-t-0 p-4 shadow-2xl">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Mode Baca</p>
          <div className="flex gap-2 mb-4">
            {[['vertical','Vertikal'],['single','Per Halaman']].map(([val,label]) => (
              <button key={val} onClick={() => setReadMode(val)} className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${readMode===val?'border-accent text-accent bg-accent/10':'border-white/10 text-white/50 hover:border-white/30'}`}>{label}</button>
            ))}
          </div>
          <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Lebar Gambar</p>
          <div className="flex gap-2">
            {[['max-w-xl','Kecil'],['max-w-3xl','Sedang'],['max-w-5xl','Besar'],['max-w-full','Penuh']].map(([val,label]) => (
              <button key={val} onClick={() => setImgWidth(val)} className={`flex-1 text-xs py-2 rounded-lg border transition-colors ${imgWidth===val?'border-accent text-accent bg-accent/10':'border-white/10 text-white/50 hover:border-white/30'}`}>{label}</button>
            ))}
          </div>
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
              {/* We'd need series chapters here - linking back */}
              <Link to={chapter.series ? `/series/${chapter.series.slug}` : '/'} className="flex items-center gap-2 p-4 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                <FiHome /> Kembali ke halaman series
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="pt-12">
        {readMode === 'vertical' ? (
          <div className={`mx-auto ${imgWidth}`}>
            {pages.length === 0 ? (
              <div className="py-32 text-center text-white/30"><p>Halaman belum tersedia.</p></div>
            ) : pages.map((page, i) => (
              <img key={page.id} src={page.imageUrl} alt={`Page ${i+1}`}
                className="w-full block select-none"
                loading={i < 3 ? 'eager' : 'lazy'} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center min-h-screen justify-center px-4">
            {pages.length === 0 ? (
              <div className="text-white/30">Halaman belum tersedia.</div>
            ) : (
              <div className={`w-full ${imgWidth} relative`}>
                <img src={pages[currentPage]?.imageUrl} alt={`Page ${currentPage+1}`} className="w-full select-none" />
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
              <Link to={`/read/${chapter.prevChapter.id}`} className="flex items-center gap-2 text-sm text-white/60 hover:text-accent transition-colors">
                <FiChevronLeft /> Ch {chapter.prevChapter.chapterNum}
              </Link>
            ) : <div />}

            <Link to={chapter.series ? `/series/${chapter.series.slug}` : '/'} className="text-xs text-white/30 hover:text-white transition-colors text-center">
              Daftar Chapter
            </Link>

            {chapter.nextChapter ? (
              <Link to={`/read/${chapter.nextChapter.id}`} className="flex items-center gap-2 text-sm text-white/60 hover:text-accent transition-colors">
                Ch {chapter.nextChapter.chapterNum} <FiChevronRight />
              </Link>
            ) : <div />}
          </div>
        </div>
      </div>
    </div>
  );
}
