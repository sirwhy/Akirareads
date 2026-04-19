import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiStar, FiEye, FiList, FiBookmark, FiMessageSquare, FiChevronDown, FiChevronUp, FiSend } from 'react-icons/fi';

import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

const STATUS_COLOR = { ONGOING: 'text-green-400 bg-green-400/10', COMPLETED: 'text-blue-400 bg-blue-400/10', HIATUS: 'text-yellow-400 bg-yellow-400/10', DROPPED: 'text-red-400 bg-red-400/10' };
const STATUS_LABEL = { ONGOING: 'Ongoing', COMPLETED: 'Tamat', HIATUS: 'Hiatus', DROPPED: 'Drop' };

function timeAgo(date) {
  const diff = Math.floor((new Date() - new Date(date)) / 1000);
  if (diff < 3600) return `${Math.floor(diff/60)}m lalu`;
  if (diff < 86400) return `${Math.floor(diff/3600)}j lalu`;
  return `${Math.floor(diff/86400)}h lalu`;
}

export default function Series() {
  const { slug } = useParams();
  const { user, isLoggedIn } = useAuth();
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.getSeriesBySlug(slug);
        setSeries(data);
        const comData = await api.getSeriesComments(data.id);
        setComments(comData || []);
        if (isLoggedIn) {
          const bookmarks = await api.getMyBookmarks();
          setBookmarked(bookmarks.some(b => b.seriesId === data.id));
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, [slug, isLoggedIn]);

  const handleBookmark = async () => {
    if (!isLoggedIn) { toast.error('Login dulu untuk bookmark'); return; }
    try {
      const res = await api.toggleBookmark(series.id);
      setBookmarked(res.bookmarked);
      toast.success(res.message);
    } catch { toast.error('Gagal toggle bookmark'); }
  };

  const handleComment = async () => {
    if (!isLoggedIn) { toast.error('Login dulu untuk komentar'); return; }
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const newComment = await api.postComment(series.id, commentText.trim());
      setComments(prev => [newComment, ...prev]);
      setCommentText('');
      toast.success('Komentar dikirim');
    } catch { toast.error('Gagal mengirim komentar'); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 pt-24 animate-fade-in">
      <div className="flex gap-8 mb-8">
        <div className="w-48 h-72 shimmer rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-4 pt-4"><div className="h-8 shimmer rounded w-3/4" /><div className="h-4 shimmer rounded w-1/2" /><div className="h-20 shimmer rounded" /></div>
      </div>
    </div>
  );

  if (!series) return <div className="pt-24 text-center text-white/40">Series tidak ditemukan.</div>;

  const chapters = series.chapters || [];
  const displayChapters = showAllChapters ? chapters : chapters.slice(0, 20);

  return (
    <div className="max-w-5xl mx-auto px-4 pt-24 pb-12 animate-fade-in">
      {/* Hero section */}
      <div className="relative rounded-2xl overflow-hidden mb-8 border border-white/5">
        {/* Bg blur */}
        <div className="absolute inset-0">
          {series.cover && <img src={series.cover} alt="" className="w-full h-full object-cover scale-110 blur-2xl opacity-20" />}
          <div className="absolute inset-0 bg-gradient-to-r from-dark-800 via-dark-800/90 to-dark-800/70" />
        </div>
        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row gap-6">
          {/* Cover */}
          <div className="flex-shrink-0 w-40 md:w-48 self-start">
            <div className="rounded-xl overflow-hidden border border-white/10 shadow-2xl aspect-[3/4]">
              {series.cover ? <img src={series.cover} alt={series.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-dark-600 flex items-center justify-center"><span className="text-4xl opacity-30">📖</span></div>}
            </div>
          </div>
          {/* Info */}
          <div className="flex-1">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className={`badge text-xs ${STATUS_COLOR[series.status]}`}>{STATUS_LABEL[series.status]}</span>
              <span className="badge text-xs text-white/40 bg-white/5">{series.type}</span>
              {series.featured && <span className="badge text-xs text-yellow-400 bg-yellow-400/10">⭐ Featured</span>}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-2">{series.title}</h1>
            {(series.author || series.artist) && (
              <p className="text-white/40 text-sm mb-4">
                {series.author && <>Penulis: <span className="text-white/60">{series.author}</span></>}
                {series.author && series.artist && <span className="mx-2">·</span>}
                {series.artist && <>Ilustrator: <span className="text-white/60">{series.artist}</span></>}
              </p>
            )}
            <div className="flex items-center gap-4 text-sm text-white/40 mb-4">
              <span className="flex items-center gap-1"><FiEye /> {series.views?.toLocaleString() || 0} views</span>
              <span className="flex items-center gap-1"><FiList /> {series._count?.chapters || 0} chapter</span>
              {series.rating > 0 && <span className="flex items-center gap-1 text-yellow-400"><FiStar /> {series.rating.toFixed(1)}</span>}
            </div>
            {series.genres?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {series.genres.map(g => <Link key={g} to={`/browse?genre=${g}`} className="badge text-xs text-white/40 bg-white/5 hover:bg-accent/10 hover:text-accent transition-colors">{g}</Link>)}
              </div>
            )}
            <p className="text-white/60 text-sm leading-relaxed mb-6 max-w-2xl">{series.description || 'Tidak ada deskripsi.'}</p>
            <div className="flex flex-wrap gap-3">
              {chapters.length > 0 && (
                <Link to={`/read/${chapters[chapters.length-1]?.id}`} className="btn-primary flex items-center gap-2">Baca Chapter 1</Link>
              )}
              {chapters.length > 0 && (
                <Link to={`/read/${chapters[0]?.id}`} className="btn-ghost flex items-center gap-2">Chapter Terbaru</Link>
              )}
              <button onClick={handleBookmark} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${bookmarked ? 'border-accent text-accent bg-accent/10' : 'border-white/10 text-white/60 hover:border-white/30'}`}>
                <FiBookmark className={bookmarked ? 'fill-accent' : ''} /> {bookmarked ? 'Dibookmark' : 'Bookmark'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chapters */}
      <div className="bg-dark-700/30 border border-white/5 rounded-2xl overflow-hidden mb-8">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <h2 className="font-bold flex items-center gap-2"><FiList className="text-accent" /> Daftar Chapter ({chapters.length})</h2>
        </div>
        {chapters.length === 0 ? (
          <div className="py-12 text-center text-white/30 text-sm">Belum ada chapter.</div>
        ) : (
          <>
            <div className="divide-y divide-white/5">
              {displayChapters.map(ch => (
                <Link key={ch.id} to={`/read/${ch.id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/5 transition-colors group">
                  <span className="text-sm font-medium group-hover:text-accent transition-colors">
                    Chapter {ch.chapterNum}{ch.title ? ` - ${ch.title}` : ''}
                  </span>
                  <span className="text-xs text-white/30">{new Date(ch.createdAt).toLocaleDateString('id-ID')}</span>
                </Link>
              ))}
            </div>
            {chapters.length > 20 && (
              <button onClick={() => setShowAllChapters(!showAllChapters)} className="w-full py-3.5 text-sm text-accent hover:bg-accent/5 transition-colors flex items-center justify-center gap-2 border-t border-white/5">
                {showAllChapters ? <><FiChevronUp /> Tampilkan lebih sedikit</> : <><FiChevronDown /> Tampilkan semua {chapters.length} chapter</>}
              </button>
            )}
          </>
        )}
      </div>

      {/* Comments */}
      <div className="bg-dark-700/30 border border-white/5 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h2 className="font-bold flex items-center gap-2"><FiMessageSquare className="text-accent" /> Komentar ({comments.length})</h2>
        </div>
        {/* Comment form */}
        <div className="p-5 border-b border-white/5">
          {isLoggedIn ? (
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-accent/20 border border-accent/30 rounded-full flex items-center justify-center text-accent text-xs font-bold flex-shrink-0 mt-1">
                {user?.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                  placeholder="Tulis komentar..." rows={3}
                  className="input text-sm resize-none mb-2" />
                <button onClick={handleComment} disabled={submitting || !commentText.trim()}
                  className="btn-primary text-sm py-2 px-4 flex items-center gap-2 disabled:opacity-50">
                  <FiSend className="text-xs" /> Kirim
                </button>
              </div>
            </div>
          ) : (
            <p className="text-white/40 text-sm text-center">
              <Link to="/login" className="text-accent hover:underline">Login</Link> untuk menulis komentar.
            </p>
          )}
        </div>
        {/* Comments list */}
        <div className="divide-y divide-white/5">
          {comments.length === 0 ? (
            <div className="py-10 text-center text-white/30 text-sm">Belum ada komentar. Jadilah yang pertama!</div>
          ) : comments.map(c => (
            <div key={c.id} className="p-5 flex gap-3">
              <div className="w-8 h-8 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white/60 text-xs font-bold flex-shrink-0">
                {c.user?.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold">{c.user?.username}</span>
                  <span className="text-xs text-white/30">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-sm text-white/70 leading-relaxed">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
