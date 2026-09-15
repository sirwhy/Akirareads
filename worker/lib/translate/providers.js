// Providers OCR+MT Vision LLM — satu panggilan: gambar -> region JSON.
// Rantai provider per TRANSLATE_PROVIDER (auto: gemini -> openai -> groq;
// tanpa key = dilewati). Semua pakai native fetch. 429 -> tidur Retry-After.
const env = require('../env');
const { sleep } = require('../http');

const LANG_NAMES = { id: 'Bahasa Indonesia', en: 'English', ja: 'Japanese', ko: 'Korean', zh: 'Chinese' };

function targetName(lang) { return LANG_NAMES[lang] || lang; }

// Prompt ketat: HANYA array JSON, koordinat 0-1000 relatif.
function buildPrompt(targetLang) {
  const casual = targetLang === 'id'
    ? ' Gunakan gaya Bahasa Indonesia kasual yang natural untuk manhwa/manga (sapaan "aku/kamu/gue" sesuai konteks).'
    : '';
  return 'You are a manga/manhwa OCR + translation engine. Look at this comic page image and return ONLY a JSON array — no prose, no markdown outside the array. Each element is one text region (speech bubble or caption):\n' +
    '{"x":<left>,"y":<top>,"w":<width>,"h":<height>,"text":"<original speech>","translation":"<translated>","color":"#rrggbb","bg":"#rrggbb","align":"left|center|right","size":"s|m|l|xl"}\n' +
    'Rules:\n' +
    '- x,y,w,h are PERCENTS OF IMAGE SIZE on a 0-1000 scale (0=left/top edge, 1000=right/bottom edge), integers.\n' +
    '- text = original speech exactly as written; translation = into ' + targetName(targetLang) + '.' + casual + '\n' +
    '- color = best-guess text color hex; bg = best-guess bubble background hex.\n' +
    '- align = dominant text alignment; size = s|m|l|xl relative to bubble.\n' +
    '- SKIP non-speech text: SFX/sound effects, watermarks, scanlator marks, website names/URLs (e.g. "Ikiru", "Shinigami", "KomikCast", "ManhwaIndo", "mangadex"), chapter numbers, page numbers, credits.\n' +
    '- If no speech bubbles exist, return [].\n' +
    'Return ONLY the JSON array.';
}

// ─── Parse region JSON ────────────────────────────────────────────────────────
function parseRegions(raw) {
  if (!raw) throw new Error('respons kosong');
  let s = String(raw).trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  let arr = null;
  try {
    const v = JSON.parse(s);
    if (Array.isArray(v)) arr = v; else if (v && Array.isArray(v.regions)) arr = v.regions;
  } catch {}
  if (!arr) {
    const m = s.match(/\[[\s\S]*\]/);
    if (m) { try { arr = JSON.parse(m[0]); } catch {} }
  }
  if (!arr) {
    // regex-extract objek per objek; nol objek = gagal total -> lempar
    arr = [];
    const re = /\{[^{}]*"text"[^{}]*\}/g;
    let o;
    while ((o = re.exec(s))) { try { arr.push(JSON.parse(o[0])); } catch {} }
    if (arr.length === 0) throw new Error('parse region gagal: bukan JSON array');
  }
  if (!Array.isArray(arr)) throw new Error('parse region gagal: bukan array');
  const norm = [];
  for (const r of arr) {
    if (!r || typeof r !== 'object') continue;
    const x = Number(r.x), y = Number(r.y), w = Number(r.w), h = Number(r.h);
    if (![x, y, w, h].every(Number.isFinite)) continue;
    const text = String(r.text || '').trim();
    const translation = String(r.translation ?? r.text ?? '').trim();
    if (!text && !translation) continue;
    norm.push({
      x: Math.max(0, Math.min(1000, Math.round(x))),
      y: Math.max(0, Math.min(1000, Math.round(y))),
      w: Math.max(1, Math.min(1000, Math.round(w))),
      h: Math.max(1, Math.min(1000, Math.round(h))),
      text, translation,
      color: hexOr(r.color, '#111111'),
      bg: hexOr(r.bg, '#ffffff'),
      align: ['left', 'center', 'right'].includes(r.align) ? r.align : 'center',
      size: ['s', 'm', 'l', 'xl'].includes(r.size) ? r.size : 'm',
    });
  }
  return norm;
}
function hexOr(v, def) {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toLowerCase() : def;
}

// Deteksi bahasa sumber sederhana (heuristik rentang karakter).
function detectSourceLang(regions) {
  let ja = 0, ko = 0, zh = 0, ascii = 0, total = 0;
  for (const r of regions) {
    for (const ch of r.text) {
      const c = ch.codePointAt(0);
      total++;
      if (c >= 0x3040 && c <= 0x30ff) ja++;
      else if (c >= 0xac00 && c <= 0xd7af) ko++;
      else if (c >= 0x4e00 && c <= 0x9fff) zh++;
      else if (c < 0x300) ascii++;
    }
  }
  if (total === 0) return null;
  if (ja / total > 0.15) return 'ja';
  if (ko / total > 0.15) return 'ko';
  if (zh / total > 0.15) return 'zh';
  return 'en';
}

// ─── Panggilan provider (429 -> Retry-After) ─────────────────────────────────
async function postJSON(url, body, headers) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 120000);
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ac.signal });
    } finally { clearTimeout(timer); }
    if (res.status === 429) {
      const ra = parseFloat(res.headers.get('retry-after') || '') || (5 * (attempt + 1));
      await sleep(Math.min(60, ra) * 1000);
      continue;
    }
    if (!res.ok) {
      const t = (await res.text().catch(() => '')).substring(0, 300);
      throw new Error(`HTTP ${res.status}: ${t}`);
    }
    return res.json();
  }
  throw new Error('HTTP 429 beruntun (rate limit)');
}

async function geminiOCR(buf, mime, targetLang) {
  const key = env('GEMINI_API_KEY');
  if (!key) return null;
  const model = env('GEMINI_MODEL', 'gemini-2.0-flash');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const j = await postJSON(url, {
    contents: [{ role: 'user', parts: [
      { inline_data: { mime_type: mime, data: buf.toString('base64') } },
      { text: buildPrompt(targetLang) },
    ] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
  }, { 'content-type': 'application/json' });
  const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  return { regions: parseRegions(text), provider: 'gemini' };
}

async function openaiOCR(buf, mime, targetLang) {
  const key = env('OPENAI_API_KEY');
  if (!key) return null;
  const model = env('OPENAI_MODEL', 'gpt-4o-mini');
  const j = await postJSON('https://api.openai.com/v1/chat/completions', {
    model, temperature: 0.1, max_tokens: 8192,
    messages: [{ role: 'user', content: [
      { type: 'text', text: buildPrompt(targetLang) },
      { type: 'image_url', image_url: { url: `data:${mime};base64,${buf.toString('base64')}` } },
    ] }],
  }, { 'content-type': 'application/json', authorization: `Bearer ${key}` });
  const text = j.choices?.[0]?.message?.content || '';
  return { regions: parseRegions(text), provider: 'openai' };
}

async function groqOCR(buf, mime, targetLang) {
  const key = env('GROQ_API_KEY');
  if (!key) return null;
  const model = env('GROQ_MODEL', 'meta-llama/llama-4-scout-17b-16e-instruct');
  const j = await postJSON('https://api.groq.com/openai/v1/chat/completions', {
    model, temperature: 0.1, max_completion_tokens: 8192,
    messages: [{ role: 'user', content: [
      { type: 'text', text: buildPrompt(targetLang) },
      { type: 'image_url', image_url: { url: `data:${mime};base64,${buf.toString('base64')}` } },
    ] }],
  }, { 'content-type': 'application/json', authorization: `Bearer ${key}` });
  const text = j.choices?.[0]?.message?.content || '';
  return { regions: parseRegions(text), provider: 'groq' };
}

const CHAIN = { gemini: geminiOCR, openai: openaiOCR, groq: groqOCR };
const AUTO_ORDER = ['gemini', 'openai', 'groq'];

// visionOcrTranslate(imageBuffer, mime, targetLang)
// -> { regions, sourceLang, ocrProvider } | melempar Error bila semua gagal.
async function visionOcrTranslate(imageBuffer, mime, targetLang) {
  const pref = env('TRANSLATE_PROVIDER', 'auto').toLowerCase();
  const names = pref === 'auto' ? AUTO_ORDER : [pref];
  let lastErr = null, anyConfigured = false;
  for (const name of names) {
    const fn = CHAIN[name];
    if (!fn) { lastErr = new Error(`provider tidak dikenal: ${name}`); continue; }
    try {
      const out = await fn(imageBuffer, mime, targetLang);
      if (!out) continue; // tanpa key -> skip (perilaku auto)
      anyConfigured = true;
      return { regions: out.regions, sourceLang: detectSourceLang(out.regions), ocrProvider: out.provider, mtProvider: out.provider };
    } catch (e) {
      anyConfigured = true;
      lastErr = e;
    }
  }
  if (!anyConfigured) throw new Error('Tidak ada provider OCR dengan API key (set GEMINI_API_KEY / OPENAI_API_KEY / GROQ_API_KEY)');
  throw new Error('Semua provider OCR gagal: ' + (lastErr?.message || lastErr));
}

module.exports = { visionOcrTranslate, parseRegions, detectSourceLang, buildPrompt };
