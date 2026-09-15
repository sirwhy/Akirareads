// AKIRAREADS v3 worker — Express + auto-loop + backup cron.
// Rute gambar: /t/<pageId>.webp (hasil translate, data: URL dari DB) dan
// /p/<pageId>.webp (thumbnail 150px) — regex route supaya '.webp' opsional
// dan pageId apa pun (cuid) aman. Admin: x-admin-key == ADMIN_API_KEY,
// tanpa kredensial -> 404 (admin tersembunyi).
const path = require('path');
const express = require('express');
const sharp = require('sharp');

const env = require('./lib/env');
const prisma = require('./db');
const loop = require('./loop');
const mirror = require('./lib/mirror');
const translate = require('./lib/translate');
const backup = require('./lib/backup');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

function send(res, status, body) {
  res.status(status).json(body);
}

// ─── /health ──────────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    const [mirrorPending, translatePending] = await Promise.all([
      prisma.mirrorJob.count({ where: { status: 'PENDING' } }),
      prisma.translateJob.count({ where: { status: 'PENDING' } }),
    ]);
    res.json({ status: 'OK', jobs: { mirrorPending, translatePending } });
  } catch (e) {
    res.status(500).json({ status: 'ERR', error: e.message });
  }
});

// ─── Admin guard (404 bila tanpa key yang benar) ─────────────────────────────
function adminGuard(req, res, next) {
  const key = env('ADMIN_API_KEY');
  if (!key || req.headers['x-admin-key'] !== key) return send(res, 404, { error: 'Not found' });
  next();
}
app.use('/admin', adminGuard);

function fireAndForget(promise, res, label) {
  promise.catch((e) => console.warn(`[admin] ${label} gagal:`, e.message));
  send(res, 200, { ok: true, message: label + ' dijalankan' });
}
app.post('/admin/run-mirror/:jobId', (req, res) => fireAndForget(mirror.runMirrorJob(req.params.jobId), res, 'mirror job'));
app.post('/admin/run-translate/:jobId', (req, res) => fireAndForget(translate.runTranslateJob(req.params.jobId), res, 'translate job'));
// Bentuk alternatif: /admin/run/:jobId  body/type = 'mirror' | 'translate'
app.post('/admin/run/:jobId', (req, res) => {
  const type = String(req.query.type || (req.body && req.body.type) || 'mirror');
  const id = req.params.jobId;
  if (type === 'translate') return fireAndForget(translate.runTranslateJob(id), res, 'translate job');
  if (type === 'mirror') return fireAndForget(mirror.runMirrorJob(id), res, 'mirror job');
  return send(res, 400, { error: 'type harus mirror|translate' });
});
app.post('/admin/backup', (req, res) => {
  backup.runBackup(true).then((out) => send(res, out.ok ? 200 : 500, out))
    .catch((e) => send(res, 500, { ok: false, detail: e.message }));
});

// ─── Image routes (regex: '.webp' boleh ada/tidak) ───────────────────────────
function parsePageId(p) {
  return String(p || '').replace(/\.webp$/i, '').replace(/[^a-z0-9_\-]/gi, '');
}
function decodeDataUrl(u) {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(u || '');
  if (!m) return null;
  return { mime: m[1], buf: Buffer.from(m[2], 'base64') };
}
const IMG_HEADERS = (etag) => ({
  'Content-Type': 'image/webp',
  'Cache-Control': 'public, max-age=604800, immutable',
  ETag: etag,
});

async function loadTranslation(pageId, res) {
  if (!pageId) { send(res, 404, { error: 'Not found' }); return null; }
  const page = await prisma.page.findUnique({ where: { id: pageId }, include: { translation: true } });
  const tr = page && page.translation;
  if (!tr || !tr.resultUrl) { send(res, 404, { error: 'Not found' }); return null; }
  const img = decodeDataUrl(tr.resultUrl);
  if (!img) { send(res, 404, { error: 'Not found' }); return null; }
  return img;
}

// GET /t/<pageId>.webp — hasil akhir terjemahan.
app.get(/^\/t\/([^/]+?)(?:\.webp)?$/, async (req, res) => {
  try {
    const pageId = parsePageId(req.params[0]);
    if (req.headers['if-none-match'] === '"' + pageId + '"') return res.status(304).end();
    const img = await loadTranslation(pageId, res);
    if (!img) return;
    let out = img.buf, type = img.mime;
    if (type !== 'image/webp') { try { out = await sharp(img.buf, { failOn: 'none' }).webp({ quality: 85 }).toBuffer(); type = 'image/webp'; } catch {} }
    res.set(IMG_HEADERS('"' + pageId + '"'));
    res.type(type).end(out);
  } catch (e) { send(res, 500, { error: e.message }); }
});

// GET /p/<pageId>.webp — thumbnail (sharp 150px q70 dari resultUrl).
app.get(/^\/p\/([^/]+?)(?:\.webp)?$/, async (req, res) => {
  try {
    const pageId = parsePageId(req.params[0]);
    const pid = pageId + '-thumb';
    if (req.headers['if-none-match'] === '"' + pid + '"') return res.status(304).end();
    const img = await loadTranslation(pageId, res);
    if (!img) return;
    const thumb = await sharp(img.buf, { failOn: 'none' }).rotate().resize({ width: 150, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
    res.set(IMG_HEADERS('"' + pid + '"'));
    res.end(thumb);
  } catch (e) { send(res, 500, { error: e.message }); }
});

// GET /compare — halaman demo perbandingan asli vs hasil terjemah.
app.get('/compare', async (req, res) => {
  try {
    const pages = await prisma.page.findMany({
      where: { translation: { isNot: null } },
      include: { translation: { select: { createdAt: true } }, chapter: { select: { id: true, chapterNum: true, title: true, series: { select: { title: true, slug: true } } } } },
      orderBy: { id: 'asc' }, take: 50,
    });
    const rows = pages.map((pg) => `
<div class="row">
  <div class="side"><h3>Sebelum (asli)</h3><img src="${pg.imageUrl}" loading="lazy" alt="asli"></div>
  <div class="side"><h3>Sesudah (AI translate → id)</h3><img src="/t/${pg.id}.webp" loading="lazy" alt="translated"></div>
  <div class="meta">${pg.chapter.series.title} — Ch. ${pg.chapter.chapterNum}${pg.chapter.title ? ' ' + pg.chapter.title : ''} · page ${pg.number}</div>
</div>`).join('');
    res.type('html').end(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AKIRAREADS — Sebelum vs Sesudah AI Translate</title>
<style>body{background:#0b0e14;color:#e6e6e6;font-family:system-ui,sans-serif;margin:0;padding:24px}
h1{font-size:22px}h2{font-size:15px;color:#9aa4b2;font-weight:500;margin-top:0}
.row{display:grid;grid-template-columns:1fr 1fr;gap:16px;border:1px solid #1e2530;border-radius:12px;padding:16px;margin-bottom:20px;background:#10141c}
.side h3{font-size:13px;color:#7dd3fc;margin:0 0 8px}.side img{width:100%;height:auto;border-radius:8px;background:#fff}
.meta{grid-column:1/-1;font-size:12px;color:#64748b}</style></head>
<body><h1>AKIRAREADS v3 — Auto Translate AI</h1><h2>Perbandingan halaman asli vs hasil terjemah (inpaint + render teks Indonesia ke dalam balon)</h2>${rows || '<p>Belum ada hasil terjemahan.</p>'}</body></html>`);
  } catch (e) { send(res, 500, { error: e.message }); }
});

app.get('/', (req, res) => res.json({ name: 'akira-reads worker', health: '/health' }));

// ─── Boot (hanya saat dijalankan langsung; import-safe) ──────────────────────
function start() {
  const port = parseInt(env('PORT', '8080'), 10);
  app.listen(port, () => console.log(`[worker] http://0.0.0.0:${port}`));
  loop.start();
  backup.start();
}
if (require.main === module) start();

module.exports = { app, start };
