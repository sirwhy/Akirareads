const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { generateToken, adminMiddleware } = require('../lib/auth');

// ── User Register — langsung aktif tanpa verifikasi email ─────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password)
      return res.status(400).json({ error: 'Email, username, dan password wajib diisi' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password minimal 6 karakter' });

    if (await prisma.user.findUnique({ where: { email } }))
      return res.status(400).json({ error: 'Email sudah terdaftar' });
    if (await prisma.user.findUnique({ where: { username } }))
      return res.status(400).json({ error: 'Username sudah digunakan' });

    const user = await prisma.user.create({
      data: {
        email, username,
        password: await bcrypt.hash(password, 12),
        role: 'USER',
        emailVerified: true, // langsung verified
      },
      select: { id: true, email: true, username: true, role: true },
    });

    res.status(201).json({
      message: 'Registrasi berhasil!',
      token: generateToken(user),
      user,
    });
  } catch (e) {
    console.error('Register error:', e);
    res.status(500).json({ error: 'Gagal registrasi', detail: e.message });
  }
});

// ── User Login ────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email dan password wajib diisi' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Email atau password salah' });

    res.json({
      message: 'Login berhasil',
      token: generateToken(user),
      user: { id: user.id, email: user.email, username: user.username, role: user.role, avatar: user.avatar },
    });
  } catch (e) {
    res.status(500).json({ error: 'Gagal login', detail: e.message });
  }
});

// ── Admin Register ────────────────────────────────────────────────────────────
router.post('/admin/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password)
      return res.status(400).json({ error: 'Semua field wajib diisi' });

    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount > 0) {
      const jwt = require('jsonwebtoken');
      const ah = req.headers.authorization;
      if (!ah) return res.status(403).json({ error: 'Admin sudah ada. Login dulu sebagai admin.' });
      try {
        const d = jwt.verify(ah.split(' ')[1], process.env.JWT_SECRET || 'akira-secret');
        if (d.role !== 'ADMIN') return res.status(403).json({ error: 'Hanya admin yang bisa buat admin baru' });
      } catch { return res.status(401).json({ error: 'Token tidak valid' }); }
    }

    if (await prisma.user.findUnique({ where: { email } }))
      return res.status(400).json({ error: 'Email sudah terdaftar' });

    const admin = await prisma.user.create({
      data: {
        email,
        username: username || 'admin',
        password: await bcrypt.hash(password, 12),
        role: 'ADMIN',
        emailVerified: true,
      },
      select: { id: true, email: true, username: true, role: true },
    });

    res.status(201).json({
      message: 'Admin berhasil dibuat',
      token: generateToken(admin),
      user: admin,
    });
  } catch (e) {
    res.status(500).json({ error: 'Gagal buat admin', detail: e.message });
  }
});

// ── Admin Login ───────────────────────────────────────────────────────────────
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email dan password wajib diisi' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'ADMIN' || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Email/password salah atau bukan akun admin' });

    res.json({
      message: 'Login admin berhasil',
      token: generateToken(user),
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    });
  } catch (e) {
    res.status(500).json({ error: 'Gagal login', detail: e.message });
  }
});

// ── Admin Change Password ─────────────────────────────────────────────────────
router.put('/admin/change-password', adminMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Password lama dan baru wajib diisi' });
    if (newPassword.length < 6)
      return res.status(400).json({ error: 'Password baru minimal 6 karakter' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!(await bcrypt.compare(currentPassword, user.password)))
      return res.status(400).json({ error: 'Password lama salah' });

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: await bcrypt.hash(newPassword, 12) },
    });
    res.json({ message: 'Password berhasil diubah' });
  } catch (e) {
    res.status(500).json({ error: 'Gagal ubah password', detail: e.message });
  }
});

// ── Emergency Reset ───────────────────────────────────────────────────────────
router.post('/reset-admin', async (req, res) => {
  try {
    const resetKey = process.env.RESET_ADMIN_KEY;
    if (!resetKey) return res.status(403).json({ error: 'Set RESET_ADMIN_KEY env dulu' });
    const { key, password } = req.body;
    if (key !== resetKey) return res.status(403).json({ error: 'Kunci salah' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password min 6 karakter' });
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@akirareads.com';
    const user = await prisma.user.update({
      where: { email: adminEmail },
      data: { password: await bcrypt.hash(password, 12) },
    });
    res.json({ message: `Password reset untuk ${user.email}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
