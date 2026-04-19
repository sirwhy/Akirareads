const router = require('express').Router();
const prisma = require('../lib/prisma');
const { adminMiddleware, authMiddleware } = require('../lib/auth');

// Get chapters by series
router.get('/series/:seriesId', async (req, res) => {
  try {
    const chapters = await prisma.chapter.findMany({
      where: { seriesId: req.params.seriesId },
      orderBy: { chapterNum: 'desc' },
      include: { _count: { select: { pages: true } } },
    });
    res.json(chapters);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil chapters' });
  }
});

// Get chapter with pages
router.get('/:id', async (req, res) => {
  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id: req.params.id },
      include: {
        pages: { orderBy: { number: 'asc' } },
        series: { select: { id: true, title: true, slug: true } },
      },
    });
    if (!chapter) return res.status(404).json({ error: 'Chapter tidak ditemukan' });

    // Increment views
    await prisma.chapter.update({ where: { id: chapter.id }, data: { views: { increment: 1 } } });

    // Get prev/next chapter
    const [prevChapter, nextChapter] = await Promise.all([
      prisma.chapter.findFirst({ where: { seriesId: chapter.seriesId, chapterNum: { lt: chapter.chapterNum } }, orderBy: { chapterNum: 'desc' }, select: { id: true, chapterNum: true } }),
      prisma.chapter.findFirst({ where: { seriesId: chapter.seriesId, chapterNum: { gt: chapter.chapterNum } }, orderBy: { chapterNum: 'asc' }, select: { id: true, chapterNum: true } }),
    ]);

    res.json({ ...chapter, prevChapter, nextChapter });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil chapter' });
  }
});

// Create chapter (admin)
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { seriesId, title, chapterNum, pages } = req.body;

    if (!seriesId || !chapterNum) {
      return res.status(400).json({ error: 'SeriesId dan chapterNum wajib diisi' });
    }

    const chapter = await prisma.chapter.create({
      data: {
        seriesId,
        title,
        chapterNum: parseFloat(chapterNum),
        pages: pages ? {
          create: pages.map((url, i) => ({ number: i + 1, imageUrl: url })),
        } : undefined,
      },
      include: { pages: true },
    });

    // Update series updatedAt
    await prisma.series.update({ where: { id: seriesId }, data: { updatedAt: new Date() } });

    res.status(201).json({ message: 'Chapter berhasil dibuat', chapter });
  } catch (error) {
    console.error('Create chapter error:', error);
    res.status(500).json({ error: 'Gagal membuat chapter', detail: error.message });
  }
});

// Update chapter (admin)
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const { title, chapterNum } = req.body;
    const chapter = await prisma.chapter.update({
      where: { id: req.params.id },
      data: { title, chapterNum: chapterNum ? parseFloat(chapterNum) : undefined },
    });
    res.json({ message: 'Chapter berhasil diupdate', chapter });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengupdate chapter' });
  }
});

// Delete chapter (admin)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    await prisma.chapter.delete({ where: { id: req.params.id } });
    res.json({ message: 'Chapter berhasil dihapus' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus chapter' });
  }
});

// Add pages to chapter (admin)
router.post('/:id/pages', adminMiddleware, async (req, res) => {
  try {
    const { pages } = req.body; // array of image URLs
    if (!pages || !pages.length) return res.status(400).json({ error: 'Pages tidak boleh kosong' });

    const existing = await prisma.page.count({ where: { chapterId: req.params.id } });
    const created = await prisma.page.createMany({
      data: pages.map((url, i) => ({ chapterId: req.params.id, number: existing + i + 1, imageUrl: url })),
    });

    res.status(201).json({ message: `${created.count} halaman berhasil ditambahkan` });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menambahkan halaman' });
  }
});

// Save read history
router.post('/:id/read', authMiddleware, async (req, res) => {
  try {
    await prisma.readHistory.upsert({
      where: { userId_chapterId: { userId: req.user.id, chapterId: req.params.id } },
      update: { createdAt: new Date() },
      create: { userId: req.user.id, chapterId: req.params.id },
    });
    res.json({ message: 'Riwayat baca tersimpan' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menyimpan riwayat' });
  }
});

module.exports = router;
