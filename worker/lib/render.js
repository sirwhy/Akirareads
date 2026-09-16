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

// Sampling strip LUAR bbox: kumpulkan semua pixel dari 4 strip (bukan 1 per
// strip), lalu median per channel = dominan; fallback warna tepi terdekat.
// `base` = fungsi pabrik sharp-instance (extract perlu instance baru per pakai).
async function sampleBg(base, W, H, bx, by, bw, bh) {
  const rects = [
    { x: bx, y: by - 9, w: bw, h: 3 },
    { x: bx, y: by + bh + 6, w: bw, h: 3 },
    { x: bx - 9, y: by, w: 3, h: bh },
    { x: bx + bw + 6, y: by, w: 3, h: bh },
  ];
  const R = [], G = [], B = [];
  for (const r of rects) {
    const x = Math.max(0, r.x), y = Math.max(0, r.y);
    const w = Math.min(r.w, W - x), h = Math.min(r.h, H - y);
    if (w < 1 || h < 1) continue;
    try {
      const { data, info } = await base().extract({ left: x, top: y, width: w, height: h }).raw().toBuffer({ resolveWithObject: true });
      const ch = info.channels || 3;
      const n = Math.floor(data.length / ch);
      const step = Math.max(1, Math.floor(n / 120));
      for (let i = 0; i < n; i += step) { R.push(data[i * ch]); G.push(data[i * ch + 1]); B.push(data[i * ch + 2]); }
    } catch {}
  }
  if (R.length < 8) return null;
  const h2 = (v) => Math.round(v).toString(16).padStart(2, '0');
  return '#' + h2(median(R)) + h2(median(G)) + h2(median(B));
}
// ─── Pertumbuhan balon (teknik manga-image-translator, jalur gratis) ───────
// OCR hanya memberi kotak TEKS; balonnya lebih besar. Tumbuh dari bbox teks
// lewat BFS pixel terang (lum>=160) — berhenti di outline balon yang gelap,
// sehingga kotak inpaint = interior balon penuh dan teks duduk DI DALAM balon.
// Guard: (1) interior bbox harus dominan terang — balon putih; (2) komponen
// BFS dibatasi 10x luas bbox — kalau teks menempel latar halaman putih dan
// tumbuh meledak, jangan tumbuh sama sekali.
async function growBubble(base, W, H, bx, by, bw, bh) {
  const pad = Math.min(110, Math.max(16, Math.round(Math.max(bw, bh) * 0.35)));
  const x0 = Math.max(0, bx - pad), y0 = Math.max(0, by - pad);
  const x1 = Math.min(W, bx + bw + pad), y1 = Math.min(H, by + bh + pad);
  const ww = x1 - x0, wh = y1 - y0;
  if (ww < 8 || wh < 8) return null;
  let lum;
  try {
    lum = await base().extract({ left: x0, top: y0, width: ww, height: wh }).greyscale().raw().toBuffer();
  } catch { return null; }
  const sx = bx - x0, sy = by - y0;
  const sx1 = Math.min(ww, sx + bw), sy1 = Math.min(wh, sy + bh);
  let bright = 0;
  for (let y = sy; y < sy1; y++) for (let x = sx; x < sx1; x++) if (lum[y * ww + x] >= 160) bright++;
  if (bright < (sx1 - sx) * (sy1 - sy) * 0.45) return null;
  const seen = new Uint8Array(ww * wh);
  const q = new Int32Array(ww * wh);
  let qh = 0, qt = 0;
  const push = (px, py) => { const i = py * ww + px; if (!seen[i] && lum[i] >= 160) { seen[i] = 1; q[qt++] = i; } };
  for (let y = sy; y < sy1; y++) for (let x = sx; x < sx1; x++) push(x, y);
  const bboxArea = Math.max(100, bw * bh);
  let minX = sx, maxX = sx1 - 1, minY = sy, maxY = sy1 - 1, n = 0;
  while (qh < qt) {
    const i = q[qh++]; n++;
    if (n > bboxArea * 10) return null;
    const x = i % ww, y = (i / ww) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (x > 0) push(x - 1, y);
    if (x < ww - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < wh - 1) push(x, y + 1);
  }
  const gw = maxX - minX + 1, gh = maxY - minY + 1;
  if (gw * gh < bboxArea * 1.08) return null; // sudah hampir pas
  if (gw / gh > 8 || gh / gw > 8) return null; // tumbuh memanjang = bukan balon
  return { x: x0 + minX, y: y0 + minY, w: gw, h: gh };
}

// Warna latar untuk kotak yang SUDAH tumbuh: median pixel TERANG di bagian
// dalam bbox (interior balon) — bukan strip luar yang kini berisi outline.
async function interiorBg(base, W, H, bx, by, bw, bh) {
  const ix = Math.max(0, bx + Math.round(bw * 0.15));
  const iy = Math.max(0, by + Math.round(bh * 0.15));
  const iw = Math.max(2, Math.min(W - ix, Math.round(bw * 0.7)));
  const ih = Math.max(2, Math.min(H - iy, Math.round(bh * 0.7)));
  try {
    const raw = await base().extract({ left: ix, top: iy, width: iw, height: ih }).raw().toBuffer();
    const R = [], G = [], B = [];
    for (let i = 0; i < raw.length; i += 3) {
      if (0.2126 * raw[i] + 0.7152 * raw[i + 1] + 0.0722 * raw[i + 2] >= 170) { R.push(raw[i]); G.push(raw[i + 1]); B.push(raw[i + 2]); }
    }
    if (R.length < 8) return null;
    const h2 = (v) => Math.round(v).toString(16).padStart(2, '0');
    return '#' + h2(median(R)) + h2(median(G)) + h2(median(B));
  } catch { return null; }
}

// Word-wrap dengan METRIK PER-HURUF akurat (bukan hitung-char): faktor lebar
// bold sans per kode karakter. Layout lama underestimasi kapital ~20% -> teks
// meluber keluar kotak inpaint -> menimpa teks asli = "tumpang tindih".
function charW(code) {
  if (code === 32) return 0.34;
  if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90)) return 0.78; // 0-9 A-Z
  if (code >= 97 && code <= 122) return 0.6;                                  // a-z
  return 0.62; // tanda baca/latin-1
}
function measure(s, fs) {
  let w = 0;
  for (let i = 0; i < s.length; i++) w += charW(s.charCodeAt(i)) * fs;
  return w;
}

// auto-shrink 10% per iter s/d muat (max lines = floor(avail/(fs*1.22)));
// setelah 8 shrink izinkan spill 15% tinggi. Return juga `widest` utk perluasan.
function layout(text, bw, bh, size, startFs) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return { lines: [], fs: 28, widest: 0 };
  const fs0 = Math.min(72, Math.max(6, startFs || 28));
  for (let shrink = 0; shrink < 26; shrink++) {
    const fs = Math.max(7, fs0 * Math.pow(0.9, shrink));
    const availW = Math.max(fs, bw - fs * 1.3);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const cand = cur ? cur + ' ' + w : w;
      if (measure(cand, fs) > availW && cur) { lines.push(cur); cur = w; }
      else cur = cand;
      while (measure(cur, fs) > availW && cur.length > 1) { // kata kepanjangan: potong char
        let k = cur.length;
        while (k > 1 && measure(cur.slice(0, k), fs) > availW) k--;
        lines.push(cur.slice(0, k)); cur = cur.slice(k);
      }
    }
    if (cur) lines.push(cur);
    const lh = fs * 1.22;
    const avail = shrink < 8 ? bh : bh * 1.15;
    if (lines.length * lh <= avail) return { lines, fs, widest: Math.max(...lines.map((s) => measure(s, fs))) };
  }
  return { lines: [], fs: 0, widest: 0 }; // = tak muat sama sekali -> inpaint saja
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
  const boxes = []; // kotak yang sudah digambar — region berikutnya tak boleh menabrak
  const interA = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
    * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const clash = (bx, by, bw, bh) => boxes.some((o) => interA({ x: bx, y: by, w: bw, h: bh }, o)
    > 0.02 * Math.min(bw * bh, o.w * o.h));
  for (const r of regions || []) {
    const px = !!r.px;
    let bx = Math.round(px ? r.x : (r.x / 1000) * W);
    let by = Math.round(px ? r.y : (r.y / 1000) * H);
    let bw = Math.max(8, Math.round(px ? r.w : (r.w / 1000) * W));
    let bh = Math.max(8, Math.round(px ? r.h : (r.h / 1000) * H));
    const text = (r.translation || r.text || '').trim();
    // Jalur gratis (px): kotak teks -> kotak BALON penuh (teknik MIT: flood
    // terang berhenti di outline). Balon hasil tumbuh ditolak bila menabrak
    // kotak yang sudah dipasang (menghapus teks tetangga = tumpang tindih).
    let grown = false;
    if (px) {
      const g = await growBubble(base, W, H, bx, by, bw, bh);
      if (g && g.w >= bw && g.h >= bh && g.w * g.h <= W * H * 0.25 && !clash(g.x, g.y, g.w, g.h)) {
        bx = g.x; by = g.y; bw = g.w; bh = g.h; grown = true;
      }
    }
    // PRATATAKAN Teks: kotak tumbuh ke ruang kosong (bawah, atas, kiri, kanan)
    // s/d teks muat dengan font layak (>=70% ukuran asli, maks 24px); tabrakan
    // dgn kotak lain / tepi halaman / batas 25% halaman menghentikan perluasan.
    let L = text ? layout(text, bw, bh, r.size || 'm', r.sizePx) : { lines: [], fs: 0, widest: 0 };
    if (text) {
      const wantFs = Math.min(24, (r.sizePx || 28) * 0.7);
      for (let guard = 0; guard < 14; guard++) {
        if (L.lines.length && L.fs >= wantFs) break;
        const stepY = Math.max(10, Math.round(bh * 0.16));
        const stepX = Math.max(8, Math.round(bw * 0.12));
        let grewOk = false;
        for (const dir of ['d', 'u', 'l', 'r']) {
          let nx = bx, ny = by, nw = bw, nh = bh;
          if (dir === 'd') nh += stepY;
          else if (dir === 'u') { ny -= stepY; nh += stepY; }
          else if (dir === 'l') { nx -= stepX; nw += stepX; }
          else nw += stepX;
          if (nx < 0 || ny < 0 || nx + nw > W || ny + nh > H) continue;
          if (nw * nh > W * H * 0.25) continue;
          if (clash(nx, ny, nw, nh)) continue;
          bx = nx; by = ny; bw = nw; bh = nh; grewOk = true; break;
        }
        if (!grewOk) break;
        const lay = layout(text, bw, bh, r.size || 'm', r.sizePx);
        if (lay.lines.length) L = lay; else break; // tak akan muat — berhenti tumbuh
      }
    }
    boxes.push({ x: bx, y: by, w: bw, h: bh });
    const rx = Math.round(Math.min(bw, bh) / 4);
    const sample = grown
      ? await interiorBg(base, W, H, bx, by, bw, bh) || await sampleBg(base, W, H, bx, by, bw, bh)
      : await sampleBg(base, W, H, bx, by, bw, bh);
    const bg = sample || (r.bg && /^#[0-9a-f]{6}$/i.test(r.bg) ? r.bg : '#ffffff');
    svg += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${rx}" fill="${esc(bg)}"/>`;
    // Teks HANYA digambar bila terbukti muat; selain itu inpaint polos —
    // coretan meluber ke luar kotak menimpa gambar = keluhan "tumpang tindih".
    if (!L.lines.length || L.widest > bw || L.lines.length * L.fs * 1.22 > bh * 1.16) continue;
    let fill = r.color && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : '#111111';
    let stroke = '';
    if (contrast(fill, bg) < 2.5) {
      fill = lum(bg) > 128 ? '#000000' : '#ffffff';
      if (contrast(fill, bg) < 2.5) stroke = ` stroke="${esc(lum(bg) > 128 ? '#ffffff' : '#000000')}" stroke-width="2" paint-order="stroke"`;
    }
    const { lines, fs } = L;
    const lh = fs * 1.22;
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
  return { webp, thumb, width: outMeta.width, height: outMeta.height, boxes };
}

module.exports = { renderTranslated, sampleBg, interiorBg, growBubble, layout, contrast };
