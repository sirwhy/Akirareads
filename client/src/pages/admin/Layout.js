import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { FiGrid, FiBook, FiList, FiMonitor, FiSettings, FiUsers, FiLogOut, FiMenu, FiX, FiEye, FiZap } from 'react-icons/fi';
import AkiraLogo from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to:'/admin',          label:'Dashboard',     icon:FiGrid,    end:true },
  { to:'/admin/series',   label:'Series',        icon:FiBook },
  { to:'/admin/chapters', label:'Chapters',      icon:FiList },
  { to:'/admin/mirror',   label:'Mirror / Import',icon:FiZap },
  { to:'/admin/ads',      label:'Iklan (Ads)',   icon:FiMonitor },
  { to:'/admin/users',    label:'Users',         icon:FiUsers },
  { to:'/admin/settings', label:'Pengaturan',    icon:FiSettings },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/admin/login'); };

  return (
    <div className="min-h-screen bg-dark-900 flex">
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-dark-800 border-r border-white/5 flex flex-col transition-transform duration-300 ${sidebarOpen?'translate-x-0':'-translate-x-full'} lg:translate-x-0`}>
        <div className="p-5 border-b border-white/5">
          <AkiraLogo size={32} textSize="text-lg"/>
          <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1 ml-10">Admin Panel</p>
        </div>
        <div className="p-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-accent/10 border border-accent/20 rounded-full flex items-center justify-center text-accent text-xs font-bold">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.username}</p>
              <p className="text-xs text-white/30 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon:Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-white/50 hover:text-white hover:bg-white/5'}`
              }>
              <Icon className="text-base flex-shrink-0"/> {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/5 space-y-0.5">
          <a href="/" target="_blank" rel="noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all">
            <FiEye className="text-base"/> Lihat Website
          </a>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <FiLogOut className="text-base"/> Keluar
          </button>
        </div>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}/>}
      <div className="flex-1 lg:ml-60 min-h-screen flex flex-col">
        <div className="lg:hidden sticky top-0 z-30 bg-dark-800/95 backdrop-blur border-b border-white/5 h-14 flex items-center px-4 gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-white/60 hover:text-white"><FiMenu className="text-xl"/></button>
          <AkiraLogo size={28} textSize="text-lg"/>
        </div>
        <main className="flex-1 p-6 max-w-6xl w-full mx-auto">
          <Outlet/>
        </main>
      </div>
    </div>
  );
}
