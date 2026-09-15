// Mirror scraper v3 — port 1:1 dari akirareads-old/server/routes/mirror.js.
// Adapters: MangaDex (feed 500/halaman, LANG_PRIORITY id>en>any, dedup per nomor
// chapter, halaman via at-home server), Madara-generic (ikiru, shinigami, komiku,
// komikcast, manhwaindo, madara) + Generic. Browser-import sudah ditangani web
// (POST /api/import/batch) — worker hanya memproses baris MirrorJob.
const crypto = require('crypto');
const prisma = require('../db');
const { httpGet, httpGetJSON, httpFetch, mdaraHeaders, sleep } = require('./http');

// ─── Helpers (port) ───────────────────────────────────────────────────────────
function slugify(s) {
  return (s || 'untitled').toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-').substring(0, 80) || 'untitled';
}
async function uniqueSlug(base) {
  let slug = slugify(base);
  const exists = await prisma.series.findUnique({ where: { slug } });
  if (exists) slug = slug + '-' + Date.now().toString(36);
  return slug;
}
function detectSite(url) {
  if (/mangadex\.org/.test(url)) return 'mangadex';
  if (/ikiru\.(id|wtf)/.test(url)) return 'ikiru';
  if (/shinigami\.(asia|io)/.test(url)) return 'shinigami';
  if (/shngm\.(id|io)/.test(url)) return 'shinigami';
  if (/komiku\.(id|com)/.test(url)) return 'komiku';
  if (/manhwaindo\.id/.test(url)) return 'manhwaindo';
  if (/komikcast\.io/.test(url)) return 'komikcast';
  if (/\/manga\/|\/komik\/|\/series\//.test(url)) return 'madara';
  return 'generic';
}
async function updateJob(id, data) {
  try { await prisma.mirrorJob.update({ where: { id }, data: { ...data, updatedAt: new Date() } }); } catch {}
}
// Hash chapter: sha256(URL halaman terurut digabung '|') — dedup + cache repost.
function chapterHash(urls) {
  return crypto.createHash('sha256').update([...urls].sort().join('|')).digest('hex');
}
// Simpan chapter + halaman. Tabrakan hash unik (repost) -> simpan tanpa hash.
async function createChapter(seriesId, chapterNumRaw, title, imgs) {
  const chapterNum = Number.isFinite(chapterNumRaw) ? chapterNumRaw : 0;
  const pages = { create: imgs.map((p, i) => ({ number: p.number || i + 1, imageUrl: p.imageUrl })) };
  const hash = chapterHash(imgs.map((p) => p.imageUrl));
  try {
    await prisma.chapter.create({ data: { series: { connect: { id: seriesId } }, chapterNum, title: title || null, hash, pages } });
  } catch (e) {
    if (e && e.code === 'P2002') {
      await prisma.chapter.create({ data: { series: { connect: { id: seriesId } }, chapterNum, title: title || null, pages } });
    } else throw e;
  }
}

// ─── MangaDex (FIXED — sama seperti v2) ───────────────────────────────────────
// 1. limit 500/feed pagination penuh, 2. prioritas bahasa id > en > any,
// 3. dedup per nomor chapter (bahasa prioritas menang), 4. halaman = URL
//    at-home ter-hash (mirip mirror; awet & hotlink-aman).
async function scrapeMangaDex(url, jobId) {
  const match = url.match(/(?:manga|title)\/([a-f0-9-]{36})/);
  if (!match) throw new Error('URL MangaDex tidak valid. Format: https://mangadex.org/title/UUID/...');
  const mangaId = match[1];

  await updateJob(jobId, { status: 'RUNNING', message: 'Mengambil info manga dari MangaDex...' });

  const api = 'https://api.mangadex.org';
  const { data: manga } = await httpGetJSON(
    `${api}/manga/${mangaId}?includes%5B%5D=author&includes%5B%5D=artist&includes%5B%5D=cover_art`,
    { timeout: 15000, retries: 2 }
  );
  const a = manga.attributes;
  const title = a.title.en || a.title.id || Object.values(a.title)[0] || 'Unknown';
  const desc = (a.description && (a.description.en || a.description.id)) || Object.values(a.description || {})[0] || '';
  const status = a.status === 'completed' ? 'COMPLETED' : a.status === 'hiatus' ? 'HIATUS' : 'ONGOING';
  const genres = (a.tags || []).filter((t) => t.attributes.group === 'genre').map((t) => t.attributes.name.en).filter(Boolean);
  const author = (manga.relationships || []).find((r) => r.type === 'author')?.attributes?.name || '';
  const coverR = (manga.relationships || []).find((r) => r.type === 'cover_art');
  const cover = coverR ? `https://uploads.mangadex.org/covers/${mangaId}/${coverR.attributes?.fileName}` : '';
  const origin = a.originalLanguage || '';
  const type = origin === 'ko' ? 'MANHWA' : (origin === 'zh' || origin === 'zh-hk') ? 'MANHUA' : 'MANGA';

  await updateJob(jobId, { message: `Series: "${title}" — mengambil semua chapter...` });

  const series = await prisma.series.create({
    data: { title, slug: await uniqueSlug(title), description: desc, author, status, genres, cover, type, sourceUrl: url, sourceSite: 'mangadex' },
  });

  // ── Semua chapter: coba id, lalu en, lalu fallback semua bahasa ────────────
  const LANG_PRIORITY = ['id', 'en'];
  const bestChapters = {}; // numFloat -> entri feed (id > en > any)
  let pagesCount = 0;

  for (const lang of [...LANG_PRIORITY, null]) {
    if (Object.keys(bestChapters).length > 0 && lang === null) break; // sudah punya

    let offset = 0, total = 1;
    const langChapters = {};
    let guard = 0;
    while (offset < total && guard++ < 200) {
      const q = new URLSearchParams({ limit: '500', offset: String(offset), 'order[chapter]': 'asc', 'order[createdAt]': 'asc' });
      if (lang) q.append('translatedLanguage[]', lang);
      let data;
      try {
        data = await httpGetJSON(`${api}/manga/${mangaId}/feed?${q}`, { timeout: 30000, retries: 2 });
      } catch (e) {
        if (e && e.status === 429) { await sleep(10000); continue; } // retry offset sama
        break;
      }
      total = data.total || 0;
      const items = data.data || [];
      for (const ch of items) {
        const num = ch.attributes.chapter ?? '0';
        const numFloat = parseFloat(num);
        if (isNaN(numFloat)) continue;
        if (!(numFloat in langChapters)) langChapters[numFloat] = ch; // sudah urut asc -> kemunculan pertama
      }
      offset += items.length;
      if (items.length === 0) break;
      await sleep(500); // rate limit sopan
    }

    if (Object.keys(langChapters).length > 0) {
      for (const [num, ch] of Object.entries(langChapters)) {
        if (!(num in bestChapters)) bestChapters[num] = ch;
      }
      await updateJob(jobId, { message: `Bahasa ${lang || 'any'}: ${Object.keys(langChapters).length} chapter unik ditemukan. Total sejauh ini: ${Object.keys(bestChapters).length}` });
    }
  }

  const uniqueChapters = Object.values(bestChapters)
    .sort((x, y) => parseFloat(x.attributes.chapter) - parseFloat(y.attributes.chapter));

  await updateJob(jobId, { total: uniqueChapters.length, message: `✅ ${uniqueChapters.length} chapter unik — menyimpan halaman at-home...` });

  let saved = 0, failed = 0;
  for (const ch of uniqueChapters) {
    const chNum = parseFloat(ch.attributes.chapter ?? '0');
    try {
      let pgData;
      for (let retry = 0; retry < 3; retry++) {
        try {
          pgData = await httpGetJSON(`${api}/at-home/server/${ch.id}`, { timeout: 15000, retries: 0 });
          break;
        } catch (e) {
          if (e && e.status === 429) await sleep(8000);
          else if (retry === 2) throw e;
          else await sleep(2500);
        }
      }
      if (!pgData) { failed++; continue; }

      // FIX: simpan URL file at-home ter-hash (bukan URL expiring)
      const base = pgData.baseUrl;
      const hash = pgData.chapter.hash;
      const imgs = (pgData.chapter.data || []).map((img, i) => ({ number: i + 1, imageUrl: `${base}/data/${hash}/${img}` }));
      if (imgs.length === 0) { failed++; continue; }

      await createChapter(series.id, chNum, ch.attributes.title || null, imgs);
      pagesCount += imgs.length;
      saved++;
      if (saved % 10 === 0) await updateJob(jobId, { progress: saved, message: `${saved}/${uniqueChapters.length} chapter tersimpan (${failed} gagal)...` });
      await sleep(400);
    } catch (e) { failed++; console.warn('[mirror] chapter gagal:', e && e.message || e); }
  }

  return { series, chaptersCount: saved, pagesCount, note: failed > 0 ? `${failed} chapter gagal diimport.` : '' };
}

// ─── Madara HTML Scraper (improved) — dipakai juga untuk ikiru, shinigami,
// komiku, komikcast, manhwaindo ────────────────────────────────────────────────
const MADARA_SITES = ['ikiru', 'shinigami', 'komiku', 'manhwaindo', 'komikcast', 'madara'];

async function scrapeMadara(url, jobId, site) {
  await updateJob(jobId, { status: 'RUNNING', message: `Mencoba scrape ${site}...` });

  const seriesUrl = url.replace(/\/chapter-[^/]+\/?$/, '/').replace(/\/+$/, '') + '/';
  let html;
  try {
    html = await httpGet(seriesUrl);
  } catch (e) {
    if (e && (e.status === 403 || e.response?.status === 403)) {
      throw new Error(
        `${site} diproteksi Cloudflare — server tidak bisa akses langsung.\n\n` +
        `Gunakan "Import dari Browser" di tab sebelah:\n` +
        `1. Buka situs di browser kamu\n` +
        `2. Paste script dari panel ke Console (F12)\n` +
        `3. Script otomatis kirim data ke server ini`
      );
    }
    throw new Error(`Gagal akses ${site}: ${e.message}`);
  }

  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const title = ($('meta[property="og:title"]').attr('content') || $('h1').first().text() || 'Unknown').replace(/\s*[-|–].*$/, '').trim();
  const description = ($('meta[property="og:description"]').attr('content') || $('.summary__content').first().text() || '').substring(0, 1000).trim();
  const cover = $('meta[property="og:image"]').attr('content') || $('.summary_image img').first().attr('data-src') || $('.summary_image img').first().attr('src') || '';
  const genres = [];
  $('.genres-content a, a[rel="tag"]').each((_, el) => { const g = $(el).text().trim(); if (g && !genres.includes(g)) genres.push(g); });
  const statusText = $('.summary-content').text().toLowerCase();
  const status = statusText.includes('selesai') || statusText.includes('completed') ? 'COMPLETED' : statusText.includes('hiatus') ? 'HIATUS' : 'ONGOING';
  const author = $('.author-content a').first().text().trim();
  const type = (site === 'ikiru' || site === 'komiku') ? 'MANHWA' : 'MANGA';

  let chapterLinks = [];
  $('li.wp-manga-chapter a, .chapter-list a, ul.row-content-chapter a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('chapter')) chapterLinks.push(href);
  });

  // Fallback AJAX list chapter (Madara wp-admin)
  if (chapterLinks.length === 0) {
    const postId = (html.match(/postID["\s:]+(\d+)/) || html.match(/manga_id["\s:]+(\d+)/))?.[1];
    if (postId) {
      try {
        const baseUrl = new URL(seriesUrl).origin;
        const res = await httpFetch(`${baseUrl}/wp-admin/admin-ajax.php`, {
          method: 'POST', retries: 1, timeout: 20000,
          headers: { ...mdaraHeaders(seriesUrl), 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
          body: `action=manga_get_chapters&manga=${postId}`,
        });
        const $a = cheerio.load(await res.text());
        $a('li.wp-manga-chapter a, a[href*="chapter"]').each((_, el) => { const h = $a(el).attr('href'); if (h) chapterLinks.push(h); });
      } catch {}
    }
  }

  const seen = new Set();
  const uniqueLinks = chapterLinks.filter((h) => { if (seen.has(h)) return false; seen.add(h); return true; });
  const chapterData = uniqueLinks.map((href) => {
    const m = href.match(/chapter[- ]?(\d+(?:\.\d+)?)/i);
    return m ? { href, num: parseFloat(m[1]) } : null;
  }).filter(Boolean).sort((a, b) => a.num - b.num);

  await updateJob(jobId, { total: chapterData.length, message: `${chapterData.length} chapter ditemukan — membuat series...` });

  const series = await prisma.series.create({
    data: { title, slug: await uniqueSlug(title), description, cover, genres, status, type, author, sourceUrl: url, sourceSite: site },
  });

  let saved = 0, pagesCount = 0;
  const CONCURRENT = 2;
  for (let i = 0; i < chapterData.length; i += CONCURRENT) {
    const batch = chapterData.slice(i, i + CONCURRENT);
    await Promise.all(batch.map(async ({ href, num }) => {
      try {
        let chHtml;
        try { chHtml = await httpGet(href); } catch { return; }
        const $ch = cheerio.load(chHtml);
        const pageUrls = [];
        $ch('.page-break img, .reading-content img, .wp-manga-chapter-img').each((_, img) => {
          const src = $ch(img).attr('data-src') || $ch(img).attr('data-lazy-src') || $ch(img).attr('src') || '';
          const clean = src.trim();
          if (clean && !clean.includes('data:') && (clean.startsWith('http') || clean.startsWith('//'))) {
            pageUrls.push(clean.startsWith('//') ? 'https:' + clean : clean);
          }
        });
        if (pageUrls.length === 0) return;
        await createChapter(series.id, num, null, pageUrls.map((u, k) => ({ number: k + 1, imageUrl: u })));
        saved++; pagesCount += pageUrls.length;
      } catch {}
    }));
    await updateJob(jobId, { progress: Math.min(i + CONCURRENT, chapterData.length) });
    await sleep(1200);
  }

  return { series, chaptersCount: saved, pagesCount };
}

// ─── Generic ──────────────────────────────────────────────────────────────────
async function scrapeGeneric(url, jobId) {
  await updateJob(jobId, { status: 'RUNNING', message: 'Mengambil info halaman...' });
  let html;
  try { html = await httpGet(url); }
  catch (e) {
    if (e && (e.status === 403 || e.response?.status === 403)) throw new Error('Website diproteksi Cloudflare. Gunakan "Import dari Browser".');
    throw e;
  }
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || 'Untitled';
  const cover = $('meta[property="og:image"]').attr('content') || '';
  const desc = ($('meta[property="og:description"]').attr('content') || '').substring(0, 500);
  const series = await prisma.series.create({
    data: { title, slug: await uniqueSlug(title), description: desc, cover, sourceUrl: url, sourceSite: 'generic', status: 'ONGOING', type: 'MANHWA', genres: [] },
  });
  return { series, chaptersCount: 0, pagesCount: 0, note: 'Import generik: hanya info dasar. Tambah chapter manual.' };
}

// ─── Pemroses job (dipanggil loop setelah klaim PENDING -> RUNNING) ──────────
async function processJob(job) {
  try {
    let result;
    const site = job.sourceSite || detectSite(job.sourceUrl);
    if (site === 'mangadex') {
      result = await scrapeMangaDex(job.sourceUrl, job.id);
    } else if (MADARA_SITES.includes(site)) {
      result = await scrapeMadara(job.sourceUrl, job.id, site);
    } else {
      result = await scrapeGeneric(job.sourceUrl, job.id);
    }
    const msg = `✅ Selesai! ${result.chaptersCount} chapter diimport.${result.note ? ' ' + result.note : ''}`;
    await prisma.mirrorJob.update({
      where: { id: job.id },
      data: {
        status: 'DONE',
        progress: result.chaptersCount, total: result.chaptersCount,
        seriesId: result.series?.id,
        message: msg.substring(0, 1000),
        result: JSON.stringify({
          seriesId: result.series?.id || null, seriesSlug: result.series?.slug || null,
          title: result.series?.title || null, chapters: result.chaptersCount, pages: result.pagesCount || 0,
        }),
      },
    });
  } catch (err) {
    await prisma.mirrorJob.update({
      where: { id: job.id },
      data: { status: 'FAILED', message: ('❌ ' + (err.message || String(err))).substring(0, 1000) },
    });
  }
}

// Klaim PENDING -> RUNNING (guard updateMany) lalu jalankan; aman dipanggil
// manual (admin route) maupun berbarengan dengan auto-loop.
async function runMirrorJob(jobId) {
  const job = await prisma.mirrorJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('MirrorJob tidak ditemukan');
  if (job.status === 'RUNNING') return;
  const { count } = await prisma.mirrorJob.updateMany({
    where: { id: jobId, status: 'PENDING' },
    data: { status: 'RUNNING', message: 'Diproses...', updatedAt: new Date() },
  });
  if (count !== 1) return;
  await processJob(job);
}

module.exports = { runMirrorJob, processJob, detectSite, slugify, uniqueSlug, createChapter };
