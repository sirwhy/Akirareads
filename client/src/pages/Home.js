import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiStar, FiEye, FiClock, FiTrendingUp } from 'react-icons/fi';

import SeriesCard from '../components/SeriesCard';
import api from '../api';

function SkeletonCard() {
  return (
    <div className="card">
      <div className="aspect-[3/4] shimmer" />
      <div className="p-3 space-y-2"><div className="h-3 shimmer rounded w-3/4" /><div className="h-2 shimmer rounded w-1/2" /></div>
    </div>
  );
}

function HeroBanner({ series }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!series.length) return;
    const t = setInterval(() => setActive(i => (i + 1) % series.length), 5000);
    return () => clearInterval(t);
  }, [series.length]);

  if (!series.length) return null;
  const s = series[active];

  return (
    <div className="relative h-[520px] md:h-[600px] overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        {s.cover ? (
          <img src={s.cover} alt={s.title} className="w-full h-full object-cover scale-110 blur-sm opacity-30 transition-all duration-1000" />
        ) : (
          <div className="w-full h-full hero-gradient" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-dark-900 via-dark-900/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-900 via-transparent to-dark-900/50" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full max-w-7xl mx-auto px-4 flex items-center">
        <div className="flex gap-8 items-center">
          {/* Cover */}
          <div className="hidden sm:block flex-shrink-0 w-44 h-64 rounded-xl overflow-hidden shadow-2xl border border-white/10 glow-red">
            {s.cover ? <img src={s.cover} alt={s.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-dark-600 flex items-center justify-center"><span className="text-3xl">📖</span></div>}
          </div>
          {/* Info */}
          <div className="flex-1 max-w-lg animate-fade-in" key={active}>
            <div className="flex items-center gap-2 mb-3">
              <span className="badge text-xs text-accent bg-accent/10">Featured</span>
              <span className="badge text-xs text-white/40 bg-white/5">{s.type}</span>
            </div>
            <h1 className="font-display text-5xl md:text-6xl tracking-wide leading-none mb-3 text-glow">{s.title}</h1>
            {s.author && <p className="text-white/40 text-sm mb-3">oleh <span className="text-white/60">{s.author}</span></p>}
            <p className="text-white/60 text-sm leading-relaxed line-clamp-3 mb-5">{s.description || 'Tidak ada deskripsi.'}</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {(s.genres || []).slice(0, 4).map(g => (
                <Link key={g} to={`/browse?genre=${g}`} className="badge text-xs text-white/50 bg-white/5 hover:bg-accent/10 hover:text-accent transition-colors">{g}</Link>
              ))}
            </div>
            <Link to={`/series/${s.slug}`} className="btn-primary inline-flex items-center gap-2">
              Baca Sekarang <FiArrowRight />
            </Link>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {series.map((_, i) => (
          <button key={i} onClick={() => setActive(i)} className={`h-1.5 rounded-full transition-all ${i === active ? 'w-6 bg-accent' : 'w-1.5 bg-white/20'}`} />
        ))}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, link, linkLabel = 'Lihat Semua' }) {
  return (
    <section className="mb-14">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 bg-accent rounded-full" />
          <h2 className="text-xl font-bold flex items-center gap-2">
            {Icon && <Icon className="text-accent" />} {title}
          </h2>
        </div>
        {link && <Link to={link} className="text-sm text-accent hover:text-accent-light flex items-center gap-1 transition-colors">{linkLabel} <FiArrowRight /></Link>}
      </div>
      {children}
    </section>
  );
}

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [latest, setLatest] = useState([]);
  const [popular, setPopular] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [featuredRes, latestRes, popularRes] = await Promise.all([
          api.getSeries({ featured: 'true', limit: 5 }),
          api.getSeries({ sort: 'updatedAt', order: 'desc', limit: 12 }),
          api.getSeries({ sort: 'views', order: 'desc', limit: 12 }),
        ]);
        setFeatured(featuredRes.series || []);
        setLatest(latestRes.series || []);
        setPopular(popularRes.series || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  return (
    <div className="animate-fade-in">
      <HeroBanner series={featured} />

      <div className="max-w-7xl mx-auto px-4 pt-12">
        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-14 p-4 bg-dark-700/50 border border-white/5 rounded-2xl">
          {[
            { icon: FiStar, label: 'Series Terbaik', val: '500+' },
            { icon: FiEye, label: 'Total Views', val: '1M+' },
            { icon: FiClock, label: 'Update Harian', val: '24/7' },
          ].map(({ icon: Icon, label, val }) => (
            <div key={label} className="flex flex-col items-center text-center gap-1">
              <Icon className="text-accent text-xl" />
              <span className="font-display text-2xl md:text-3xl text-white">{val}</span>
              <span className="text-xs text-white/30">{label}</span>
            </div>
          ))}
        </div>

        {/* Latest Updates */}
        <Section title="Update Terbaru" icon={FiClock} link="/latest">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : latest.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {latest.slice(0, 6).map(s => <SeriesCard key={s.id} series={s} />)}
            </div>
          ) : (
            <div className="text-center py-16 text-white/30">
              <span className="text-5xl opacity-20">📚</span>
              <p>Belum ada series. Tambahkan melalui admin panel.</p>
              <Link to="/admin/login" className="inline-block mt-3 text-accent text-sm hover:underline">Pergi ke Admin →</Link>
            </div>
          )}
        </Section>

        {/* Popular */}
        <Section title="Paling Populer" icon={FiTrendingUp} link="/browse?sort=views">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : popular.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {popular.slice(0, 6).map(s => <SeriesCard key={s.id} series={s} />)}
            </div>
          ) : null}
        </Section>
      </div>
    </div>
  );
}
