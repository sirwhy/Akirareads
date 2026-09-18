// Eksekutor TranslateJob: klaim->RUNNING, halaman urut naik, retry 1x per
// halaman, upsert PageTranslation + Page.translatedUrl/thumbUrl, progress per
// halaman. DONE bila >=1 halaman sukses; FAILED hanya bila semua fatal.
const prisma = require('../../db');
const sharp = require('sharp');
const env = require('../env');
const { translatePage } = require('./pipeline');

async function setJob(id, data) {
  try { await prisma.translateJob.update({ where: { id }, data: { ...data, updatedAt: new Date() } }); } catch {}
}

async function processJob(job) {
  const workerUrl = env('WORKER_URL', `http://localhost:${env('PORT', '8080')}`).replace(/\/+$/, '');
  const targetLang = job.targetLang || 'id';

  const chapter = await prisma.chapter.findUnique({
    where: { id: job.chapterId },
    include: { pages: { orderBy: { number: 'asc' } } },
  });
  if (!chapter) {
    await setJob(job.id, { status: 'FAILED', error: 'Chapter tidak ditemukan', message: '❌ Chapter tidak ditemukan' });
    return;
  }

  const total = chapter.pages.length;
  await setJob(job.id, { status: 'RUNNING', total, done: 0, progress: 0, message: `Menerjemahkan ${total} halaman...` });

  let done = 0, failedPages = 0, ok = 0;
  let lastErr = null;

  for (const page of chapter.pages) {
    done++;
    const pct = total ? Math.floor((done / total) * 100) : 100;
    try {
      let out;
      try {
        out = await translatePage(page, targetLang);
      } catch (e) {
        // retry sekali pada error provider/HTTP
        out = await translatePage(page, targetLang);
      }
      await prisma.pageTranslation.upsert({
        where: { pageId: page.id },
        create: {
          pageId: page.id, chapterHash: out.imgHash || null, sourceLang: out.sourceLang,
          textCount: out.textCount, ocrProvider: out.ocrProvider, mtProvider: out.mtProvider,
          data: out.data, resultUrl: out.resultUrl,
        },
        update: {
          chapterHash: out.imgHash || null, sourceLang: out.sourceLang,
          textCount: out.textCount, ocrProvider: out.ocrProvider, mtProvider: out.mtProvider,
          data: out.data, resultUrl: out.resultUrl,
        },
      });
      const dims = /^data:image\/webp;base64,/.test(out.resultUrl) ? await webpDims(out.resultUrl) : { w: null, h: null };
      await prisma.page.update({
        where: { id: page.id },
        data: {
          translatedUrl: `${workerUrl}/t/${page.id}.webp`,
          thumbUrl: `${workerUrl}/p/${page.id}.webp`,
          thumbW: dims.w, thumbH: dims.h,
        },
      });
      ok++;
      await setJob(job.id, { done, progress: pct });
    } catch (e) {
      failedPages++;
      lastErr = e;
      const msg = String(e && e.message ? e.message : e);
      await setJob(job.id, { done, progress: pct, message: `Halaman ${page.number} gagal: ${msg.substring(0, 900)}` });
    }
  }

  if (ok === 0) {
    await setJob(job.id, {
      status: 'FAILED', progress: 100,
      error: String(lastErr && lastErr.message ? lastErr.message : lastErr || 'tidak ada halaman sukses').substring(0, 900),
      message: `❌ Semua ${total} halaman gagal`,
    });
  } else {
    await setJob(job.id, {
      status: 'DONE', progress: 100, done,
      message: failedPages > 0
        ? `✅ Selesai — ${failedPages} halaman gagal (pakai gambar asli)`
        : '✅ Terjemahan selesai',
    });
  }
}

// Ambil dimensi webp dari header sederhana (VP8/VP8L/VP8X chunk).
async function webpDims(dataUrl) {
  try {
    const buf = Buffer.from(dataUrl.split(',', 2)[1], 'base64');
    const m = await sharp(buf).metadata();
    return { w: m.width, h: m.height };
  } catch {
    return { w: null, h: null };
  }
}
async function runTranslateJob(jobId) {
  const job = await prisma.translateJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('TranslateJob tidak ditemukan');
  if (job.status === 'RUNNING') return;
  const { count } = await prisma.translateJob.updateMany({
    where: { id: jobId, status: 'PENDING' },
    data: { status: 'RUNNING', message: 'Diproses...', updatedAt: new Date() },
  });
  if (count !== 1) return;
  await processJob(job);
}

module.exports = { runTranslateJob, processJob };
