// Auto-loop worker: serial, POLL_MS (default 5000) + jeda 1s. Klaim 1 MirrorJob
// PENDING -> jalankan; klaim 1 TranslateJob PENDING -> jalankan. Boot: reset
// RUNNING > 30 menit -> PENDING ('diambil ulang'). Setelah mirror DONE dan
// AUTO_TRANSLATE=1: enqueue TranslateJob utk chapter tanpa halaman terjemah.
const prisma = require('./db');
const env = require('./lib/env');
const mirror = require('./lib/mirror');
const translate = require('./lib/translate');

const STALE_MS = 30 * 60 * 1000;
let running = false;

async function resetStale() {
  const cutoff = new Date(Date.now() - STALE_MS);
  const m = await prisma.mirrorJob.updateMany({
    where: { status: 'RUNNING', updatedAt: { lt: cutoff } },
    data: { status: 'PENDING', message: 'diambil ulang', updatedAt: new Date() },
  });
  const t = await prisma.translateJob.updateMany({
    where: { status: 'RUNNING', updatedAt: { lt: cutoff } },
    data: { status: 'PENDING', message: 'diambil ulang', updatedAt: new Date() },
  });
  if (m.count || t.count) console.log(`[loop] reset RUNNING stale: mirror=${m.count} translate=${t.count}`);
}

async function claimMirror() {
  const job = await prisma.mirrorJob.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' } });
  if (!job) return false;
  const { count } = await prisma.mirrorJob.updateMany({
    where: { id: job.id, status: 'PENDING' },
    data: { status: 'RUNNING', message: 'Diproses...', updatedAt: new Date() },
  });
  if (count !== 1) return true; // ada yang klaim duluan; tick lagi
  await mirror.processJob(job);
  await autoTranslateIfEnabled(job.id);
  return true;
}

async function claimTranslate() {
  const job = await prisma.translateJob.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' } });
  if (!job) return false;
  const { count } = await prisma.translateJob.updateMany({
    where: { id: job.id, status: 'PENDING' },
    data: { status: 'RUNNING', message: 'Diproses...', updatedAt: new Date() },
  });
  if (count !== 1) return true;
  await translate.processJob(job);
  return true;
}

// Setelah mirror DONE: AUTO_TRANSLATE=1 -> antrekan TranslateJob utk SEMUA
// chapter series itu yang belum punya satu pun halaman terjemah.
async function autoTranslateIfEnabled(jobId) {
  try {
    if (env('AUTO_TRANSLATE', '') !== '1') return;
    const job = await prisma.mirrorJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== 'DONE' || !job.seriesId) return;
    const chapters = await prisma.chapter.findMany({
      where: { seriesId: job.seriesId },
      select: { id: true, _count: { select: { pages: true } }, pages: { where: { translatedUrl: { not: null } }, select: { id: true }, take: 1 } },
      orderBy: { chapterNum: 'asc' },
    });
    let enq = 0;
    for (const ch of chapters) {
      if (ch.pages.length > 0) continue; // sudah ada halaman terjemah
      const existing = await prisma.translateJob.findFirst({
        where: { chapterId: ch.id, status: { in: ['PENDING', 'RUNNING'] } },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.translateJob.create({
        data: { chapterId: ch.id, status: 'PENDING', total: ch._count.pages, message: 'Antri (auto-translate)', targetLang: 'id' },
      });
      enq++;
    }
    if (enq) console.log(`[loop] auto-translate: ${enq} chapter diantrekan (series ${job.seriesId})`);
  } catch (e) {
    console.warn('[loop] auto-translate gagal:', e.message);
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    while (await claimMirror()) await new Promise((r) => setTimeout(r, 1000));
    while (await claimTranslate()) await new Promise((r) => setTimeout(r, 1000));
  } finally {
    running = false;
  }
}

let timer = null;
function start() {
  if (timer) return;
  resetStale().catch((e) => console.warn('[loop] resetStale gagal:', e.message));
  const pollMs = Math.max(1000, parseInt(env('POLL_MS', '5000'), 10) || 5000);
  timer = setInterval(() => { tick().catch((e) => console.warn('[loop] tick error:', e.message)); }, pollMs);
  console.log(`[loop] mulai (poll ${pollMs}ms)`);
}
function stop() { if (timer) { clearInterval(timer); timer = null; } }

module.exports = { start, stop, tick, resetStale, autoTranslateIfEnabled };
