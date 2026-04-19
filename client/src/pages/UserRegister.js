import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiUser, FiEye, FiEyeOff, FiCheck } from 'react-icons/fi';
import AkiraLogo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

export default function UserRegister() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', username: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const checks = {
    length: form.password.length >= 6,
    match: form.password === form.confirm && form.confirm !== '',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.username || !form.password) { toast.error('Isi semua field'); return; }
    if (!checks.length) { toast.error('Password minimal 6 karakter'); return; }
    if (!checks.match) { toast.error('Password tidak cocok'); return; }
    setLoading(true);
    try {
      const res = await api.register({ email: form.email, username: form.username, password: form.password });
      login(res.token, res.user);
      toast.success('Registrasi berhasil! Selamat datang!');
      navigate('/');
    } catch (err) {
      toast.error(err.message || 'Registrasi gagal');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md animate-slide-up">
        <div className="bg-dark-700/50 border border-white/5 rounded-2xl p-8">
          <div className="text-center mb-8">
            <AkiraLogo size={40} textSize="text-xl" className="justify-center mb-4" />
            <h1 className="text-2xl font-bold">Daftar Akun</h1>
            <p className="text-white/40 text-sm mt-1">Buat akun baru AKIRAREADS</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Username</label>
              <div className="relative">
                <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input type="text" value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="username_kamu" className="input pl-11" autoComplete="username" />
              </div>
            </div>
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
                  placeholder="Min. 6 karakter" className="input pl-11 pr-11" autoComplete="new-password" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                  {showPass ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-widest mb-2">Konfirmasi Password</label>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input type={showPass ? 'text' : 'password'} value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Ulangi password" className="input pl-11" autoComplete="new-password" />
              </div>
            </div>

            {(form.password || form.confirm) && (
              <div className="space-y-1.5 p-3 bg-dark-600/50 rounded-xl">
                {[[checks.length, 'Minimal 6 karakter'], [checks.match, 'Password cocok']].map(([ok, label]) => (
                  <div key={label} className={`flex items-center gap-2 text-xs ${ok ? 'text-green-400' : 'text-white/30'}`}>
                    <FiCheck className={ok ? 'opacity-100' : 'opacity-30'} /> {label}
                  </div>
                ))}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-60">
              {loading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : 'Daftar Sekarang'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-white/40">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-accent hover:text-accent-light font-medium transition-colors">Masuk</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
