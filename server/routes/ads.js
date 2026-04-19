const router = require('express').Router();
const prisma = require('../lib/prisma');
const { adminMiddleware } = require('../lib/auth');

// Get active ads (public)
router.get('/', async (req, res) => {
  try {
    const { position } = req.query;
    const where = { active: true };
    if (position) where.position = position;
    const ads = await prisma.ad.findMany({ where });
    res.json(ads);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil iklan' });
  }
});

// Get all ads (admin)
router.get('/all', adminMiddleware, async (req, res) => {
  try {
    const ads = await prisma.ad.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(ads);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil iklan' });
  }
});

// Create ad (admin)
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { name, position, code, imageUrl, linkUrl, active } = req.body;
    if (!name || !position) return res.status(400).json({ error: 'Nama dan posisi wajib diisi' });
    const ad = await prisma.ad.create({ data: { name, position, code: code || '', imageUrl, linkUrl, active: active !== undefined ? active : true } });
    res.status(201).json({ message: 'Iklan berhasil dibuat', ad });
  } catch (error) {
    res.status(500).json({ error: 'Gagal membuat iklan', detail: error.message });
  }
});

// Update ad (admin)
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const { name, position, code, imageUrl, linkUrl, active } = req.body;
    const ad = await prisma.ad.update({ where: { id: req.params.id }, data: { name, position, code, imageUrl, linkUrl, active } });
    res.json({ message: 'Iklan berhasil diupdate', ad });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengupdate iklan' });
  }
});

// Delete ad (admin)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    await prisma.ad.delete({ where: { id: req.params.id } });
    res.json({ message: 'Iklan berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus iklan' });
  }
});

module.exports = router;
