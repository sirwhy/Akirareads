require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const crypto  = require('crypto');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Admin-Key'],
  optionsSuccessStatus: 200,
}));
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Admin Panel Security ─────────────────────────────────────────────────────
// Admin API routes need either: valid JWT admin token OR X-Admin-Key header
// This hides admin routes from public scanners
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

function adminApiGuard(req, res, next) {
  // Check X-Admin-Key header (for direct API access)
  const apiKey = req.headers['x-admin-key'];
  if (ADMIN_API_KEY && apiKey === ADMIN_API_KEY) return next();
  
  // Check Bearer token (JWT) — actual auth is done per-route
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return next();
  
  // No credentials at all — return generic 404 (not 401/403)
  return res.status(404).json({ error: 'Not found' });
}

// ─── Public Routes ────────────────────────────────────────────────────────────
app.use('/api/auth',     require('../routes/auth'));
app.use('/api/series',   require('../routes/series'));
app.use('/api/chapters', require('../routes/chapters'));
app.use('/api/settings', require('../routes/settings'));
app.use('/api/ads',      require('../routes/ads'));

// ─── Protected Admin Routes (hidden from public) ──────────────────────────────
app.use('/api/admin',    adminApiGuard, require('../routes/admin'));
app.use('/api/mirror',   adminApiGuard, require('../routes/mirror'));
app.use('/api/upload',   adminApiGuard, require('../routes/upload'));
app.use('/api/users',    adminApiGuard, require('../routes/users'));

// ─── Health & Misc ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.json({ status: 'OK', app: 'AKIRAREADS API', ts: new Date().toISOString() })
);

// Return 404 for unknown API routes (no info leakage)
app.use('/api/*', (req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AKIRAREADS API on :${PORT}`);
  if (ADMIN_API_KEY) console.log('🔒 Admin API key protection: ON');
});
