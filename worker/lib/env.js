// Env dibaca saat-panggilan (bukan saat-load) supaya konfigurasi bisa
// diganti tanpa restart proses (Railway env update -> cukup reload job).
module.exports = function env(name, def) {
  const v = process.env[name];
  return v === undefined || v === '' ? def : v;
};
