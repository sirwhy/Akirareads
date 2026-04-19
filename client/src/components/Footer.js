import React from 'react';
import { Link } from 'react-router-dom';
import { FiHeart } from 'react-icons/fi';
import AkiraLogo from './Logo';

export default function Footer() {
  return (
    <footer className="bg-dark-800 border-t border-white/5 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <AkiraLogo size={36} textSize="text-xl" className="mb-4"/>
            <p className="text-white/40 text-sm leading-relaxed max-w-xs">
              Platform baca manhwa, manga, dan manhua terbaik. Nikmati ribuan judul pilihan secara gratis.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Navigasi</h4>
            <ul className="space-y-2">
              {[['/', 'Beranda'], ['/browse', 'Jelajahi'], ['/latest', 'Terbaru']].map(([to, label]) => (
                <li key={to}><Link to={to} className="text-sm text-white/40 hover:text-accent transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">Akun</h4>
            <ul className="space-y-2">
              {[['/login', 'Masuk'], ['/register', 'Daftar'], ['/profile', 'Profil']].map(([to, label]) => (
                <li key={to}><Link to={to} className="text-sm text-white/40 hover:text-accent transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/20">© {new Date().getFullYear()} AKIRAREADS. All rights reserved.</p>
          <p className="text-xs text-white/20 flex items-center gap-1">Made with <FiHeart className="text-accent"/> for manga lovers</p>
        </div>
      </div>
    </footer>
  );
}
