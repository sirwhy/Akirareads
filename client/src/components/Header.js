import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiSearch, FiMenu, FiX, FiUser, FiBookmark, FiLogOut, FiSettings, FiChevronDown } from 'react-icons/fi';
import AkiraLogo from './Logo';
import api from '../api';

export default function Header() {
  const { user, isAdmin, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled,     setScrolled]     = useState(false);
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchResults,setSearchResults]= useState([]);
  const searchRef  = useRef(null);
  const dropdownRef= useRef(null);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  useEffect(() => { setMobileOpen(false); setDropdownOpen(false); }, [location]);

  useEffect(() => {
    const h = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
      if (searchRef.current   && !searchRef.current.contains(e.target))   setSearchOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try { const d = await api.getSeries({ q: searchQuery, limit: 5 }); setSearchResults(d.series || []); }
      catch { setSearchResults([]); }
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleLogout = () => { logout(); navigate('/'); };

  const navLinks = [
    { to:'/', label:'Beranda' },
    { to:'/browse', label:'Jelajahi' },
    { to:'/latest', label:'Terbaru' },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-dark-900/95 backdrop-blur-md border-b border-white/5 shadow-xl shadow-black/50' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex-shrink-0">
          <AkiraLogo size={36} textSize="text-xl" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(l => (
            <Link key={l.to} to={l.to}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${location.pathname===l.to ? 'text-accent bg-accent/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}>
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div ref={searchRef} className="relative">
            <button onClick={() => setSearchOpen(!searchOpen)} className="w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors">
              <FiSearch />
            </button>
            {searchOpen && (
              <div className="absolute right-0 top-12 w-72 bg-dark-700 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-slide-up">
                <div className="p-3 border-b border-white/5">
                  <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Cari manhwa, manga..." className="input text-sm py-2"
                    onKeyDown={e => { if(e.key==='Enter'&&searchQuery){ navigate(`/browse?q=${searchQuery}`); setSearchOpen(false); setSearchQuery(''); }}}/>
                </div>
                {searchResults.length > 0 && (
                  <div className="max-h-64 overflow-y-auto">
                    {searchResults.map(s => (
                      <Link key={s.id} to={`/series/${s.slug}`} onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                        className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors">
                        {s.cover
                          ? <img src={s.cover} alt={s.title} className="w-10 h-14 object-cover rounded"/>
                          : <div className="w-10 h-14 bg-dark-600 rounded flex items-center justify-center text-white/10 text-xs">N/A</div>}
                        <div><p className="text-sm font-medium line-clamp-1">{s.title}</p><p className="text-xs text-white/40">{s.type}</p></div>
                      </Link>
                    ))}
                  </div>
                )}
                {searchQuery && searchResults.length === 0 && <p className="p-4 text-sm text-white/40 text-center">Tidak ditemukan</p>}
              </div>
            )}
          </div>

          {/* User menu */}
          {user ? (
            <div ref={dropdownRef} className="relative">
              <button onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-lg hover:bg-white/5 transition-colors">
                <div className="w-7 h-7 bg-accent/20 border border-accent/30 rounded-full flex items-center justify-center text-accent text-xs font-bold">
                  {user.username?.[0]?.toUpperCase()}
                </div>
                <span className="text-sm text-white/80 hidden sm:block max-w-[80px] truncate">{user.username}</span>
                <FiChevronDown className={`text-white/40 text-xs transition-transform ${dropdownOpen?'rotate-180':''}`}/>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-48 bg-dark-700 border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-slide-up">
                  <div className="p-3 border-b border-white/5">
                    <p className="text-xs text-white/40">Login sebagai</p>
                    <p className="text-sm font-semibold truncate">{user.username}</p>
                  </div>
                  <div className="p-1">
                    <Link to="/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                      <FiUser className="text-xs"/> Profil Saya
                    </Link>
                    <Link to="/profile?tab=bookmarks" className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                      <FiBookmark className="text-xs"/> Bookmark
                    </Link>
                    {isAdmin && (
                      <Link to="/admin" className="flex items-center gap-2 px-3 py-2 text-sm text-accent hover:bg-accent/10 rounded-lg transition-colors">
                        <FiSettings className="text-xs"/> Admin Panel
                      </Link>
                    )}
                    <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                      <FiLogOut className="text-xs"/> Keluar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login"    className="text-sm text-white/70 hover:text-white px-3 py-2 transition-colors">Masuk</Link>
              <Link to="/register" className="btn-primary text-sm py-2 px-4">Daftar</Link>
            </div>
          )}

          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/5">
            {mobileOpen ? <FiX/> : <FiMenu/>}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-dark-800 border-b border-white/5 px-4 pb-4 animate-slide-up">
          {navLinks.map(l => (
            <Link key={l.to} to={l.to} className={`block py-3 text-sm font-medium border-b border-white/5 ${location.pathname===l.to?'text-accent':'text-white/60'}`}>{l.label}</Link>
          ))}
        </div>
      )}
    </header>
  );
}
