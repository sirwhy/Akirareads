// Pipeline translate satu halaman: unduh -> cache sha256 -> OCR/MT provider ->
// render inpaint+teks. translatePage(page, targetLang) menghasilkan row data
// siap-simpan; pemanggil (index.js) yang menulis DB + progress.
const crypto = require('crypto');
const sharp = require('sharp');
const env = require('../env');
const prisma = require('../../db');
const { httpGetBuffer } = require('../http');
const { visionOcrTranslate } = require('./providers');
const { freeOcrTranslate } = require('./free');
const { renderTranslated } = require('../render');

// Cache level-PAGE: sha256(gambar + PIPELINE_VERSION) disimpan sbg
// PageTranslation.chapterHash -> repost identik reuse tanpa API call. Naikkan
// PIPELINE_VERSION tiap kali kualitas OCR/render/MT berubah supaya hasil lama
// tidak dipakai ulang. Cache level-CHAPTER: chapter.hash + nomor halaman sama.
const PIPELINE_VERSION = 'v3.4-precluster-scrub';
async function findCached(page, imgHash) {
  const hit = await prisma.pageTranslation.findFirst({ where: { chapterHash: imgHash }, take: 1 });
  if (hit) return hit;
  const chHash = page.chapter && page.chapter.hash;
  if (chHash) {
    const other = await prisma.pageTranslation.findFirst({
      where: { chapterHash: chHash, page: { number: page.number, NOT: { id: page.id } } },
      orderBy: { createdAt: 'asc' },
    });
    if (other) return other;
  }
  return null;
}

async function translatePage(page, targetLang) {
  const buf = await httpGetBuffer(page.imageUrl, { timeout: 45000, retries: 2 });
  const imgHash = crypto.createHash('sha256').update(buf).update(PIPELINE_VERSION).digest('hex');

  const cached = await findCached(page, imgHash);
  if (cached) {
    return {
      cached: true, resultUrl: cached.resultUrl, data: cached.data,
      sourceLang: cached.sourceLang, textCount: cached.textCount,
      ocrProvider: cached.ocrProvider || 'cache', mtProvider: cached.mtProvider || 'cache', imgHash,
    };
  }

  const meta = await sharp(buf, { failOn: 'none' }).metadata();
  const mime = meta.format === 'png' ? 'image/png' : meta.format === 'webp' ? 'image/webp' : 'image/jpeg';

  let ocr;
  const pref = (env('TRANSLATE_PROVIDER', 'auto').toLowerCase());
  if (pref === 'free' || pref === 'tesseract') {
    ocr = await freeOcrTranslate(buf, targetLang || 'id');
  } else {
    try {
      ocr = await visionOcrTranslate(buf, mime, targetLang || 'id');
    } catch (e) {
      // Vision LLM tidak terkonfigurasi/gagal total -> fallback mode gratis.
      if (pref !== 'auto') throw e;
      ocr = await freeOcrTranslate(buf, targetLang || 'id');
    }
  }
  const { regions, sourceLang, ocrProvider, mtProvider } = ocr;

  if (!regions.length) {
    // Tanpa teks: hasil = re-encode webp murah (hemat bandwidth), textCount 0.
    const webp = await sharp(buf, { failOn: 'none' }).rotate().flatten({ background: '#ffffff' })
      .resize(meta.width > 1200 ? { width: 1080 } : undefined).webp({ quality: 82 }).toBuffer();
    return {
      cached: false, resultUrl: 'data:image/webp;base64,' + webp.toString('base64'),
      data: [], sourceLang: sourceLang || null, textCount: 0, ocrProvider, mtProvider, imgHash,
    };
  }

  const { webp } = await renderTranslated(buf, regions);
  return {
    cached: false, resultUrl: 'data:image/webp;base64,' + webp.toString('base64'),
    data: regions, sourceLang: sourceLang || null, textCount: regions.length,
    ocrProvider, mtProvider, imgHash,
  };
}

module.exports = { translatePage, findCached };
