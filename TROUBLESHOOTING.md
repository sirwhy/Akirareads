# 🔧 Troubleshooting Akira Reader

## ❌ "Failed to fetch" saat Login/Register

Ini adalah masalah paling umum. Penyebabnya:

### Penyebab 1: CLIENT_URL pakai trailing slash
Di Railway backend Variables, jika kamu isi:
```
CLIENT_URL = https://akirareads-production.up.railway.app/   ← ADA SLASH DI AKHIR ❌
```
Ganti jadi:
```
CLIENT_URL = https://akirareads-production.up.railway.app    ← TANPA SLASH ✅
```

### Penyebab 2: REACT_APP_API_URL salah
Di Railway frontend (Akirareads) Variables:
```
REACT_APP_API_URL = https://backend-production-8a0d4.up.railway.app/api
```
Pastikan URL-nya mengarah ke service BACKEND yang benar, bukan frontend.
Test di browser: buka `https://[backend-url]/api/health` → harus muncul `{"status":"OK"}`

### Penyebab 3: Backend belum selesai deploy
Cek di Railway → service BACKEND → tab Deployments → pastikan status ✅ (hijau)

---

## ❌ Admin login gagal / "Admin sudah ada"

### Solusi: Reset password admin via Railway

**Cara paling mudah:**

1. Di Railway → service **BACKEND** → tab **Variables**
2. Tambahkan variable baru:
   ```
   RESET_ADMIN_KEY = kunci123
   ```
3. Tunggu redeploy otomatis
4. Jalankan curl ini:
   ```bash
   curl -X POST https://[backend-url]/api/auth/reset-admin \
     -H "Content-Type: application/json" \
     -d '{"key":"kunci123","password":"PasswordBaru123"}'
   ```
5. Sekarang login admin dengan:
   - Email: `axisgenkelima5@gmail.com` (sesuai ADMIN_EMAIL di env)
   - Password: `PasswordBaru123`
6. Setelah berhasil, hapus `RESET_ADMIN_KEY` dari Variables

---

## ❌ Register user gagal

Cek apakah backend bisa diakses:
```bash
curl https://[backend-url]/api/health
```
Harus muncul: `{"status":"OK","message":"Akira Reader API is running",...}`

Jika tidak muncul → backend mati, cek Railway logs.

---

## ✅ Cara setup ulang admin dari nol

Jika semua gagal, ini cara paling pasti:

1. Di Railway → service **BACKEND** → Variables:
   ```
   ADMIN_EMAIL    = email-baru@gmail.com
   ADMIN_PASSWORD = PasswordBaru123
   ```
2. Klik **Redeploy** (atau push commit baru)
3. Saat deploy, seed.js akan **UPDATE password admin** otomatis
4. Login dengan email + password baru tersebut

> ⚠️ **Penting**: Seed sekarang pakai `upsert` — artinya setiap deploy akan **reset password admin** sesuai `ADMIN_PASSWORD` di env. Jadi pastikan isi yang benar!

---

## 📋 Checklist Railway Setup yang Benar

### Service BACKEND Variables:
| Nama | Contoh Nilai | Catatan |
|------|-------------|---------|
| `DATABASE_URL` | `postgresql://postgres:xxx@postgres.railway.internal:5432/railway` | Dari Postgres service |
| `JWT_SECRET` | `string-random-panjang-min-32-char` | Jangan sampai kosong! |
| `PORT` | `5000` | |
| `NODE_ENV` | `production` | |
| `CLIENT_URL` | `https://akirareads-production.up.railway.app` | **TANPA trailing slash!** |
| `ADMIN_EMAIL` | `axisgenkelima5@gmail.com` | Email admin kamu |
| `ADMIN_PASSWORD` | `Admin123` | Password admin |

### Service FRONTEND (Akirareads) Variables:
| Nama | Contoh Nilai |
|------|-------------|
| `REACT_APP_API_URL` | `https://backend-production-8a0d4.up.railway.app/api` |

---

## 🔍 Cara Cek Log Railway

1. Buka Railway → pilih service **BACKEND**
2. Tab **Deployments**
3. Klik deployment terbaru
4. Lihat **Build Logs** dan **Deploy Logs**
5. Cari pesan error atau "Admin siap: ..."

---

## 📞 Test API Manual

```bash
# 1. Cek health
curl https://[backend-url]/api/health

# 2. Register user baru
curl -X POST https://[backend-url]/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","username":"testuser","password":"test123"}'

# 3. Login user
curl -X POST https://[backend-url]/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# 4. Login admin
curl -X POST https://[backend-url]/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"axisgenkelima5@gmail.com","password":"Admin123"}'
```
