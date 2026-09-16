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

// ─── MT MyMemory (gratis, tanpa key; ~50 kata/menit, 5000/hari IP) ──────────
async function mtTranslate(text, langpair) {
  const u = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 480)) + '&langpair=' + langpair +
    (env('MYMEMORY_EMAIL') ? '&de=' + encodeURIComponent(env('MYMEMORY_EMAIL')) : '');
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      const d = await r.json();
      const t = d && d.responseData && d.responseData.translatedText;
      if (d.responseStatus === 200 && t && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(t)) return t;
    } catch {}
    await new Promise((s) => setTimeout(s, 3000 * (i + 1)));
  }
  return null;
}

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
  // Dedup toleran posisi: kata sama dari psm berbeda (~dalam 14px) = duplikat;
  // simpan conf tertinggi. Tanpa ini, kata duplet muncul 2x di teks cluster.
  const uniq = [];
  for (const wd of words) {
    const k0 = wd.text.toUpperCase();
    let dup = false;
    for (const u of uniq) if (u.k === k0 && Math.abs(u.left - wd.left) < 14 && Math.abs(u.top - wd.top) < 14) { dup = true; if (wd.conf > u.conf) Object.assign(u, wd); break; }
    if (dup) continue;
    uniq.push({ ...wd, k: k0 });
  }

  let clusters = clusterWords(uniq)
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

  // Klasifikasi skrip PER HALAMAN dulu: pada halaman Latin (webtoon EN/ID),
  // token berisi kana/han = halusinasi tesseract ("鶏 Wh す マ iN"). Hanya
  // kata conf>60 yang dihitung — halusinasi kana di halaman Latin menaikkan
  // rasio kalau semua kata ikut; halaman JP sejati didominasi kana (>30%).
  let allLetters = 0, kanaLetters = 0;
  for (const c of clusters) for (const w of c.words) {
    if (w.conf <= 60) continue;
    allLetters += (w.text.match(/[A-Za-z\u3040-\u30ff\u4e00-\u9fff]/g) || []).length;
    kanaLetters += (w.text.match(new RegExp(JP_RE, 'g')) || []).length;
  }
  const pageJa = allLetters > 0 && kanaLetters >= allLetters * 0.3;

  const regions = [];
  let jaCount = 0;
  for (const c of clusters) {
    const ordered = c.words.sort((a, b) => a.top - b.top || a.left - b.left);
    let text = ordered.map((w) => w.text).join(' ').replace(/\s+([,.!?、。])/g, '$1').trim();
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
    if (!ordered.length || !text.split(/\s+/).some((w) => w.replace(/[^A-Za-z\u3040-\u30ff\u4e00-\u9fff]/g, '').length >= 3)) continue;
    const isJa = (text.match(new RegExp(JP_RE, 'g')) || []).length >= Math.max(2, text.length * 0.2);
    if (isJa) jaCount++;
    // lewati baris yang murni hasil noise: tanpa vokal dan tidak JP
    if (!isJa && !/[aeiou]/i.test(text)) continue;
    const id = await mtTranslate(text, isJa ? 'ja|' + tl : 'en|' + tl);
    if (!id) continue;
    const hPx = Math.max(6, Math.round((c.bottom - c.top) * sy));
    const wPx = Math.max(6, Math.round((c.right - c.left) * sx));
    // Font asli = median tinggi glyph kata (bukan tinggi cluster ÷ jumlah kata
    // yang salah utk multi-baris), skala ke piksel base render.
    const hs = ordered.map((w) => w.height).sort((a, b) => a - b);
    const estFont = Math.max(10, Math.min(64, Math.round((hs[Math.floor(hs.length / 2)] || 16) * sy) || 14));
    // Kotak hasil harus cukup luas utk teks terjemah pada font ini; kalau tidak,
    // font diturunkan (render.js shrink) sampai batas 10px — di bawah itu, buang.
    const chars = id.replace(/\s/g, '').length;
    const capArea = wPx * hPx;
    const minArea = chars * (estFont * 0.55) * estFont * 1.2;
    if (estFont < 11 && capArea < minArea) continue;

    const pad = 4;
    const x = Math.max(0, Math.round(c.left * sx) - pad);
    const y = Math.max(0, Math.round(c.top * sy) - pad);
    const w = Math.min(W - x, wPx + pad * 2);
    const h = Math.min(H - y, hPx + pad * 2);
    regions.push({ x, y, w, h, px: true, text, translation: id, color: '#111111', sizePx: estFont, align: 'center' });
  }
  return {
    regions,
    sourceLang: jaCount > clusters.length / 2 ? 'ja' : 'en',
    ocrProvider: 'tesseract.js',
    mtProvider: 'mymemory',
  };
}
module.exports = { freeOcrTranslate, clusterWords, parseTsv, mtTranslate };
