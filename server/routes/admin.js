const router = require('express').Router();
const prisma = require('../lib/prisma');
const { adminMiddleware } = require('../lib/auth');

// Dashboard stats
router.get('/stats', adminMiddleware, async (req, res) => {
  try {
    const [totalSeries, totalChapters, totalUsers, totalViews, recentSeries, recentUsers] = await Promise.all([
      prisma.series.count(),
      prisma.chapter.count(),
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.series.aggregate({ _sum: { views: true } }),
      prisma.series.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, cover: true, views: true, createdAt: true } }),
      prisma.user.findMany({ take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, username: true, email: true, createdAt: true } }),
    ]);

    res.json({
      totalSeries,
      totalChapters,
      totalUsers,
      totalViews: totalViews._sum.views || 0,
      recentSeries,
      recentUsers,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Gagal mengambil statistik' });
  }
});

// Get all series for admin (with more detail)
router.get('/series', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, q } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = q ? { title: { contains: q, mode: 'insensitive' } } : {};
    const [series, total] = await Promise.all([
      prisma.series.findMany({ where, skip, take: parseInt(limit), orderBy: { updatedAt: 'desc' }, include: { _count: { select: { chapters: true } } } }),
      prisma.series.count({ where }),
    ]);
    res.json({ series, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data series' });
  }
});

// Get all chapters for admin
router.get('/chapters', adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 30, seriesId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = seriesId ? { seriesId } : {};
    const [chapters, total] = await Promise.all([
      prisma.chapter.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' }, include: { series: { select: { title: true } }, _count: { select: { pages: true } } } }),
      prisma.chapter.count({ where }),
    ]);
    res.json({ chapters, total });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data chapters' });
  }
});

// Delete comment (admin)
router.delete('/comments/:id', adminMiddleware, async (req, res) => {
  try {
    await prisma.comment.delete({ where: { id: req.params.id } });
    res.json({ message: 'Komentar berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus komentar' });
  }
});

module.exports = router;
