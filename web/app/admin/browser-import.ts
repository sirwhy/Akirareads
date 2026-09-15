'use client';

/**
 * Browser-import console-script builder (port dari server lama
 * `generateMadaraScript` / `generateShinigamiScript`, routes/mirror.js).
 *
 * Logika scraping in-page IDENTIK dengan yang lama (selektor Madara, alur API
 * Shinigami) — hanya endpoint + auth yang diadaptasi ke kontrak v3:
 *   POST `${window.location.origin}/api/import/batch`
 *   header X-Admin-Key (konstanta NEXT_PUBLIC_ADMIN_KEY yang di-inline saat
 *   generate; kalau kosong, script prompt() saat dijalankan) + Authorization
 *   Bearer <token JWT admin hasil localStorage saat generate>.
 *
 * Bentuk body sesuai kontrak route baru: { series: {...}, chapters: [{ chapterNum, title, pages }] }.
 */

function authConsts(adminKey: string, token: string): string {
  return [
    `var API = window.location.origin.replace(/\\/+$/, '') + '/api/import/batch';`,
    `var KEY = ${JSON.stringify(adminKey)};`,
    `var TOK = ${JSON.stringify(token)};`,
    `if (!KEY) KEY = (window.prompt('Tempel ADMIN_API KEY (x-admin-key):') || '').trim();`,
    `var AUTH = { 'Content-Type': 'application/json' };`,
    `if (KEY) AUTH['X-Admin-Key'] = KEY;`,
    `if (TOK) AUTH['Authorization'] = 'Bearer ' + TOK;`,
  ].join('\n  ');
}

/** generateMadaraScript(apiUrl, token) — logika DOM scraping dipertahankan verbatim. */
export function buildMadaraImportScript(adminKey: string, token: string): string {
  return `(async function() {
  ${authConsts(adminKey, token)}
  console.log('🔍 AKIRAREADS: Mengambil data series...');

  const series = {
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
  };
  const chapters = [];

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
      const titleMatch = href.match(/chapter[- ]?\\d+(?:\\.\\d+)?(?:[- ]([a-z0-9-]+))?/i);
      const chTitle = titleMatch?.[1] ? titleMatch[1].replace(/-/g,' ') : undefined;

      // Fetch chapter page
      const res = await fetch(href, { credentials: 'include' });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const pages = [...doc.querySelectorAll('.page-break img, .reading-content img, .wp-manga-chapter-img')]
        .map(img => img.dataset.src || img.dataset.lazySrc || img.src)
        .filter(s => s && s.startsWith('http'));

      if (pages.length > 0) {
        chapters.push({ chapterNum: num, title: chTitle, pages });
      }
      done++;
      if (done % 5 === 0) console.log(\`⏳ \${done}/\${unique.length} chapter diambil...\`);
      await new Promise(r=>setTimeout(r,500)); // polite
    } catch(e) { /* skip */ }
  }

  console.log(\`✅ \${chapters.length} chapter siap dikirim ke AKIRAREADS...\`);
  if (!chapters.length) { alert('❌ Tidak ada chapter terbaca. Pastikan kamu di halaman detail series.'); return; }

  // Send to our API
  const resp = await fetch(API, { method: 'POST', headers: AUTH, body: JSON.stringify({ series, chapters }) });
  const result = await resp.json();
  if (resp.ok) {
    console.log('✅ Berhasil dikirim ke AKIRAREADS!', result);
    alert('✅ Data berhasil dikirim ke AKIRAREADS!\\nChapter baru: ' + result.chaptersCreated + '\\nChapter diupdate: ' + result.chaptersUpdated + '\\nHalaman: ' + result.pagesCreated + '\\nBuka admin panel untuk melihat hasilnya.');
  } else {
    console.error('❌ Gagal:', result.error);
    alert('❌ Gagal: ' + result.error);
  }
})();`;
}

/** generateShinigamiScript(apiUrl, token) — alur API shngm dipertahankan verbatim. */
export function buildShinigamiImportScript(adminKey: string, token: string): string {
  return `(async function() {
  ${authConsts(adminKey, token)}
  console.log('🔍 AKIRAREADS: Mengambil data dari Shinigami API...');

  // Extract manga UUID from URL or page
  const mangaId = location.pathname.match(/\\/([a-f0-9-]{36})(?:\\/|$)/)?.[1]
    || document.querySelector('[data-manga-id]')?.dataset?.mangaId
    || null;

  if (!mangaId) {
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
        chapters.push({ chapterNum: ch.chapter_number || ch.number || done+1, title: ch.title||undefined, pages: pageUrls });
      }
      done++;
      if (done%5===0) console.log(\`⏳ \${done}/\${allChapters.length}...\`);
      await new Promise(r=>setTimeout(r,400));
    } catch(e) { console.warn('Skip chapter:', chId, e.message); }
  }

  const series = {
    sourceUrl: location.href,
    title: md.title || md.name || 'Unknown',
    cover: md.cover_url || md.thumbnail || md.image || '',
    description: md.synopsis || md.description || md.summary || '',
    author: md.author || '',
    genres: md.genres || md.tags || [],
    type: 'MANHWA',
    status: (md.status||'').toLowerCase().includes('complete') ? 'COMPLETED' : 'ONGOING',
  };

  console.log(\`✅ \${chapters.length} chapter siap dikirim...\`);
  if (!chapters.length) { alert('❌ Tidak ada chapter terbaca dari Shinigami API.'); return; }

  const resp = await fetch(API, { method:'POST', headers: AUTH, body: JSON.stringify({ series, chapters }) });
  const result = await resp.json();
  if (resp.ok) {
    console.log('✅ Berhasil!', result);
    alert(\`✅ \${chapters.length} chapter berhasil dikirim ke AKIRAREADS!\\nBaru: \${result.chaptersCreated} · Update: \${result.chaptersUpdated} · Halaman: \${result.pagesCreated}\`);
  } else {
    alert('❌ Gagal: ' + result.error);
  }
})();`;
}
