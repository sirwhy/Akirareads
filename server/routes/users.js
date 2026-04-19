const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { authMiddleware, adminMiddleware } = require('../lib/auth');

// Get current user profile
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, username: true, role: true, avatar: true, createdAt: true,
        _count: { select: { bookmarks: true, comments: true, readHistory: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data user' });
  }
});

// Update profile
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { username, avatar } = req.body;
    const data = {};
    if (username) {
      const existing = await prisma.user.findFirst({ where: { username, NOT: { id: req.user.id } } });
      if (existing) return res.status(400).json({ error: 'Username sudah digunakan' });
      data.username = username;
    }
    if (avatar !== undefined) data.avatar = avatar;
    const user = await prisma.user.update({ where: { id: req.user.id }, data, select: { id: true, email: true, username: true, avatar: true } });
    res.json({ message: 'Profil berhasil diupdate', user });
  } catch (error) {
    res.status(500).json({ error: 'Gagal update profil' });
  }
});

// Change password
router.put('/me/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ error: 'Password lama salah' });
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hashed } });
    res.json({ message: 'Password berhasil diubah' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengubah password' });
  }
});

// Get bookmarks
router.get('/me/bookmarks', authMiddleware, async (req, res) => {
  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: req.user.id },
      include: { series: { select: { id: true, title: true, slug: true, cover: true, status: true } } },
      orderBy: { id: 'desc' },
    });
    res.json(bookmarks);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil bookmark' });
  }
});

// Toggle bookmark
router.post('/me/bookmarks/:seriesId', authMiddleware, async (req, res) => {
  try {
    const { seriesId } = req.params;
    const existing = await prisma.bookmark.findUnique({ where: { userId_seriesId: { userId: req.user.id, seriesId } } });
    if (existing) {
      await prisma.bookmark.delete({ where: { userId_seriesId: { userId: req.user.id, seriesId } } });
      res.json({ bookmarked: false, message: 'Bookmark dihapus' });
    } else {
      await prisma.bookmark.create({ data: { userId: req.user.id, seriesId } });
      res.json({ bookmarked: true, message: 'Bookmark ditambahkan' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Gagal toggle bookmark' });
  }
});

// Get all users (admin only)
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      prisma.user.findMany({ skip, take: parseInt(limit), select: { id: true, email: true, username: true, role: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
      prisma.user.count(),
    ]);
    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data users' });
  }
});

module.exports = router;
