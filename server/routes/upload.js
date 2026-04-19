/**
 * Upload Route - Handle image upload from gallery/file
 * Returns base64 or saves to local /uploads folder
 */
const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { adminMiddleware } = require('../lib/auth');

// Ensure uploads dir exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.random().toString(36).slice(2) + ext;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg','image/jpg','image/png','image/webp','image/gif'];
  cb(null, allowed.includes(file.mimetype));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// POST /api/upload/image - single image upload
// Returns { url } pointing to served static file
router.post('/image', adminMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File tidak valid atau tidak ada' });
  
  const baseUrl = process.env.SERVER_URL || 
                  (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : '') ||
                  `http://localhost:${process.env.PORT || 5000}`;
  
  const url = `${baseUrl}/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename, size: req.file.size });
});

// POST /api/upload/images - multiple images (for chapter pages)
router.post('/images', adminMiddleware, upload.array('images', 200), (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: 'Tidak ada file yang diupload' });

  const baseUrl = process.env.SERVER_URL ||
                  (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : '') ||
                  `http://localhost:${process.env.PORT || 5000}`;

  const urls = req.files.map(f => `${baseUrl}/uploads/${f.filename}`);
  res.json({ urls, count: urls.length });
});

// POST /api/upload/base64 - base64 image (from mobile/canvas)
router.post('/base64', adminMiddleware, (req, res) => {
  try {
    const { data, filename = 'image.jpg' } = req.body;
    if (!data) return res.status(400).json({ error: 'Data base64 tidak ada' });

    const base64 = data.replace(/^data:image\/\w+;base64,/, '');
    const buf    = Buffer.from(base64, 'base64');
    const ext    = data.match(/^data:image\/(\w+);/)?.[1] || 'jpg';
    const fname  = Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
    const fpath  = path.join(uploadDir, fname);

    fs.writeFileSync(fpath, buf);

    const baseUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
    res.json({ url: `${baseUrl}/uploads/${fname}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
