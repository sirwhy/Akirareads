# 📖 AKIRAREADS v2.4

Platform baca manhwa, manga, manhua — dengan mirror otomatis, admin panel tersembunyi.

---

## 🔧 Fix di v2.4

### ✅ MangaDex: Fix 100 Chapter Bug
**Penyebab:** Kode lama pakai `limit: 100` (max MangaDex adalah 500) dan tidak ada filter bahasa → dapat chapter dari semua bahasa → duplikat → gagal insert → hanya 100 tersimpan.

**Fix yang dilakukan:**
- Limit dinaikkan ke **500 per request** (max yang diizinkan MangaDex)
- Filter bahasa: prioritas **Bahasa Indonesia** dulu, lalu **English**, lalu semua bahasa
- Deduplication berdasarkan nomor chapter (pilih bahasa terbaik)
- Retry otomatis saat rate-limit (HTTP 429)
- Progress update setiap 10 chapter

### ✅ ikiru.id & shinigami.asia: Browser Import
**Penyebab:** Kedua situs pakai Cloudflare anti-bot. CF cookies dari HAR tidak bisa dipakai di server lain karena terikat ke IP + TLS fingerprint browser.

**Solusi: Browser Import** — kamu buka situs di browser sendiri (CF sudah lolos), jalankan script di Console, data otomatis terkirim ke server.

---

## 🚀 Deploy Railway

### Variables Backend
```
DATABASE_URL=postgresql://...
JWT_SECRET=string-random-panjang
PORT=5000
NODE_ENV=production
SERVER_URL=https://[backend].up.railway.app
CLIENT_URL=https://[frontend].up.railway.app
ADMIN_EMAIL=email@kamu.com
ADMIN_PASSWORD=PasswordKamu
ADMIN_API_KEY=kunci-rahasia-admin
```

### Variables Frontend
```
REACT_APP_API_URL=https://[backend].up.railway.app/api
REACT_APP_ADMIN_KEY=kunci-rahasia-admin
```

---

## 📚 Cara Mirror Manga

### MangaDex (Otomatis penuh)
1. Buka mangadex.org → cari judul
2. Salin URL: `https://mangadex.org/title/UUID/...`
3. Admin → Mirror → paste → **Import**
4. Semua chapter + halaman diimport otomatis ✅

### ikiru.id / shinigami.asia (Browser Import)
1. Admin → Mirror → tab **"Browser Import"**
2. Pilih website (ikiru atau shinigami)
3. Klik **"Generate Script"**
4. Buka halaman series di browser kamu
5. Tekan **F12** → tab **Console**
6. **Copy-paste script** → tekan Enter
7. Tunggu alert "✅ Berhasil dikirim!"
8. Kembali ke admin panel → lihat hasilnya

### komiku.id / Madara sites lain
- Sama seperti Single URL import
- Berhasil jika Cloudflare tidak aktif di waktu itu
- Jika gagal 403: gunakan Browser Import yang sama

---

## 🔒 Admin Panel Tersembunyi
- `/api/admin/*` return **404** tanpa token (bukan 401)
- **ADMIN_API_KEY** wajib sama di backend dan frontend
- Tidak ada link ke `/admin` di website publik

---

## 🔑 Reset Password Admin Darurat
Set `RESET_ADMIN_KEY=kunci123` di Railway backend, lalu:
```bash
curl -X POST https://[backend]/api/auth/reset-admin \
  -H "Content-Type: application/json" \
  -d '{"key":"kunci123","password":"PasswordBaru"}'
```
