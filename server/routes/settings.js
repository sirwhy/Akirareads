const router = require('express').Router();
const prisma = require('../lib/prisma');
const { adminMiddleware } = require('../lib/auth');

// Get all settings (public - for site config)
router.get('/', async (req, res) => {
  try {
    const settings = await prisma.setting.findMany();
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil settings' });
  }
});

// Update settings (admin)
router.put('/', adminMiddleware, async (req, res) => {
  try {
    const updates = req.body; // { key: value, ... }
    const promises = Object.entries(updates).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );
    await Promise.all(promises);
    res.json({ message: 'Settings berhasil disimpan' });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menyimpan settings' });
  }
});

module.exports = router;
