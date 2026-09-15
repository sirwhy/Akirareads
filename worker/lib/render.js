// Render halaman terjemahan: inpaint (rect warna bg hasil sampling median di
// luar bbox, offset 6px) + teks terjemah word-wrap auto-shrink, via SVG ->
// @resvg/resvg-js -> composite sharp. Output webp q82 + thumb webp q70 @150px.
const sharp = require('sharp');
const { Resvg } = require('@resvg/resvg-js');

const FONT_STACK = "'Noto Sans','DejaVu Sans',sans-serif";
const SIZE_FACTOR = { s: 7.5, m: 9, l: 11.5, xl: 14 }; // px lebar karakter @ font 28px

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function lum(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const v = m ? parseInt(m[1], 16) : 0xffffff;
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 12) / (Math.min(l1, l2) + 12);
}
function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

// Sampling strip LUAR bbox (offset 6px): hingga 40 pixel -> median per channel.
// `base` = fungsi pabrik sharp-instance (extract perlu instance baru per pakai).
async function sampleBg(base, W, H, bx, by, bw, bh) {
  const rects = [
    { x: bx, y: by - 7, w: bw, h: 1 },
    { x: bx, y: by + bh + 6, w: bw, h: 1 },
    { x: bx - 7, y: by, w: 1, h: bh },
    { x: bx + bw + 6, y: by, w: 1, h: bh },
  ];
  for (const r of rects) {
    const x = Math.max(0, r.x), y = Math.max(0, r.y);
    const w = Math.min(r.w, W - x), h = Math.min(r.h, H - y);
    if (w < 1 || h < 1) continue;
    try {
      const { data, info } = await base().extract({ left: x, top: y, width: w, height: h }).raw().toBuffer({ resolveWithObject: true });
      const ch = info.channels || 3;
      const n = Math.floor(data.length / ch);
      const step = Math.max(1, Math.floor(n / 40));
      const R = [], G = [], B = [];
      for (let i = 0; i < n; i += step) { R.push(data[i * ch]); G.push(data[i * ch + 1]); B.push(data[i * ch + 2]); }
      if (!R.length) continue;
      const h2 = (v) => Math.round(v).toString(16).padStart(2, '0');
      return '#' + h2(median(R)) + h2(median(G)) + h2(median(B));
    } catch {}
  }
  return null;
}

// Word-wrap dengan estimasi lebar karakter; auto-shrink fs 10% per iterasi
// s/d muat (max lines = floor(h/(fs*1.25))). Setelah 8 shrink, izinkan spill
// 15% tinggi region sebelum ukuran terus turun.
function layout(text, bw, bh, size) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return { lines: [], fs: 28 };
  const factor = SIZE_FACTOR[size] || SIZE_FACTOR.m;
  for (let shrink = 0; shrink < 24; shrink++) {
    const fs = Math.max(6, 28 * Math.pow(0.9, shrink));
    const cw = factor * (fs / 28);
    const maxChars = Math.max(1, Math.floor((bw - fs * 0.5) / cw));
    const lines = [];
    let cur = '';
    for (const w of words) {
      const cand = cur ? cur + ' ' + w : w;
      if (cand.length > maxChars && cur) { lines.push(cur); cur = w; }
      else cur = cand;
      while (cur.length > maxChars) { lines.push(cur.slice(0, maxChars)); cur = cur.slice(maxChars); }
    }
    if (cur) lines.push(cur);
    const avail = shrink < 8 ? bh : bh * 1.15; // spill 15%
    const maxLines = Math.max(1, Math.floor(avail / (fs * 1.25)));
    if (lines.length <= maxLines) return { lines, fs };
  }
  const fs = 6;
  const maxChars = Math.max(1, Math.floor(bw / (factor * fs / 28)));
  const lines = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? cur + ' ' + w : w;
    if (cand.length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = cand;
  }
  if (cur) lines.push(cur);
  return { lines, fs };
}

// renderTranslated(imageBuffer, regions) -> { webp, thumb, width, height }
async function renderTranslated(imageBuffer, regions) {
  // Materialisasi base dulu: sharp menjalankan extract SEBELUM resize, jadi
  // koordinat sampling harus terhadap piksel final (post-resize strip lebar).
  let meta = await sharp(imageBuffer, { failOn: 'none' }).metadata();
  let W = meta.width, H = meta.height;
  let baseBuf;
  if (W > 1200) {
    baseBuf = await sharp(imageBuffer, { failOn: 'none' }).rotate().resize({ width: 1080 }).toBuffer();
    meta = await sharp(baseBuf).metadata();
    W = meta.width; H = meta.height;
  } else {
    baseBuf = await sharp(imageBuffer, { failOn: 'none' }).rotate().toBuffer();
  }
  const base = () => sharp(baseBuf, { failOn: 'none' });

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  for (const r of regions || []) {
    const bx = Math.round((r.x / 1000) * W), by = Math.round((r.y / 1000) * H);
    const bw = Math.max(8, Math.round((r.w / 1000) * W)), bh = Math.max(8, Math.round((r.h / 1000) * H));
    const rx = Math.round(Math.min(bw, bh) / 4);
    const sample = await sampleBg(base, W, H, bx, by, bw, bh);
    const bg = sample || (r.bg && /^#[0-9a-f]{6}$/i.test(r.bg) ? r.bg : '#ffffff');
    svg += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${rx}" fill="${esc(bg)}"/>`;
    const text = (r.translation || r.text || '').trim();
    if (!text) continue;
    let fill = r.color && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : '#111111';
    let stroke = '';
    if (contrast(fill, bg) < 2.5) {
      fill = lum(bg) > 128 ? '#000000' : '#ffffff';
      if (contrast(fill, bg) < 2.5) stroke = ` stroke="${esc(lum(bg) > 128 ? '#ffffff' : '#000000')}" stroke-width="2" paint-order="stroke"`;
    }
    const { lines, fs } = layout(text, bw, bh, r.size || 'm');
    const lh = fs * 1.25;
    const align = r.align === 'left' ? 'start' : r.align === 'right' ? 'end' : 'middle';
    const tx = align === 'start' ? bx + fs * 0.3 : align === 'end' ? bx + bw - fs * 0.3 : bx + bw / 2;
    const ty0 = by + Math.max(fs, (bh - lines.length * lh) / 2 + fs);
    svg += `<text font-family="${FONT_STACK}" font-size="${fs.toFixed(1)}" font-weight="600" fill="${esc(fill)}" text-anchor="${align}"${stroke}>`;
    lines.forEach((ln, k) => {
      svg += `<tspan x="${tx}" y="${(ty0 + k * lh).toFixed(1)}">${esc(ln)}</tspan>`;
    });
    svg += '</text>';
  }
  svg += '</svg>';

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  const webp = await base().flatten({ background: '#ffffff' })
    .composite([{ input: Buffer.from(png), blend: 'over' }])
    .webp({ quality: 82 }).toBuffer();
  const thumb = await sharp(webp).resize({ width: 150, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
  const outMeta = await sharp(webp).metadata();
  return { webp, thumb, width: outMeta.width, height: outMeta.height };
}

module.exports = { renderTranslated, sampleBg, layout, contrast };
