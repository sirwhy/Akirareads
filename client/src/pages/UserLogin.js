import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import AkiraLogo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

export default function UserLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { toast.error('Isi semua field'); return; }
    setLoading(true);
    try {
      const res = await api.login(form);
      login(res.token, res.user);
      toast.success(`Selamat datang, ${res.user.username}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Login gagal');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-dark-700/50 border border-white/5 rounded-2xl p-8">
          <div className="text-center mb-8">
            <AkiraLogo size={40} textSize="text-xl" className="justify-center mb-4" />
            <h1 className="text-2xl font-bold">Masuk</h1>
            <p className="text-white/40 text-sm mt-1">Login ke akun AKIRAREADS</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Email</label>
              <div className="relative">
                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@contoh.com" className="input pl-11" autoComplete="email" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Password</label>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••" className="input pl-11 pr-11" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                  {showPass ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60 mt-2">
              {loading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'Masuk'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-white/40">
            Belum punya akun?{' '}
            <Link to="/register" className="text-accent hover:text-accent-light font-medium transition-colors">Daftar sekarang</Link>
          </div>
          <div className="mt-3 text-center">
            <Link to="/admin/login" className="text-xs text-white/20 hover:text-white/40 transition-colors">
              Login sebagai Admin →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
