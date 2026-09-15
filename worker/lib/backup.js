// Backup DB: dump semua tabel -> JSON -> gzip (node:zlib) -> upload GDrive
// (multipart, tanpa dep googleapis). Retensi: newest 7, sisanya dihapus.
// Jadwal node-cron BACKUP_CRON default '0 3 * * *'; skip + console.warn bila
// GOOGLE_SA_JSON/GDRIVE_FOLDER_ID belum diset.
const zlib = require('zlib');
const crypto = require('crypto');
const cron = require('node-cron');
const prisma = require('../db');
const env = require('./env');
const gdrive = require('./gdrive');

const TABLES = ['users', 'series', 'chapters', 'pages', 'translate_jobs', 'page_translations', 'comments', 'bookmarks', 'read_history', 'mirror_jobs', 'settings', 'ads'];

function fileName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `akira-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json.gz`;
}

// Semua tabel, findMany berhalaman 500 baris.
async function dumpJson() {
  const out = { generatedAt: new Date().toISOString(), tables: {} };
  for (const t of TABLES) {
    const rows = [];
    let skip = 0;
    for (;;) {
      const batch = await prisma.$queryRawUnsafe(
        `SELECT to_jsonb(x) AS row FROM (SELECT * FROM public.${t} ORDER BY 1 LIMIT 500 OFFSET ${skip}) x`
      );
      if (!batch.length) break;
      for (const b of batch) rows.push(b.row);
      if (batch.length < 500) break;
      skip += 500;
    }
    out.tables[t] = rows;
  }
  return Buffer.from(JSON.stringify(out));
}

async function upload(token, name, gz) {
  const boundary = 'akira' + crypto.randomBytes(8).toString('hex');
  const meta = JSON.stringify({ name, parents: [env('GDRIVE_FOLDER_ID')] });
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
    `--${boundary}\r\nContent-Type: application/gzip\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([head, gz, tail]);
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error('upload GDrive gagal: HTTP ' + res.status + ' ' + (await res.text().catch(() => '')).substring(0, 200));
  return res.json();
}

// Daftar file backup di folder -> hapus yang lama (sisakan newest `keep`).
async function prune(token, keep) {
  const folder = encodeURIComponent(env('GDRIVE_FOLDER_ID'));
  const q = encodeURIComponent(`name contains 'akira-backup-' and '${folder}' in parents and trashed = false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime%20desc&pageSize=100&fields=files(id,name)`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const files = (await res.json()).files || [];
  const deleted = [];
  for (const f of files.slice(keep)) {
    const d = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
    if (d.ok || d.status === 204) deleted.push(f.name);
  }
  return deleted;
}

// runBackup(manual) -> { ok, detail } (detail: { file, deleted }).
async function runBackup(manual) {
  if (!gdrive.isConfigured()) {
    console.warn('[backup] GOOGLE_SA_JSON / GDRIVE_FOLDER_ID belum diset — backup dilewati.');
    return { ok: false, detail: 'GDrive belum dikonfigurasi (GOOGLE_SA_JSON/GDRIVE_FOLDER_ID)' };
  }
  try {
    const json = await dumpJson();
    const gz = zlib.gzipSync(json, { level: 9 });
    const token = await gdrive.getToken();
    const name = fileName();
    const file = await upload(token, name, gz);
    const deleted = await prune(token, 7);
    console.log(`[backup] OK ${name} (${(gz.length / 1024).toFixed(0)}KB, ${deleted.length} lama dihapus)${manual ? ' (manual)' : ''}`);
    return { ok: true, detail: { file: name, id: file.id, bytes: gz.length, deleted } };
  } catch (e) {
    console.warn('[backup] gagal:', e.message);
    return { ok: false, detail: e.message };
  }
}

let started = false;
function start() {
  if (started) return;
  started = true;
  const expr = env('BACKUP_CRON', '0 3 * * *');
  if (!cron.validate(expr)) { console.warn(`[backup] BACKUP_CRON tidak valid: ${expr}`); return; }
  cron.schedule(expr, () => { runBackup(false); }, { timezone: 'Asia/Jakarta' });
  console.log(`[backup] cron terjadwal: ${expr}`);
}

module.exports = { runBackup, start, dumpJson };
