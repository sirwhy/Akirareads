/**
 * Mirror/Scraper v2 — Fixed:
 *  1. MangaDex: Fix 100-chapter bug (language filter + proper pagination + dedup)
 *  2. ikiru.id / shinigami.asia: Browser-based import (user fetches in browser, sends to API)
 *  3. Generic Madara: Improved scraper with retry + AJAX fallback
 */
const router  = require('express').Router();
const axios   = require('axios');
const cheerio = require('cheerio');
const prisma  = require('../lib/prisma');
const { adminMiddleware } = require('../lib/auth');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slugify(s) {
  return (s||'untitled').toLowerCase()
    .replace(/[^a-z0-9\s-]/g,'').trim()
    .replace(/\s+/g,'-').replace(/-+/g,'-').substring(0,80) || 'untitled';
}
async function uniqueSlug(base) {
  let slug = slugify(base);
  const exists = await prisma.series.findUnique({ where: { slug } });
  if (exists) slug = slug + '-' + Date.now().toString(36);
  return slug;
}
function detectSite(url) {
  if (/mangadex\.org/.test(url))           return 'mangadex';
  if (/ikiru\.(id|wtf)/.test(url))         return 'ikiru';
  if (/shinigami\.(asia|io)/.test(url))    return 'shinigami';
  if (/shngm\.(id|io)/.test(url))         return 'shinigami';
  if (/komiku\.(id|com)/.test(url))        return 'komiku';
  if (/manhwaindo\.id/.test(url))          return 'manhwaindo';
  if (/komikcast\.io/.test(url))           return 'komikcast';
  if (/\/manga\/|\/komik\/|\/series\//.test(url)) return 'madara';
  return 'generic';
}
const BROWSER_UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36';
function mdaraHeaders(referer='') {
  return {
    'User-Agent': BROWSER_UA,
    'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    ...(referer ? { Referer: referer } : {}),
  };
}
async function httpGet(url, headers={}, retries=2) {
  for (let i=0; i<=retries; i++) {
    try {
      const r = await axios.get(url, { headers: { ...mdaraHeaders(url), ...headers }, timeout: 20000, maxRedirects: 5 });
      return r.data;
    } catch(e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 3000 * (i+1)));
    }
  }
}
async function updateJob(id, data) {
  try { await prisma.mirrorJob.update({ where:{id}, data:{...data, updatedAt:new Date()} }); } catch{}
}

// ─── MangaDex (FIXED) ─────────────────────────────────────────────────────────
// Fix: proper language priority (id > en > any), full pagination, correct dedup
async function scrapeMangaDex(url, jobId) {
  const match = url.match(/manga\/([a-f0-9-]{36})/);
  if (!match) throw new Error('URL MangaDex tidak valid. Format: https://mangadex.org/title/UUID/...');
  const mangaId = match[1];

  await updateJob(jobId, { status:'RUNNING', message:'Mengambil info manga dari MangaDex...' });

  const { data: { data: manga } } = await axios.get(
    `https://api.mangadex.org/manga/${mangaId}`,
    { params: { 'includes[]': ['author','artist','cover_art'] }, timeout: 15000 }
  );
  const a = manga.attributes;
  const title  = a.title.en || a.title.id || Object.values(a.title)[0] || 'Unknown';
  const desc   = a.description?.en || a.description?.id || Object.values(a.description||{})[0] || '';
  const status = a.status==='completed'?'COMPLETED':a.status==='hiatus'?'HIATUS':'ONGOING';
  const genres = (a.tags||[]).filter(t=>t.attributes.group==='genre').map(t=>t.attributes.name.en).filter(Boolean);
  const author = manga.relationships?.find(r=>r.type==='author')?.attributes?.name || '';
  const coverR = manga.relationships?.find(r=>r.type==='cover_art');
  const cover  = coverR ? `https://uploads.mangadex.org/covers/${mangaId}/${coverR.attributes?.fileName}` : '';
  const origin = a.originalLanguage || '';
  const type   = origin==='ko' ? 'MANHWA' : (origin==='zh'||origin==='zh-hk') ? 'MANHUA' : 'MANGA';

  await updateJob(jobId, { message:`Series: "${title}" — mengambil semua chapter...` });

  const series = await prisma.series.create({
    data: { title, slug: await uniqueSlug(title), description:desc, author, status, genres, cover, type, sourceUrl:url },
  });

  // ── FIX: Fetch ALL chapters with language priority ──────────────────────────
  // Try Indonesian first, then English, then any language
  // MangaDex API max limit is 500 per request (not 100)
  const LANG_PRIORITY = ['id','en'];
  let bestChapters = {};  // chapterNum -> chapter object (dedup by number, prefer id > en)

  for (const lang of [...LANG_PRIORITY, null]) {  // null = all languages as fallback
    if (Object.keys(bestChapters).length > 0 && lang === null) break; // already have chapters
    
    let offset = 0, fetched = 0, total = 1;
    const langChapters = {};

    while (offset < total) {
      try {
        const params = {
          limit: 500,   // FIX: use max limit (500) not 100
          offset,
          'order[chapter]': 'asc',
          'order[createdAt]': 'asc',
          ...(lang ? { 'translatedLanguage[]': lang } : {}),
        };
        const { data } = await axios.get(
          `https://api.mangadex.org/manga/${mangaId}/feed`,
          { params, timeout: 30000 }
        );
        
        total = data.total || 0;
        const items = data.data || [];
        fetched += items.length;
        
        for (const ch of items) {
          const num = ch.attributes.chapter;
          if (!num) continue;
          const numFloat = parseFloat(num);
          if (isNaN(numFloat)) continue;
          // Keep first occurrence (already sorted asc, prefer this language)
          if (!(numFloat in langChapters)) {
            langChapters[numFloat] = ch;
          }
        }
        
        offset += items.length;
        if (items.length === 0) break;  // safety
        await new Promise(r => setTimeout(r, 500)); // rate limit
      } catch(e) {
        if (e.response?.status === 429) {
          await new Promise(r => setTimeout(r, 10000)); // wait on rate limit
          continue;
        }
        break;
      }
    }
    
    if (Object.keys(langChapters).length > 0) {
      // Merge: prefer current priority language over previous
      for (const [num, ch] of Object.entries(langChapters)) {
        if (!(num in bestChapters)) {
          bestChapters[num] = ch;
        }
      }
      await updateJob(jobId, { message:`Bahasa ${lang||'any'}: ${Object.keys(langChapters).length} chapter unik ditemukan. Total sejauh ini: ${Object.keys(bestChapters).length}` });
    }
  }

  const uniqueChapters = Object.values(bestChapters).sort((a,b) => 
    parseFloat(a.attributes.chapter) - parseFloat(b.attributes.chapter)
  );

  await updateJob(jobId, {
    total: uniqueChapters.length,
    message: `✅ ${uniqueChapters.length} chapter unik — mulai download halaman...`
  });

  // ── Save chapters with pages ────────────────────────────────────────────────
  let saved = 0, failed = 0;
  for (const ch of uniqueChapters) {
    const chNum = parseFloat(ch.attributes.chapter);
    try {
      // Get pages with retry
      let pgData;
      for (let retry=0; retry<3; retry++) {
        try {
          const { data } = await axios.get(`https://api.mangadex.org/at-home/server/${ch.id}`, { timeout:15000 });
          pgData = data;
          break;
        } catch(e) {
          if (e.response?.status===429) await new Promise(r=>setTimeout(r,8000));
          else if (retry===2) throw e;
        }
      }
      if (!pgData) { failed++; continue; }

      const base = pgData.baseUrl;
      const hash = pgData.chapter.hash;
      const imgs = (pgData.chapter.data || []).map((img,i) => ({
        number: i+1,
        imageUrl: `${base}/data/${hash}/${img}`,
      }));

      if (imgs.length === 0) { failed++; continue; }

      await prisma.chapter.create({
        data: {
          seriesId: series.id,
          chapterNum: chNum,
          title: ch.attributes.title || null,
          pages: { create: imgs },
        },
      });
      saved++;
      if (saved % 10 === 0) {
        await updateJob(jobId, { progress:saved, message:`${saved}/${uniqueChapters.length} chapter tersimpan (${failed} gagal)...` });
      }
      await new Promise(r => setTimeout(r, 400)); // polite rate limit
    } catch { failed++; }
  }

  return { series, chaptersCount: saved, note: failed > 0 ? `${failed} chapter gagal diimport.` : '' };
}

// ─── Browser-Import: ikiru.id & shinigami.asia ────────────────────────────────
// These sites use Cloudflare - scraping from server is impossible
// Solution: Admin fetches data IN their browser, sends it to our API
// We provide a bookmarklet/script they run in browser DevTools

async function importFromBrowser(payload, jobId) {
  // payload from browser script: { title, slug, cover, description, genres, type, status, author, chapters: [{num, title, pages:[url,...]}] }
  await updateJob(jobId, { status:'RUNNING', message:'Memproses data dari browser...' });

  const { title, cover, description, genres, type, status, author, chapters, sourceUrl } = payload;
  if (!title) throw new Error('Data tidak valid: title wajib ada');
  if (!chapters || !Array.isArray(chapters) || chapters.length === 0)
    throw new Error('Tidak ada chapter dalam data yang dikirim');

  const series = await prisma.series.create({
    data: {
      title,
      slug: await uniqueSlug(title),
      description: description || '',
      cover: cover || '',
      genres: genres || [],
      type: type || 'MANHWA',
      status: status || 'ONGOING',
      author: author || '',
      sourceUrl: sourceUrl || '',
    },
  });

  await updateJob(jobId, { total: chapters.length, message:`Series "${title}" dibuat — menyimpan ${chapters.length} chapter...` });

  let saved = 0;
  for (const ch of chapters) {
    const chNum = parseFloat(ch.num || ch.chapterNum || ch.number || '0');
    if (isNaN(chNum)) continue;
    const pages = (ch.pages || []).filter(Boolean);
    if (pages.length === 0) continue;
    try {
      await prisma.chapter.create({
        data: {
          seriesId: series.id,
          chapterNum: chNum,
          title: ch.title || null,
          pages: { create: pages.map((url, i) => ({ number: i+1, imageUrl: url })) },
        },
      });
      saved++;
      if (saved % 5 === 0) await updateJob(jobId, { progress: saved });
    } catch {}
  }

  return { series, chaptersCount: saved };
}

// ─── Madara HTML Scraper (improved) ───────────────────────────────────────────
async function scrapeMadara(url, jobId, site) {
  await updateJob(jobId, { status:'RUNNING', message:`Mencoba scrape ${site}...` });

  const seriesUrl = url.replace(/\/chapter-[^/]+\/?$/,'/').replace(/\/+$/,'') + '/';
  let html;
  try {
    html = await httpGet(seriesUrl);
  } catch(e) {
    if (e.response?.status === 403) {
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

  const $ = cheerio.load(html);
  const title = ($('meta[property="og:title"]').attr('content') || $('h1').first().text() || 'Unknown').replace(/\s*[-|–].*$/,'').trim();
  const description = ($('meta[property="og:description"]').attr('content') || $('.summary__content').first().text() || '').substring(0,1000).trim();
  const cover = $('meta[property="og:image"]').attr('content') || $('.summary_image img').first().attr('data-src') || $('.summary_image img').first().attr('src') || '';
  const genres = [];
  $('.genres-content a, a[rel="tag"]').each((_,el)=>{ const g=$(el).text().trim(); if(g&&!genres.includes(g)) genres.push(g); });
  const statusText = $('.summary-content').text().toLowerCase();
  const status = statusText.includes('selesai')||statusText.includes('completed')?'COMPLETED':statusText.includes('hiatus')?'HIATUS':'ONGOING';
  const author = $('.author-content a').first().text().trim();
  const type = (site==='ikiru'||site==='komiku') ? 'MANHWA' : 'MANGA';

  // Get chapters
  let chapterLinks = [];
  $('li.wp-manga-chapter a, .chapter-list a, ul.row-content-chapter a').each((_,el)=>{
    const href=$(el).attr('href');
    if (href&&href.includes('chapter')) chapterLinks.push(href);
  });

  // Try AJAX if no chapters found
  if (chapterLinks.length === 0) {
    const postId = (html.match(/postID["\s:]+(\d+)/)||html.match(/manga_id["\s:]+(\d+)/))?.[1];
    if (postId) {
      try {
        const baseUrl = new URL(seriesUrl).origin;
        const ajaxRes = await axios.post(
          `${baseUrl}/wp-admin/admin-ajax.php`,
          `action=manga_get_chapters&manga=${postId}`,
          { headers: { ...mdaraHeaders(seriesUrl), 'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest' } }
        );
        const $a = cheerio.load(ajaxRes.data);
        $a('li.wp-manga-chapter a, a[href*="chapter"]').each((_,el)=>{ const h=$a(el).attr('href'); if(h) chapterLinks.push(h); });
      } catch {}
    }
  }

  const seen = new Set();
  const uniqueLinks = chapterLinks.filter(h=>{ if(seen.has(h))return false; seen.add(h); return true; });
  const chapterData = uniqueLinks.map(href=>{
    const m = href.match(/chapter[- ]?(\d+(?:\.\d+)?)/i);
    return m ? { href, num: parseFloat(m[1]) } : null;
  }).filter(Boolean).sort((a,b)=>a.num-b.num);

  await updateJob(jobId, { total:chapterData.length, message:`${chapterData.length} chapter ditemukan — membuat series...` });

  const series = await prisma.series.create({
    data: { title, slug:await uniqueSlug(title), description, cover, genres, status, type, author, sourceUrl:url },
  });

  let saved = 0;
  const CONCURRENT = 2;
  for (let i=0; i<chapterData.length; i+=CONCURRENT) {
    const batch = chapterData.slice(i, i+CONCURRENT);
    await Promise.all(batch.map(async({href,num})=>{
      try {
        let chHtml;
        try { chHtml = await httpGet(href); } catch { return; }
        const $ch = cheerio.load(chHtml);
        const pageUrls = [];
        $ch('.page-break img, .reading-content img, .wp-manga-chapter-img').each((_,img)=>{
          const src = $ch(img).attr('data-src')||$ch(img).attr('data-lazy-src')||$ch(img).attr('src')||'';
          const clean = src.trim();
          if (clean && !clean.includes('data:') && (clean.startsWith('http')||clean.startsWith('//'))) {
            pageUrls.push(clean.startsWith('//')?'https:'+clean:clean);
          }
        });
        if (pageUrls.length === 0) return;
        await prisma.chapter.create({
          data: { seriesId:series.id, chapterNum:num, pages:{ create:pageUrls.map((u,i)=>({number:i+1,imageUrl:u})) } },
        });
        saved++;
      } catch {}
    }));
    await updateJob(jobId, { progress:Math.min(i+CONCURRENT,chapterData.length) });
    await new Promise(r=>setTimeout(r,1200));
  }

  return { series, chaptersCount:saved };
}

// ─── Generic ──────────────────────────────────────────────────────────────────
async function scrapeGeneric(url, jobId) {
  await updateJob(jobId, { status:'RUNNING', message:'Mengambil info halaman...' });
  let html;
  try { html = await httpGet(url); }
  catch(e) {
    if(e.response?.status===403) throw new Error('Website diproteksi Cloudflare. Gunakan "Import dari Browser".');
    throw e;
  }
  const $ = cheerio.load(html);
  const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim() || 'Untitled';
  const cover = $('meta[property="og:image"]').attr('content') || '';
  const desc  = ($('meta[property="og:description"]').attr('content')||'').substring(0,500);
  const series = await prisma.series.create({
    data: { title, slug:await uniqueSlug(title), description:desc, cover, sourceUrl:url, status:'ONGOING', type:'MANHWA', genres:[] },
  });
  return { series, chaptersCount:0, note:'Import generik: hanya info dasar. Tambah chapter manual.' };
}

// ─── Job processor ────────────────────────────────────────────────────────────
async function processJob(job, browserPayload=null) {
  try {
    let result;
    const site = job.sourceSite;
    if (browserPayload) {
      result = await importFromBrowser(browserPayload, job.id);
    } else if (site==='mangadex') {
      result = await scrapeMangaDex(job.sourceUrl, job.id);
    } else if (['ikiru','shinigami','komiku','manhwaindo','komikcast','madara'].includes(site)) {
      result = await scrapeMadara(job.sourceUrl, job.id, site);
    } else {
      result = await scrapeGeneric(job.sourceUrl, job.id);
    }
    await prisma.mirrorJob.update({
      where:{id:job.id},
      data:{
        status:'DONE',
        progress:result.chaptersCount, total:result.chaptersCount,
        seriesId:result.series?.id,
        message:`✅ Selesai! ${result.chaptersCount} chapter diimport.${result.note?' '+result.note:''}`,
        result:JSON.stringify({seriesId:result.series?.id, seriesSlug:result.series?.slug, title:result.series?.title}),
      },
    });
  } catch(err) {
    await prisma.mirrorJob.update({ where:{id:job.id}, data:{status:'FAILED', message:`❌ ${err.message}`} });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/mirror — start URL-based job
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url?.startsWith('http')) return res.status(400).json({ error: 'URL tidak valid' });
    const site = detectSite(url);
    const job  = await prisma.mirrorJob.create({
      data: { sourceUrl:url, sourceSite:site, status:'PENDING', message:'Job dibuat...' },
    });
    res.json({ message:'Mirror job dimulai', jobId:job.id, site });
    processJob(job);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// POST /api/mirror/bulk — multiple URLs
router.post('/bulk', adminMiddleware, async (req, res) => {
  try {
    const { urls } = req.body;
    if (!Array.isArray(urls)||!urls.length) return res.status(400).json({ error:'urls harus array' });
    if (urls.length > 20) return res.status(400).json({ error:'Maks 20 URL sekaligus' });
    const jobs = [];
    for (const url of urls) {
      if (!url?.startsWith('http')) continue;
      const job = await prisma.mirrorJob.create({ data:{sourceUrl:url, sourceSite:detectSite(url), status:'PENDING', message:'Antri...'} });
      jobs.push(job);
    }
    res.json({ message:`${jobs.length} job dibuat`, jobs:jobs.map(j=>({id:j.id,url:j.sourceUrl,site:j.sourceSite})) });
    (async()=>{ for(const job of jobs){ await processJob(job); await new Promise(r=>setTimeout(r,2000)); } })();
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// POST /api/mirror/browser — receive data scraped by user's browser (for CF-protected sites)
router.post('/browser', adminMiddleware, async (req, res) => {
  try {
    const { url, data: browserData } = req.body;
    if (!browserData) return res.status(400).json({ error:'Tidak ada data dari browser' });
    const site = detectSite(url||'');
    const job = await prisma.mirrorJob.create({
      data: { sourceUrl:url||browserData.sourceUrl||'browser-import', sourceSite:site||'browser', status:'PENDING', message:'Menerima data dari browser...' },
    });
    res.json({ message:'Data diterima, memproses...', jobId:job.id });
    processJob(job, browserData);
  } catch(e) { res.status(500).json({ error:e.message }); }
});

// GET /api/mirror/bookmarklet — return JS script to run in browser console
router.get('/bookmarklet', adminMiddleware, async (req, res) => {
  const { site } = req.query; // 'ikiru' or 'shinigami'
  const apiUrl = (process.env.SERVER_URL || 'http://localhost:5000') + '/api';
  
  // Get admin token from request to include in bookmarklet
  const token = req.headers.authorization?.split(' ')[1] || '';
  
  let script;
  if (site === 'shinigami') {
    script = generateShinigamiScript(apiUrl, token);
  } else {
    // Default: Madara (ikiru, komiku, etc.)
    script = generateMadaraScript(apiUrl, token);
  }
  
  res.json({ script, instructions: getMadaraInstructions(site) });
});

function getMadaraInstructions(site) {
  return [
    `1. Buka halaman series di ${site==='shinigami'?'shinigami.asia':'ikiru.id'} di browser kamu`,
    `2. Tekan F12 → tab Console`,
    `3. Copy-paste script dari field di bawah ke Console`,
    `4. Tekan Enter — script akan otomatis berjalan dan kirim data ke server`,
    `5. Tunggu notifikasi "✅ Berhasil dikirim ke AKIRAREADS!"`,
    `6. Kembali ke halaman ini dan refresh untuk lihat hasilnya`,
  ];
}

function generateMadaraScript(apiUrl, token) {
  return `
// AKIRAREADS Browser Import Script - Madara (ikiru.id/komiku.id)
// Jalankan di Console saat halaman series terbuka
(async function() {
  console.log('🔍 AKIRAREADS: Mengambil data series...');
  
  const data = {
    sourceUrl: location.href,
    title: document.querySelector('meta[property="og:title"]')?.content?.replace(/\\s*[-|–].*$/, '').trim()
      || document.querySelector('h1')?.textContent?.trim() || document.title,
    cover: document.querySelector('meta[property="og:image"]')?.content
      || document.querySelector('.summary_image img')?.dataset?.src
      || document.querySelector('.summary_image img')?.src || '',
    description: document.querySelector('meta[property="og:description"]')?.content
      || document.querySelector('.summary__content')?.textContent?.trim()?.substring(0,1000) || '',
    author: document.querySelector('.author-content a')?.textContent?.trim() || '',
    genres: [...document.querySelectorAll('.genres-content a, a[rel="tag"]')].map(a=>a.textContent.trim()).filter(Boolean),
    status: (() => { const s = document.querySelector('.summary-content')?.textContent?.toLowerCase()||''; return s.includes('selesai')||s.includes('completed')?'COMPLETED':s.includes('hiatus')?'HIATUS':'ONGOING'; })(),
    type: location.hostname.includes('ikiru')||location.hostname.includes('komiku') ? 'MANHWA' : 'MANGA',
    chapters: [],
  };
  
  // Get chapter links
  const chLinks = [...document.querySelectorAll('li.wp-manga-chapter a, .chapter-list a, ul.row-content-chapter a')]
    .map(a=>a.href).filter(h=>h&&h.includes('chapter'));
  
  const unique = [...new Set(chLinks)];
  console.log(\`📚 \${unique.length} chapter ditemukan. Mengambil halaman... (bisa beberapa menit)\`);
  
  let done = 0;
  for (const href of unique) {
    try {
      const numMatch = href.match(/chapter[- ]?(\\d+(?:\\.\\d+)?)/i);
      if (!numMatch) continue;
      const num = parseFloat(numMatch[1]);
      
      // Fetch chapter page
      const res = await fetch(href, { credentials: 'include' });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      
      const pages = [...doc.querySelectorAll('.page-break img, .reading-content img, .wp-manga-chapter-img')]
        .map(img => img.dataset.src || img.dataset.lazySrc || img.src)
        .filter(s => s && s.startsWith('http'));
      
      if (pages.length > 0) {
        data.chapters.push({ num, pages });
      }
      done++;
      if (done % 5 === 0) console.log(\`⏳ \${done}/\${unique.length} chapter diambil...\`);
      await new Promise(r=>setTimeout(r,500)); // polite
    } catch(e) { /* skip */ }
  }
  
  console.log(\`✅ \${data.chapters.length} chapter siap dikirim ke AKIRAREADS...\`);
  
  // Send to our API
  const resp = await fetch('${apiUrl}/mirror/browser', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ${token}' },
    body: JSON.stringify({ url: location.href, data }),
  });
  const result = await resp.json();
  if (resp.ok) {
    console.log('✅ Berhasil dikirim ke AKIRAREADS! Job ID:', result.jobId);
    alert('✅ Data berhasil dikirim ke AKIRAREADS!\\nJob ID: ' + result.jobId + '\\nBuka admin panel untuk melihat status.');
  } else {
    console.error('❌ Gagal:', result.error);
    alert('❌ Gagal: ' + result.error);
  }
})();
`.trim();
}

function generateShinigamiScript(apiUrl, token) {
  return `
// AKIRAREADS Browser Import Script - Shinigami.asia
// Jalankan di Console saat halaman series terbuka
(async function() {
  console.log('🔍 AKIRAREADS: Mengambil data dari Shinigami API...');
  
  // Extract manga UUID from URL or page
  const mangaId = location.pathname.match(/\\/([a-f0-9-]{36})(?:\\/|$)/)?.[1]
    || document.querySelector('[data-manga-id]')?.dataset?.mangaId
    || null;
  
  if (!mangaId) {
    // Try from React state/store
    const scripts = [...document.querySelectorAll('script')].find(s=>s.textContent.includes('"manga_id"'));
    alert('❌ Tidak bisa menemukan manga ID. Buka halaman detail series (bukan chapter).');
    return;
  }
  
  console.log('Manga ID:', mangaId);
  const BASE = 'https://api.shngm.io/v1';
  const H = { 
    'Accept': '*/*', 
    'Origin': location.origin, 
    'Referer': location.href,
    'Content-Type': 'application/json'
  };
  
  // Get manga detail
  const detailRes = await fetch(\`\${BASE}/manga/detail/\${mangaId}\`, {credentials:'include', headers:H});
  const detail = await detailRes.json();
  const md = detail.data || detail;
  
  console.log('Series:', md.title || md.name);
  
  // Get ALL chapters (paginated)
  let allChapters = [], page = 1, total = 1;
  while (allChapters.length < total) {
    const r = await fetch(\`\${BASE}/chapter/\${mangaId}/list?page=\${page}&page_size=100&sort_by=chapter_number&sort_order=asc\`, {credentials:'include',headers:H});
    const d = await r.json();
    total = d.data?.total || d.total || (d.data?.list?.length || 0);
    const items = d.data?.list || d.list || d.data || [];
    if (!Array.isArray(items) || items.length===0) break;
    allChapters.push(...items);
    page++;
    if (page > 50) break;
    await new Promise(r=>setTimeout(r,300));
  }
  
  console.log(\`📚 \${allChapters.length} chapter ditemukan. Mengambil halaman...\`);
  
  const chapters = [];
  let done = 0;
  for (const ch of allChapters) {
    const chId = ch.id || ch.chapter_id;
    if (!chId) continue;
    try {
      const r = await fetch(\`\${BASE}/chapter/detail/\${chId}\`, {credentials:'include',headers:H});
      const d = await r.json();
      const chData = d.data || d;
      
      // Pages are in storage_key or direct image list
      const storageKey = chData.storage_key || chData.s3_key || '';
      let pages = chData.images || chData.pages || [];
      
      if (pages.length===0 && storageKey) {
        // Images stored at assets.shngm.id
        const imgBase = \`https://assets.shngm.id/chapter/manga_\${mangaId}/chapter_\${chId}/\`;
        // Try to get page list
        pages = chData.page_count ? 
          Array.from({length:chData.page_count},(_,i)=>\`\${imgBase}\${String(i).padStart(2,'0')}\`) :
          [];
      }
      
      // Normalize page URLs
      const pageUrls = pages.map(p => {
        if (typeof p === 'string') return p.startsWith('http') ? p : \`https://assets.shngm.id/\${p}\`;
        return p.url || p.image_url || p.src || '';
      }).filter(u=>u&&u.startsWith('http'));
      
      if (pageUrls.length > 0) {
        chapters.push({ num: ch.chapter_number || ch.number || done+1, title: ch.title||null, pages: pageUrls });
      }
      done++;
      if (done%5===0) console.log(\`⏳ \${done}/\${allChapters.length}...\`);
      await new Promise(r=>setTimeout(r,400));
    } catch(e) { console.warn('Skip chapter:', chId, e.message); }
  }
  
  const data = {
    sourceUrl: location.href,
    title: md.title || md.name || 'Unknown',
    cover: md.cover_url || md.thumbnail || md.image || '',
    description: md.synopsis || md.description || md.summary || '',
    author: md.author || '',
    genres: md.genres || md.tags || [],
    type: 'MANHWA',
    status: (md.status||'').toLowerCase().includes('complete') ? 'COMPLETED' : 'ONGOING',
    chapters,
  };
  
  console.log(\`✅ \${chapters.length} chapter siap dikirim...\`);
  
  const resp = await fetch('${apiUrl}/mirror/browser', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer ${token}'},
    body: JSON.stringify({ url: location.href, data }),
  });
  const result = await resp.json();
  if (resp.ok) {
    console.log('✅ Berhasil!', result);
    alert(\`✅ \${chapters.length} chapter berhasil dikirim ke AKIRAREADS!\\nJob ID: \${result.jobId}\`);
  } else {
    alert('❌ Gagal: ' + result.error);
  }
})();
`.trim();
}

// Standard CRUD routes
router.get('/', adminMiddleware, async (req,res) => {
  try { res.json(await prisma.mirrorJob.findMany({ orderBy:{createdAt:'desc'}, take:100 })); }
  catch(e) { res.status(500).json({error:e.message}); }
});
router.get('/:id', adminMiddleware, async (req,res) => {
  try {
    const j = await prisma.mirrorJob.findUnique({where:{id:req.params.id}});
    if (!j) return res.status(404).json({error:'Tidak ditemukan'});
    res.json(j);
  } catch(e) { res.status(500).json({error:e.message}); }
});
router.delete('/:id', adminMiddleware, async (req,res) => {
  try { await prisma.mirrorJob.delete({where:{id:req.params.id}}); res.json({message:'Dihapus'}); }
  catch(e) { res.status(500).json({error:e.message}); }
});

module.exports = router;
