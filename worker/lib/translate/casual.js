// Kasualisasi + pembersih residu hasil MT Indonesia — mesin (LibreTranslate/
// MyMemory) menulis register formal ("Anda","apakah","sesungguhnya") dan kadang
// menyisakan kata Inggris secara harfiah ("YES, OF COURSE" -> "YES, TENTU SAJA").
// Pembaca manhwa Indonesia mengharapkan gaya scanlator: aku/kamu, nggak, lagi.
//
// Alur: MT -> casualize(register) -> residueWords(kata asing, anchor sumber)
// -> satu batch MT utk kata-kata itu -> polishMap(substitusi + kamus frasa).

// ─── Register formal -> kasual ───────────────────────────────────────────────
const MAP = [
  [/\bApakah\b/g, ''], // "Apakah kamu mau?" -> " Kamu mau?"
  [/\bakah\b/g, ''],
  [/\bAnda\b/g, 'kamu'], [/\banda\b/g, 'kamu'],
  [/\bSaya\b/g, 'Aku'], [/\bsaya\b/g, 'aku'],
  [/\btidak\b/g, 'nggak'], [/\bTidak\b/g, 'Nggak'],
  [/\bsedang\b/g, 'lagi'],
  [/\btelah\b/g, 'sudah'],
  [/\bmengapa\b/g, 'kenapa'], [/\bMengapa\b/g, 'Kenapa'],
  [/\bbahwa\b/g, 'kalau'],
  [/\bagar\b/g, 'biar'],
  [/\bsesungguhnya\b/g, 'sebenarnya'],
  [/\bmaka\b/g, 'jadi'],
  [/\nadalah\b/g, ''],
  [/\bmerupakan\b/g, ''],
  [/\bdengan\s+mudah\b/g, 'gampang'],
  [/\blebih\s+baik\b/g, 'mending'],
  [/\bharuslah\b/g, 'harus'],
];

function tidy(s) {
  return String(s)
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?…;:])/g, '$1')
    .replace(/([,.!?…;:])\s*$/g, '$1')
    .trim();
}

function casualize(text) {
  let t = String(text || '');
  if (!t) return t;
  const shouty = t === t.toUpperCase() && /[A-ZÀ-ɏ]/.test(t);
  if (shouty) t = t.toLowerCase().replace(/(^|['".!?]\s+)([a-zà-ɏ])/g, (m, p, c) => p + c.toUpperCase());
  for (const [re, rep] of MAP) t = t.replace(re, rep);
  t = tidy(t);
  if (shouty) t = t.toUpperCase();
  t = t.replace(/(^|['".!?]\s+)([a-zà-ɏ])/g, (m, p, c) => p + c.toUpperCase());
  return t;
}

// ─── Residu Inggris ──────────────────────────────────────────────────────────
// Kata Indonesia umum + serapan. Kata Latin di luar daftar ini, yang MUNCUL
// JUGA di teks sumber, dianggap residu ( mesin gagal menerjemahkan ).
const ID_WORDS = new Set((
  'yang ini itu dan atau tapi tidak aku kamu dia mereka kita kami kalian nya dengan untuk dari akan bisa sudah sedang lagi udah belum nggak ga gak banget sih dong deh kok ya kah lah pak bu mas kak dik non tuan nyonya nama dunia malam siang pagi hari tahun bulan pekan jam menit detik sekarang nanti tadi selalu pernah benar salah baik bagus buruk jelek besar kecil tinggi rendah cantik tampan kuat lemah pergi datang lihat dengar bicara kata bilang tanya jawab makan minum tidur bangun jalan lari tangan kaki mata muka rambut kepala mulut gigi hati darah tulang kulit daging baju celana sepatu topi rumah sekolah kota desa istana ruangan pintu jendela meja kursi lantai dinding langit bumi air api tanah angin hujan salju panas dingin gelap terang merah biru hijau kuning hitam putih abu-abu emas perak uang waktu baru lama tua muda anak orang satu dua tiga empat lima enam tujuh delapan sembilan sepuluh puluh ratus ribu juta saya anda apakah kenapa bagaimana kapan siapa mana sini sana semua banyak sedikit punya ada juga seperti antara tentang supaya agar karena kalau jika maka atas bawah depan belakang kiri kanan dalam luar sama lain setiap paling lebih sangat terlalu hampir masih cuma hanya bahkan justru berarti masalah cara hal eh hai hei halo astaga aduh oh wow oke silakan tentu saja mungkin pemilik keluarga warna mata kancing manset penampilan bab'
).split(/\s+/).filter(Boolean));

// Frasa umum webtoon yang MT sering biarkan utuh.
const FRASES = [
  [/\bno way\b/gi, 'nggak mungkin'], [/\bwhat the\b/gi, 'apa-apaan'],
  [/\boh my\b/gi, 'astaga'], [/\bdamn\b/gi, 'sial'], [/\bhell\b/gi, 'sialan'],
  [/\breally\b/gi, 'beneran'], [/\bcome on\b/gi, 'ayo'], [/\bshut up\b/gi, 'diam'],
  [/\bsay it\b/gi, 'bilang'], [/\bsay out it\b/gi, 'ucapkan'],
  [/\bcourse\b/gi, 'tentu'], [/\bbecause\b/gi, 'karena'], [/\bproblem\b/gi, 'masalah'],
  [/\bowner\b/gi, 'pemilik'], [/\bfamily\b/gi, 'keluarga'], [/\bchapter\b/gi, 'bab'],
  [/\bdon'?t\b/gi, 'nggak'], [/\bdont\b/gi, 'nggak'], [/\bdoesn'?t\b/gi, 'nggak'],
  [/\bcan'?t\b/gi, 'nggak bisa'], [/\bcant\b/gi, 'nggak bisa'],
  [/\bwon'?t\b/gi, 'nggak akan'], [/\bwont\b/gi, 'nggak akan'],
  [/\bi'?m\b/gi, 'aku'], [/\bi'?ve\b/gi, 'aku sudah'],
  [/\bthey'?re\b/gi, 'mereka'], [/\byou'?re\b/gi, 'kamu'], [/\bwe'?re\b/gi, 'kita'],
  [/\bit'?s\b/gi, 'itu'], [/\bthat'?s\b/gi, 'itu'], [/\bhe'?s\b/gi, 'dia'], [/\bshe'?s\b/gi, 'dia'],
  [/\bwould\b/gi, 'akan'], [/\bcould\b/gi, 'bisa'], [/\bshould\b/gi, 'harusnya'],
  [/\bthe\b/gi, ''], [/\bof\b/gi, ''], [/\band\b/gi, 'dan'], [/\bwith\b/gi, 'sama'],
  [/\bgo(es)?\s+well\s+with\b/gi, 'cocok dengan'], [/\bgo(es)?\s+(well|baik)\b/gi, 'cocok'], [/\bcolor\b/gi, 'warna'],
  [/\beyes?\b/gi, 'mata'], [/\bwell\b/gi, 'baik'], [/\bnot\b/gi, 'nggak'],
  [/\bare\b/gi, ''], [/\bis\b/gi, ''], [/\bwere\b/gi, ''],
  [/\ba\b/gi, ''], [/\ban\b/gi, ''],
  [/\bfor\b/gi, 'buat'], [/\bout\b/gi, 'keluar'], [/\bget\b/gi, 'dapat'],
  [/\bpretty\b/gi, 'cukup'], [/\bmuch\b/gi, 'banget'],
];

function applyFrases(text) {
  let t = String(text || '');
  for (const [re, rep] of FRASES) t = t.replace(re, rep);
  return tidy(t);
}

// Kata residu = kata Latin di hasil terjemah yang JUGA ada di teks sumber OCR
// (harfiah tidak diterjemahkan). Kata Indonesia keluaran mesin ("mungkin",
// "pemilik") tidak pernah di-query ulang -> tidak terkorupsi MyMemory ("Pemilk").
function residueWords(translated, source) {
  const t = applyFrases(translated);
  const src = new Set(((source || '').match(/[A-Za-z][A-Za-z']{2,}/g) || []).map((w) => w.toLowerCase()));
  return [...new Set((t.match(/[A-Za-z][A-Za-z']{2,}/g) || [])
    .filter((w) => src.has(w.toLowerCase()) && !ID_WORDS.has(w.toLowerCase())))];
}

// Substitusi akhir: kamus frasa + peta kata (hasil batch MT). Hanya ganti kata
// yg padanannya satu kata dan beda dari sumber; jaga kapital (SFX EMAS!).
function polishMap(text, wordMap) {
  let t = applyFrases(text);
  const shouty = t === t.toUpperCase() && /[A-Z]/.test(t);
  for (const [w, rep] of Object.entries(wordMap)) {
    if (!rep || /\s/.test(rep) || rep.toLowerCase() === w.toLowerCase()) continue;
    const r2 = shouty ? rep.toUpperCase() : rep;
    t = t.replace(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi'), r2);
  }
  return tidy(t);
}

module.exports = { casualize, tidy, residueWords, polishMap };
