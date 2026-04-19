const router = require('express').Router();
const prisma = require('../lib/prisma');
const { adminMiddleware, authMiddleware } = require('../lib/auth');

// Get all series with filters & pagination
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, genre, status, type, q, sort = 'updatedAt', order = 'desc', featured } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (genre) where.genres = { has: genre };
    if (status) where.status = status;
    if (type) where.type = type;
    if (featured === 'true') where.featured = true;
    if (q) where.title = { contains: q, mode: 'insensitive' };

    const orderBy = {};
    orderBy[sort] = order;

    const [series, total] = await Promise.all([
      prisma.series.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy,
        include: { _count: { select: { chapters: true } } },
      }),
      prisma.series.count({ where }),
    ]);

    res.json({ series, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    console.error('Get series error:', error);
    res.status(500).json({ error: 'Gagal mengambil data series' });
  }
});

// Get series by slug
router.get('/slug/:slug', async (req, res) => {
  try {
    const series = await prisma.series.findUnique({
      where: { slug: req.params.slug },
      include: {
        chapters: { orderBy: { chapterNum: 'desc' }, take: 50 },
        _count: { select: { chapters: true, comments: true } },
      },
    });
    if (!series) return res.status(404).json({ error: 'Series tidak ditemukan' });

    // Increment views
    await prisma.series.update({ where: { id: series.id }, data: { views: { increment: 1 } } });

    res.json(series);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil series' });
  }
});

// Get series by ID
router.get('/:id', async (req, res) => {
  try {
    const series = await prisma.series.findUnique({
      where: { id: req.params.id },
      include: {
        chapters: { orderBy: { chapterNum: 'desc' } },
        _count: { select: { chapters: true, comments: true } },
      },
    });
    if (!series) return res.status(404).json({ error: 'Series tidak ditemukan' });
    res.json(series);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil series' });
  }
});

// Create series (admin)
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { title, slug, description, author, artist, status, genres, cover, type, featured } = req.body;

    if (!title || !slug) {
      return res.status(400).json({ error: 'Title dan slug wajib diisi' });
    }

    const existing = await prisma.series.findUnique({ where: { slug } });
    if (existing) return res.status(400).json({ error: 'Slug sudah digunakan' });

    const series = await prisma.series.create({
      data: {
        title,
        slug,
        description,
        author,
        artist,
        status: status || 'ONGOING',
        genres: genres || [],
        cover,
        type: type || 'MANHWA',
        featured: featured || false,
      },
    });

    res.status(201).json({ message: 'Series berhasil dibuat', series });
  } catch (error) {
    console.error('Create series error:', error);
    res.status(500).json({ error: 'Gagal membuat series', detail: error.message });
  }
});

// Update series (admin)
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const { title, slug, description, author, artist, status, genres, cover, type, featured, rating } = req.body;

    const series = await prisma.series.update({
      where: { id: req.params.id },
      data: { title, slug, description, author, artist, status, genres, cover, type, featured, rating },
    });

    res.json({ message: 'Series berhasil diupdate', series });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengupdate series' });
  }
});

// Delete series (admin)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    await prisma.series.delete({ where: { id: req.params.id } });
    res.json({ message: 'Series berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus series' });
  }
});

// Get comments for series
router.get('/:id/comments', async (req, res) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { seriesId: req.params.id },
      include: { user: { select: { username: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil komentar' });
  }
});

// Post comment
router.post('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Komentar tidak boleh kosong' });
    const comment = await prisma.comment.create({
      data: { content, userId: req.user.id, seriesId: req.params.id },
      include: { user: { select: { username: true, avatar: true } } },
    });
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengirim komentar' });
  }
});

module.exports = router;
