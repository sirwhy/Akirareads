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
// freeOcrTranslate(imageBuffer, targetLang) -> { regions, sourceLang, ocrProvider, mtProvider }
async function freeOcrTranslate(imageBuffer, targetLang) {
  const meta = await sharp(imageBuffer, { failOn: 'none' }).metadata();
  const W = meta.width, H = meta.height;
  const tl = (targetLang || 'id').toLowerCase();

  let words = [];
  const passes = tl === 'id' ? ['3', '11', '6', '12'] : ['3', '11'];
  for (const psm of passes) {
    try { words = words.concat(parseTsv(await ocrTsv(imageBuffer, psm))); } catch {}
  }
  const seen = new Set(); const uniq = [];
  for (const wd of words) { const k = wd.left + ',' + wd.top + ',' + wd.text; if (!seen.has(k)) { seen.add(k); uniq.push(wd); } }

  const clusters = clusterWords(uniq)
    .filter((c) => (c.right - c.left) * (c.bottom - c.top) > 1800 && c.right - c.left > 45)
    .filter((c) => c.words.some((w) => w.conf > 50));

  const regions = [];
  let jaCount = 0;
  for (const c of clusters) {
    const ordered = c.words.sort((a, b) => a.top - b.top || a.left - b.left);
    const text = ordered.map((w) => w.text).join(' ').replace(/\s+([,.!?、。])/g, '$1').trim();
    if (text.replace(/\s/g, '').length < 3) continue;
    const isJa = (text.match(new RegExp(JP_RE, 'g')) || []).length >= Math.max(2, text.length * 0.2);
    if (isJa) jaCount++;
    // lewati baris yang murni hasil noise: tanpa vokal dan tidak JP
    if (!isJa && !/[aeiou]/i.test(text)) continue;
    const id = await mtTranslate(text, isJa ? 'ja|' + tl : 'en|' + tl);
    if (!id) continue;
    const pad = 8;
    const x = Math.max(0, Math.round((((c.left - pad) / W) * 1000)));
    const y = Math.max(0, Math.round((((c.top - pad) / H) * 1000)));
    const w = Math.min(1000 - x, Math.round((((c.right - c.left + pad * 2) / W) * 1000)));
    const h = Math.min(1000 - y, Math.round((((c.bottom - c.top + pad * 2) / H) * 1000)));
    regions.push({ x, y, w, h, text, translation: id, color: '#111111', align: 'center' });
  }
  return {
    regions,
    sourceLang: jaCount > clusters.length / 2 ? 'ja' : 'en',
    ocrProvider: 'tesseract.js',
    mtProvider: 'mymemory',
  };
}

module.exports = { freeOcrTranslate, clusterWords, parseTsv, mtTranslate };
