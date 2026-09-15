# 📖 AKIRAREADS v3

Platform baca manhwa / manga / manhua dengan **AI auto-translate built-in**:
teks asing di gambar dikenali, dihapus (inpaint), diterjemahkan, lalu ditulis
ulang ke dalam balonnya — hasil akhirnya tetap satu gambar, siap baca bahasa
Indonesia tanpa aplikasi translator.

Arsitektur v3 (rebuild total dari v2.4):

```
┌───────────────────────────┐      ┌──────────────────────────────┐
│  web/  Next.js 14         │      │  worker/  Node.js (Railway)  │
│  (Vercel)                 │      │                              │
│  • UI publik + admin      │      │  • Mirror scraper (MangaDex, │
│  • API route handlers     │      │    Madara, komiku, dll)      │
│  • Enqueue job → DB       │      │  • Pipeline AI translate     │
└────────────┬──────────────┘      │    OCR+MT (Gemini/GPT/Groq)  │
             │                     │  • Serve hasil /t/*.webp     │
             ▼                     │  • Backup DB → Google Drive  │
        Postgres (Neon / Railway) ◄┘  (polling job, tanpa API     │
                                      antar-service)              │
```

Kedua proses berbagi **satu database Postgres**. Web hanya menulis job
(`MirrorJob`, `TranslateJob` berstatus `PENDING`); worker mem-poll, mengerjakan
pekerjaan berat (scraper + AI), dan menulis hasilnya (`Page.translatedUrl`).
Reader di browser tinggal menyalakan toggle **🇮🇩 AI Translate**.

---

## ✨ Fitur

- **Auto-translate manhwa satu klik** — per chapter atau satu seri penuh.
  Pipeline: Vision-LLM deteksi balon + OCR + terjemah sekaligus → hapus teks
  asli (inpaint warna balon) → render teks Indonesia dengan auto-fit font.
- **Cache pintar** — halaman identik (repost/rerun) tidak di-OCR dua kali
  (hash gambar + hash daftar URL chapter).
- **Mirror otomatis** — tempel URL MangaDex → semua chapter + halaman ter-import
  (fix bug 100 chapter v2: paginasi 500/request, prioritas bahasa id→en, dedup).
- **Browser Import** — untuk situs anti-bot Cloudflare (ikiru, shinigami, dll):
  admin generate script, jalankan di Console browsermu, data mengalir ke server.
  (Alur yang sama: worker men-download halaman via MangaDex at-home CDN.)
- **Reader portabel** — mode vertikal/single, keyboard nav, atur lebar & zoom,
  bookmark, riwayat baca, komentar.
- **Admin tersembunyi** — `/api/admin/*`, `/api/mirror/*`, dll membalas **404**
  (bukan 401) tanpa `X-Admin-Key` / JWT admin.
- **Backup Google Drive otomatis** — dump DB tiap hari (cron), retensi 7 versi.

## 🤖 Provider AI (pilih salah satu, gratis/murah)

| Provider  | Model          | Gratis?                     |
|-----------|----------------|-----------------------------|
| Gemini    | gemini-2.0-flash | ✅ ya (AI Studio, rate limit longgar) — **direkomendasikan** |
| Groq      | llama-4 vision | ✅ ya (free tier)           |
| OpenAI    | gpt-4o-mini    | ❌ bayar (~$0.6/1K gambar)  |

Chain fallback: `TRANSLATE_PROVIDER=auto` → Gemini → OpenAI → Groq.

## 🚀 Deploy

### 1. Database (sekali saja)

Railway: tambah **Postgres** → copy `DATABASE_URL` (internal), ATAU Neon free
plan (URL `?sslmode=require`). URL yang sama dipakai web & worker.

### 2. Worker di Railway

1. Repo ini → Railway project baru → **Deploy from GitHub**, set
   **Root Directory = `worker`**.
2. Variables:

   ```
   DATABASE_URL   = postgres://...        # sama dengan web
   ADMIN_API_KEY  = <kunci acak>
   WORKER_URL     = https://<worker>.up.railway.app   # boleh kosong dulu, isi setelah URL jadi
   GEMINI_API_KEY = <isi minimal 1 provider>
   AUTO_TRANSLATE = 1
   BACKUP_CRON    = 0 3 * * *             # opsional
   GOOGLE_SA_JSON / GDRIVE_FOLDER_ID      # opsional (lihat §Backup)
   ```
3. Public Networking → domain `https://…up.railway.app`. Health check `/health`.

### 3. Web di Vercel

1. Import repo → **Root Directory = `web`**, framework Next.js terdeteksi.
2. Environment Variables:

   ```
   DATABASE_URL       = postgres://...    # URL yang sama
   JWT_SECRET         = <string panjang acak>
   ADMIN_API_KEY      = <sama persis dengan worker>
   NEXT_PUBLIC_ADMIN_KEY = <sama juga>
   ADMIN_EMAIL        = email@kamu.com
   ADMIN_PASSWORD     = <password admin awal>
   WORKER_URL         = https://<worker>.up.railway.app
   ```
3. Deploy. Seed admin (dari mana saja yang punya akses DB + node):

   ```bash
   npm install
   npx prisma db push --schema=prisma/schema.prisma
   ADMIN_EMAIL=... ADMIN_PASSWORD=... node prisma/seed.js
   ```
   (Atau login pertama: halaman `/admin/login` akan otomatis membuat akun ADMIN
   dari `ADMIN_EMAIL`/`ADMIN_PASSWORD` jika belum ada.)

### 4. Alur pakai

1. Buka `https://<vercel>/admin` → login admin.
2. **Mirror** → tempel URL MangaDex → Import → worker mengerjakan (progress live).
3. Selesai mirror, buka **Terjemahan** → pilih seri → *Translate chapter* atau
   *Translate semua* — worker OCR + terjemah per halaman.
4. Reader: buka chapter → toggle **🇮🇩 AI Translate**. Selesai.

## 💾 Backup Google Drive

1. Buat **Service Account** di Google Cloud → key JSON → aktifkan **Drive API**.
2. Share folder Drive pilihanmu ke email service account (`Editor`).
3. `GDRIVE_FOLDER_ID` = ID folder (segmen URL `/folders/<ID>`);
   `GOOGLE_SA_JSON` = base64 file JSON key (aman untuk env var).
4. Cron `BACKUP_CRON` (default jam 3 pagi) menyimpan dump JSON.gz, simpan 7
   terakhir. Manual: `POST <worker>/admin/backup` dengan header `X-Admin-Key`.

## 🧪 Development lokal

```bash
cp .env.example .env                       # isi DATABASE_URL (Neon dev) dsb.
npm install                                # generate prisma client
npx prisma db push

cd web && npm install && npm run dev       # http://localhost:3000
cd ../worker && npm install && npm start   # http://localhost:8080  (PORT env)
# env worker: WORKER_URL=http://localhost:8080 AUTO_TRANSLATE=1
```

## 📁 Struktur

```
akira-reads/
├── prisma/          schema (shared) + seed admin
├── web/             Next.js 14 — app/, components/, lib/, context/  (Vercel, root=web)
└── worker/          Express + job loop — mirror/, translate/, backup.js  (Railway, root=worker)
```

## ❓ Troubleshooting

- **Job tidak jalan** → cek log Railway worker (`[loop] siap`), `DATABASE_URL`
  worker & web harus sama, `WORKER_URL` sudah diisi agar tombol gambar hasil valid.
- **Translate gagal semua** → `GEMINI_API_KEY`/provider belum diisi (pesan error
  job menyebutkannya).
- **Gambar hasil 404** → `WORKER_URL` di web berbeda dari URL publik worker.
- **Mirror 403 Cloudflare** → gunakan tab **Browser Import** (sama seperti v2).
