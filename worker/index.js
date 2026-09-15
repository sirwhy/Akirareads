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
