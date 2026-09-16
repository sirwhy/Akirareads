// Mode GRATIS tanpa API key: OCR tesseract.js (WASM) + MT MyMemory.
// Dipakai pipeline sebagai fallback bila vision LLM (gemini/openai/groq) tidak
// ada/tidak aktif. Kualitas: bagus untuk scan Inggris/Indonesia ber-font digital
// (webtoon/manhwa); font artistik JP kasar masih lemah — untuk itu pakai LLM.
const os = require('os');
const path = require('path');
const { createWorker } = require('tesseract.js');
const sharp = require('sharp');
const env = require('../env');

const JP_RE = /[\u3040-\u30ff\u4e00-\u9fff]/;

// Token campur alfabet+kana/han, atau dominan karakter anomali = tebakan
// tesseract yang salah (teks asli manga/webtoon tidak pernah begini).
function garbageToken(t) {
  const lat = (t.match(/[A-Za-z]/g) || []).length;
  const jp = (t.match(new RegExp(JP_RE, 'g')) || []).length;
  if (lat >= 2 && jp >= 1) return true;
  const weird = t.replace(/[A-Za-z0-9\u3040-\u30ff\u4e00-\u9fff\s.,!?'":;()\-\u2018\u2019\u201c\u201d%]/g, '');
  return weird.length > Math.max(1, t.length * 0.3);
}

// ─── Worker tesseract singleton + mutex (bukan concurrency-safe) ────────────
let workerP = null;
let chain = Promise.resolve();
function getWorker() {
  if (!workerP) {
    workerP = createWorker(['eng', 'jpn'], 1, {
      logger: () => {},
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      cachePath: path.join(os.tmpdir(), 'akira-tessdata'),
      createPath: (p) => p,
    }).catch((e) => { workerP = null; throw e; });
  }
  return workerP;
}
function withWorker(fn) {
  const run = chain.then(async () => {
    const w = await getWorker();
    return fn(w);
  });
  chain = run.then(() => {}, () => {});
  return run;
}

async function ocrTsv(buf, psm) {
  return withWorker(async (w) => {
    await w.setParameters({ tessedit_pageseg_mode: psm });
    const r = await w.recognize(buf, {}, { tsv: true });
    return r.data.tsv || '';
  });
}

// ─── TSV -> kata -> cluster balon ────────────────────────────────────────────
function parseTsv(tsv) {
  const rows = [];
  for (const line of tsv.split('\n')) {
    const c = line.split('\t');
    if (c.length < 12 || c[0] !== '5') continue;
    const conf = parseFloat(c[10]);
    const text = c[11];
    if (!text || text === '-1' || conf < 38) continue;
    const hasAlpha = /[A-Za-z]/.test(text) && text.replace(/[^A-Za-z]/g, '').length >= 2;
    const hasCjk = JP_RE.test(text) && text.replace(JP_RE, '').length < text.length;
    if (!hasAlpha && !hasCjk) continue;
    if (garbageToken(text)) continue;
    rows.push({ left: +c[6], top: +c[7], width: +c[8], height: +c[9], conf, text });
  }
  return rows;
}

function clusterWords(words) {
  const clusters = [];
  for (const w of [...words].sort((a, b) => a.top - b.top || a.left - b.left)) {
    let hit = null;
    for (const c of clusters) {
      const overlapX = Math.min(c.right, w.left + w.width) - Math.max(c.left, w.left);
      const overlapY = Math.min(c.bottom, w.top + w.height) - Math.max(c.top, w.top);
      const vgap = Math.max(0, w.top - c.bottom, c.top - (w.top + w.height));
      const hgap = Math.max(0, w.left - c.right, c.left - (w.left + w.width));
      if ((overlapY > -4 && hgap < w.height * 1.4) || (overlapX > -4 && vgap < w.height * 1.8)) { hit = c; break; }
    }
    if (hit) {
      hit.words.push(w);
      hit.left = Math.min(hit.left, w.left); hit.top = Math.min(hit.top, w.top);
      hit.right = Math.max(hit.right, w.left + w.width); hit.bottom = Math.max(hit.bottom, w.top + w.height);
    } else clusters.push({ words: [w], left: w.left, top: w.top, right: w.left + w.width, bottom: w.top + w.height });
  }
  return clusters;
}

// ─── MT: LibreTranslate publik (utama, batch, lebih natural) + MyMemory ────
async function ltBatch(texts, sl, tl) {
  const u = (env('LIBRETRANSLATE_URL') || 'https://translate.disroot.org') + '/translate';
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q: texts.map((t) => t.slice(0, 480)), source: sl, target: tl, format: 'text' }),
        signal: AbortSignal.timeout(25000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      const arr = Array.isArray(d.translatedText) ? d.translatedText : (typeof d.translatedText === 'string' && texts.length === 1 ? [d.translatedText] : null);
      if (arr && arr.length === texts.length) return arr.map((t) => String(t || '').trim() || null);
    } catch {}
    await new Promise((s) => setTimeout(s, 1500 * (i + 1)));
  }
  return null;
}
async function mtTranslate(text, langpair) { // MyMemory satuan (fallback)
  const u = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 480)) + '&langpair=' + langpair +
    (env('MYMEMORY_EMAIL') ? '&de=' + encodeURIComponent(env('MYMEMORY_EMAIL')) : '');
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      const d = await r.json();
      const t = d && d.responseData && d.responseData.translatedText;
      if (d.responseStatus === 200 && t && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) return t;
    } catch {}
    await new Promise((s) => setTimeout(s, 2000 * (i + 1)));
  }
  return null;
}
// Satu bahasa sumber -> batch LT sekali; item gagal/limit antre ke MyMemory.
async function mtBatch(texts, sl, tl) {
  const out = new Array(texts.length).fill(null);
  if (!texts.length) return out;
  const lt = await ltBatch(texts, sl, tl);
  const need = [];
  for (let i = 0; i < texts.length; i++) {
    if (lt && lt[i]) out[i] = lt[i]; else need.push(i);
  }
  for (const i of need) {
    out[i] = await mtTranslate(texts[i], sl + '|' + tl);
    await new Promise((s) => setTimeout(s, 350));
  }
  return out;
}
// Hasil yang masih echoes sumber (>60% kata kembar) = MT gagal diam-diam.
function isEcho(src, tgt) {
  const norm = (t) => String(t).toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z]/g, '')).filter((w) => w.length >= 3);
  const a = norm(src), b = norm(tgt);
  if (a.length < 3 || b.length === 0) return false;
  return b.filter((w) => a.includes(w)).length / b.length > 0.6;
}
const { casualize, residueWords, polishMap } = require('./casual');

// ─── API utama ───────────────────────────────────────────────────────────────
// freeOcrTranslate(imageBuffer, targetLang) -> { regions, sourceLang, ... }
// Coordinate space = base render (halaman di-resize ke ≤1080 oleh render.js),
// jadi kotak inpaint presisi piksel terhadap output akhir (region.px=true).
async function freeOcrTranslate(imageBuffer, targetLang) {
  const meta = await sharp(imageBuffer, { failOn: 'none' }).metadata();
  // Samakan dg renderTranslated: W>1200 -> resize width 1080.
  let W = meta.width, H = meta.height;
  if (W > 1200) { H = Math.round((1080 * H) / W); W = 1080; }
  const sx = W / meta.width, sy = H / meta.height; // skala piksel OCR (full-res) -> base
  const tl = (targetLang || 'id').toLowerCase();

  let words = [];
  const passes = tl === 'id' ? ['3', '11', '6', '12'] : ['3', '11'];
  for (const psm of passes) {
    try { words = words.concat(parseTsv(await ocrTsv(imageBuffer, psm))); } catch {}
  }
  // Dedup berbasis tumpang tindih kotak: kata sama dari psm berbeda ditulis
  // dengan offset >14px (psm 6/12 mengesamping tata letak) — toleransi lama
  // 14px melewatkan duplet, dua versi masuk cluster, dan sampah kana psm6
  // menyambung kata-kata asli jadi mega-cluster yang "menelan" balon kecil.
  const uniq = [];
  for (const wd of words) {
    const k0 = wd.text.toUpperCase();
    let dup = false;
    for (const u of uniq) {
      if (u.k !== k0) continue;
      const ox = Math.max(0, Math.min(u.left + u.width, wd.left + wd.width) - Math.max(u.left, wd.left));
      const oy = Math.max(0, Math.min(u.top + u.height, wd.top + wd.height) - Math.max(u.top, wd.top));
      const small = Math.min(u.width * u.height, wd.width * wd.height);
      if (small > 0 && (ox * oy) / small > 0.4) { dup = true; if (wd.conf > u.conf) Object.assign(u, wd); break; }
    }
    if (!dup) uniq.push({ ...wd, k: k0 });
  }

  // Klasifikasi skrip PER HALAMAN dulu, LALU buang kata salah-skrip SEBELUM
  // clustering: sampah kana halusinasi psm6/12 di halaman Latin dulu justru
  // masuk cluster dan MENYAMBUNG kata-kata berjauhan jadi mega-cluster;
  // filter pasca-cluster membuang tokennya tapi bbox-nya sudah membengkak.
  let allLetters = 0, kanaLetters = 0;
  for (const w of uniq) {
    if (w.conf <= 60) continue;
    allLetters += (w.text.match(/[A-Za-z\u3040-\u30ff\u4e00-\u9fff]/g) || []).length;
    kanaLetters += (w.text.match(new RegExp(JP_RE, 'g')) || []).length;
  }
  const pageJa = allLetters > 0 && kanaLetters >= allLetters * 0.3;
  const scrubbed = uniq.filter((w) => {
    const jp = (w.text.match(new RegExp(JP_RE, 'g')) || []).length;
    if (!pageJa && jp > 0 && jp >= w.text.replace(/\s/g, '').length * 0.34) return false;
    if (pageJa) {
      const lat = (w.text.match(/[A-Za-z]/g) || []).length;
      if (jp === 0 && lat > 0 && lat < 5) return false;
    }
    return true;
  });

  let clusters = clusterWords(scrubbed)
    .filter((c) => (c.right - c.left) * (c.bottom - c.top) > 1800 && c.right - c.left > 45)
    .filter((c) => c.words.some((w) => w.conf > 50));

  // Buang cluster watermark/dekorasi: rasio aspek ekstrem (>8:1) atau menutupi
  // >60% lebar halaman dengan tinggi kecil — balon dialog tidak pernah begini.
  clusters = clusters.filter((c) => {
    const w = c.right - c.left, h = c.bottom - c.top;
    if (w / Math.max(1, h) > 8) return false;
    if (w > W * 0.6 && h < H * 0.03) return false;
    return true;
  });
  // Tumpang tindih parah -> simpan yang lebih kecil (kemungkinan balon asli,
  // bukan cluster lebar hasil penyambungan noise).
  clusters.sort((a, b) => (a.right - a.left) * (a.bottom - a.top) - (b.right - b.left) * (b.bottom - b.top));
  const kept = [];
  for (const c of clusters) {
    let clash = false;
    for (const k of kept) {
      const ox = Math.max(0, Math.min(c.right, k.right) - Math.max(c.left, k.left));
      const oy = Math.max(0, Math.min(c.bottom, k.bottom) - Math.max(c.top, k.top));
      const inter = ox * oy;
      const a1 = (c.right - c.left) * (c.bottom - c.top), a2 = (k.right - k.left) * (k.bottom - k.top);
      if (inter / Math.min(a1, a2) > 0.35) { clash = true; break; }
    }
    if (!clash) kept.push(c);
  }
  clusters = kept;

  // Fase 1: bangun kandidat region per cluster (bahasa sudah disaring pra-cluster).
  const cands = [];
  let jaCount = 0;
  for (const c of clusters) {
    const ordered = c.words.sort((a, b) => a.top - b.top || a.left - b.left);
    // token berulang bersebelahan ("ALREADY? ALREADY") = psm ganda baca kata
    // sama dg offset >14px — buang duplet; pengulangan artistik ("Good, good")
    // jarang persis bersebelahan identik dan tetap terbaca natural tanpa ini.
    const toks = [];
    for (const w of ordered) {
      const key = w.text.toUpperCase().replace(/[^A-Z0-9\u3040-\u30ff\u4e00-\u9fff]/g, '');
      const prev = toks[toks.length - 1];
      if (key && prev && prev.key === key && Math.abs(prev.top - w.top) < Math.max(prev.height, w.height)) continue;
      toks.push({ key, text: w.text, top: w.top, height: w.height });
    }
    let text = toks.map((t) => t.text).join(' ').replace(/\s+([,.!?、。])/g, '$1').trim();
    // potong token sampah: campur skrip / anomali / salah skrip utk halaman ini
    text = text.split(/\s+/).filter((t) => {
      if (garbageToken(t)) return false;
      if (!pageJa && new RegExp(JP_RE).test(t)) return false; // kana di halaman Latin
      if (pageJa) {
        const lat = (t.match(/[A-Za-z]/g) || []).length;
        const jp = (t.match(new RegExp(JP_RE, 'g')) || []).length;
        if (jp === 0 && lat > 0 && lat < 5) return false; // latin pendek di halaman JP
      }
      return true;
    }).join(' ');
    if (text.replace(/\s/g, '').length < 6) continue; // terlalu pendek = hampir pasti noise/SFX
    // halusinasi kecil: tidak ada satu pun kata >=3 karakter (mis. "yi OH. IS? IT")
    if (!ordered.length || !text.split(/\s+/).some((w) => w.replace(/[^A-Za-z0-9\u3040-\u30ff\u4e00-\u9fff]/g, '').length >= 3)) continue;
    const isJa = (text.match(new RegExp(JP_RE, 'g')) || []).length >= Math.max(2, text.length * 0.2);
    if (isJa) jaCount++;
    // lewati baris yang murni hasil noise: tanpa vokal dan tidak JP
    if (!isJa && !/[aeiou]/i.test(text)) continue;
    const hPx = Math.max(6, Math.round((c.bottom - c.top) * sy));
    const wPx = Math.max(6, Math.round((c.right - c.left) * sx));
    const hs = ordered.map((w) => w.height).sort((a, b) => a - b);
    const estFont = Math.max(10, Math.min(64, Math.round((hs[Math.floor(hs.length / 2)] || 16) * sy) || 14));
    const pad = 4;
    const x = Math.max(0, Math.round(c.left * sx) - pad);
    const y = Math.max(0, Math.round(c.top * sy) - pad);
    const w = Math.min(W - x, wPx + pad * 2);
    const h = Math.min(H - y, hPx + pad * 2);
    cands.push({ x, y, w, h, px: true, text, lang: isJa ? 'ja' : 'en', sizePx: estFont });
  }

  // Fase 2: MT batch per bahasa sumber (LibreTranslate sekali jalan; item
  // gagal -> MyMemory satuan). Retry sekali utk hasil echo (=MT gagal diam).
  const regions = [];
  let mtUsed = 'libretranslate+mymemory';
  for (const lang of ['en', 'ja']) {
    const group = cands.filter((c) => c.lang === lang);
    if (!group.length) continue;
    let outs = await mtBatch(group.map((c) => c.text), lang, tl);
    const retry = [];
    for (let i = 0; i < group.length; i++) {
      if (outs[i] && isEcho(group[i].text, outs[i]) && group[i].text.length > 12) retry.push(i);
    }
    if (retry.length) {
      const again = await mtBatch(retry.map((i) => group[i].text), lang, tl);
      retry.forEach((i, k) => { if (again[k]) outs[i] = again[k]; });
    }
    for (let i = 0; i < group.length; i++) {
      const c = group[i];
      let id = outs[i];
      if (!id) continue; // dua MT mati -> region ini lewat (bukan seluruh halaman)
      if (tl === 'id') id = casualize(id);
      // muatkah di kotaknya? (guard lama, kini pd hasil akhir)
      const chars = id.replace(/\s/g, '').length;
      const capArea = c.w * c.h;
      const minArea = chars * (c.sizePx * 0.55) * c.sizePx * 1.2;
      if (c.sizePx < 11 && capArea < minArea) continue;
      regions.push({ ...c, translation: id, color: '#111111', align: 'center' });
      delete regions[regions.length - 1].lang;
    }
  }
  // Fase 3 (khusus id): residu Inggris disikat SEKALI batch per halaman —
  // kamus frasa dulu, sisanya (kata asing tersisa) lewat MT; substitusi hanya
  // bila padanan satu kata. Tanpa ini hasil gratis masih "THE OWNER SUDAH".
  if (tl === 'id' && regions.length) {
    const words = [...new Set(regions.flatMap((r) => residueWords(r.translation, r.text)))];
    if (words.length) {
      const outs = await mtBatch(words, 'en', 'id');
      const wordMap = {};
      words.forEach((w, i) => { const c = outs[i] && casualize(outs[i]); if (c && !/\s/.test(c) && c.toLowerCase() !== w.toLowerCase()) wordMap[w] = c; });
      for (const r of regions) {
        r.translation = polishMap(r.translation, wordMap);
        const chars = r.translation.replace(/\s/g, '').length;
        const minArea = chars * (r.sizePx * 0.55) * r.sizePx * 1.2;
        if (r.sizePx < 11 && r.w * r.h < minArea) r.overflow = true;
      }
    }
  }
  return {
    regions,
    sourceLang: jaCount > cands.length / 2 ? 'ja' : 'en',
    ocrProvider: 'tesseract.js',
    mtProvider: mtUsed,
  };
}
module.exports = { freeOcrTranslate, clusterWords, parseTsv, mtTranslate, ocrTsv };
