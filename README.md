# 🤖 Discord Digital Store Bot

Bot Discord untuk **menjual produk digital** (key/lisensi) dan menerima **donasi** via QRIS Midtrans.  
Dibangun dengan **Discord Interactions API (HTTP Webhooks)** dan di-deploy ke **Vercel Hobby Plan** (serverless).

---

## 📋 Daftar Isi

1. [Fitur](#-fitur)
2. [Arsitektur](#-arsitektur)
3. [Struktur Folder](#-struktur-folder)
4. [Setup Discord Developer Portal](#-step-1-setup-discord-developer-portal)
5. [Setup Midtrans](#-step-2-setup-midtrans)
6. [Setup Supabase](#-step-3-setup-supabase-database)
7. [Deploy ke Vercel](#-step-4-deploy-ke-vercel)
8. [Konfigurasi Environment Variables](#-step-5-konfigurasi-environment-variables)
9. [Daftarkan Slash Commands](#-step-6-daftarkan-slash-commands)
10. [Konfigurasi Midtrans Webhook](#-step-7-konfigurasi-midtrans-webhook)
11. [Daftar Slash Commands](#-daftar-slash-commands)
12. [Troubleshooting](#-troubleshooting)

---

## ✨ Fitur

| Fitur | Keterangan |
|---|---|
| 🛒 `/beli` | User membeli produk, mendapat QRIS untuk pembayaran |
| ❤️ `/donasi` | Donasi via QRIS dalam nominal bebas |
| ➕ `/add-product` | Admin menambah produk baru |
| 🗑️ `/del-product` | Admin menghapus produk |
| 📦 `/add-stock` | Admin menambah stok key/lisensi |
| ❌ `/del-stock` | Admin menghapus stok tertentu |
| 🔄 `/reset-stock` | Admin mengosongkan semua stok produk |
| 📬 Auto-deliver | Key dikirim otomatis ke DM user setelah bayar |
| 🔒 Secure | Verifikasi Ed25519 dari Discord + verifikasi server-side Midtrans |

---

## 🏗️ Arsitektur

```
User Discord
    │
    │ Slash Command (/beli, /donasi, dll)
    ▼
Discord Servers
    │
    │ HTTP POST (terverifikasi Ed25519)
    ▼
Vercel Function: /api/interactions.js
    │
    ├── Validasi request Discord
    ├── Routing ke handler command
    ├── Generate QRIS via Midtrans API
    ├── Simpan transaksi ke Supabase
    └── Kirim embed QRIS ke Discord
    
User membayar QRIS
    │
Midtrans Gateway
    │
    │ HTTP POST Payment Notification
    ▼
Vercel Function: /api/midtrans-webhook.js
    │
    ├── Verifikasi notifikasi Midtrans
    ├── Ambil key dari Supabase (claim stock)
    ├── Kirim key via Discord DM ke user
    └── Update status transaksi di Supabase
```

---

## 📁 Struktur Folder

```
discord-bot/
├── api/
│   ├── interactions.js        ← Endpoint Discord Interactions (wajib)
│   └── midtrans-webhook.js    ← Endpoint Payment Notification Midtrans
│
├── lib/
│   ├── discord-verify.js      ← Verifikasi Ed25519 signature Discord
│   ├── discord-api.js         ← Helper kirim DM & pesan channel
│   ├── supabase.js            ← Semua operasi database
│   ├── midtrans.js            ← Integrasi Midtrans Core API
│   ├── utils.js               ← Utility functions
│   └── commands/
│       ├── beli.js            ← Handler /beli
│       ├── donasi.js          ← Handler /donasi
│       └── admin.js           ← Handler commands admin
│
├── scripts/
│   └── register-commands.js   ← Script daftar slash commands ke Discord
│
├── supabase-schema.sql        ← SQL untuk setup database
├── vercel.json                ← Konfigurasi Vercel
├── package.json
├── .env.example
└── README.md
```

---

## 🔧 Step 1: Setup Discord Developer Portal

### 1.1 Buat Aplikasi Discord Baru

1. Buka [https://discord.com/developers/applications](https://discord.com/developers/applications)
2. Klik **"New Application"**
3. Beri nama bot kamu (contoh: `Digital Store Bot`)
4. Klik **"Create"**

### 1.2 Dapatkan Application ID & Public Key

1. Di halaman **General Information**:
   - Copy **Application ID** → simpan sebagai `DISCORD_APPLICATION_ID`
   - Copy **Public Key** → simpan sebagai `DISCORD_PUBLIC_KEY`

### 1.3 Buat Bot & Dapatkan Token

1. Di sidebar kiri, klik **"Bot"**
2. Klik **"Add Bot"** → konfirmasi
3. Di bagian **Token**, klik **"Reset Token"** → konfirmasi
4. Copy token yang muncul → simpan sebagai `DISCORD_BOT_TOKEN`
   > ⚠️ **PENTING:** Token hanya muncul sekali. Jangan share ke siapapun!
5. Di bagian **Privileged Gateway Intents**, aktifkan:
   - ✅ **Server Members Intent** (untuk membaca role user)
   - ✅ **Message Content Intent**

### 1.4 Undang Bot ke Server Discord

1. Di sidebar, klik **"OAuth2"** → **"URL Generator"**
2. Centang scope:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Di bagian **Bot Permissions**, centang:
   - ✅ `Send Messages`
   - ✅ `Send Messages in Threads`
   - ✅ `Embed Links`
   - ✅ `Attach Files`
   - ✅ `Read Message History`
4. Copy URL yang dihasilkan, buka di browser, pilih server kamu, klik **"Authorize"**

### 1.5 Dapatkan Guild ID (Server ID) & Admin Role ID

**Guild ID:**
1. Buka Discord → klik kanan nama servermu → **"Copy Server ID"**
   > Jika tidak muncul, aktifkan Developer Mode: Settings → Advanced → Developer Mode

**Admin Role ID:**
1. Server Settings → Roles → klik kanan role admin → **"Copy Role ID"**

---

## 💳 Step 2: Setup Midtrans

### 2.1 Daftar Akun Midtrans

1. Buka [https://dashboard.midtrans.com](https://dashboard.midtrans.com)
2. Daftar dengan email bisnis / personal
3. Verifikasi email

### 2.2 Dapatkan API Keys

1. Login ke Midtrans Dashboard
2. Pastikan kamu berada di **Sandbox environment** (kanan atas — toggle Sandbox/Production)
3. Di sidebar: **Settings** → **Access Keys**
4. Copy:
   - **Server Key** → simpan sebagai `MIDTRANS_SERVER_KEY`
   - **Client Key** → simpan sebagai `MIDTRANS_CLIENT_KEY`

> 💡 **Sandbox vs Production:**
> - Sandbox: untuk testing (gunakan kartu test/QRIS test)
> - Production: untuk transaksi nyata (butuh verifikasi bisnis Midtrans)
> - Set `MIDTRANS_IS_PRODUCTION=false` saat development

### 2.3 Aktifkan QRIS (Production)

Untuk mode Production, aktifkan QRIS di:
Settings → Payment Methods → QRIS → Aktifkan

---

## 🗄️ Step 3: Setup Supabase Database

### 3.1 Buat Project Supabase

1. Buka [https://supabase.com](https://supabase.com) → Sign up / Login
2. Klik **"New project"**
3. Isi:
   - **Name:** `discord-store-bot` (bebas)
   - **Database Password:** buat password yang kuat, simpan!
   - **Region:** pilih yang terdekat (Southeast Asia / Singapore)
4. Klik **"Create new project"** — tunggu ~2 menit

### 3.2 Jalankan SQL Schema

1. Di Supabase Dashboard, klik **"SQL Editor"** di sidebar
2. Klik **"New query"**
3. Copy isi file `supabase-schema.sql` dari repo ini
4. Paste ke editor, klik **"Run"** (atau Ctrl+Enter)
5. Pastikan semua tabel berhasil dibuat (cek di **Table Editor**)

### 3.3 Dapatkan Credentials Supabase

1. Di sidebar: **Project Settings** (ikon gear) → **API**
2. Copy:
   - **Project URL** → simpan sebagai `SUPABASE_URL`
   - **`service_role` key** (di bawah "Project API keys") → simpan sebagai `SUPABASE_SERVICE_ROLE_KEY`
   > ⚠️ Gunakan `service_role` key (bukan `anon` key) karena kita butuh akses penuh di server

---

## 🚀 Step 4: Deploy ke Vercel

### 4.1 Push ke GitHub

```bash
# Di folder proyek
git init
git add .
git commit -m "Initial commit: Discord Digital Store Bot"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO-NAME.git
git push -u origin main
```

### 4.2 Deploy via Vercel Dashboard

1. Buka [https://vercel.com](https://vercel.com) → Login dengan GitHub
2. Klik **"New Project"**
3. Import repository GitHub yang baru kamu buat
4. Di halaman konfigurasi:
   - **Framework Preset:** Other
   - **Root Directory:** `.` (biarkan default)
   - Klik **"Deploy"**
5. Tunggu deployment selesai (~1-2 menit)
6. Catat URL deployment kamu, contoh: `https://discord-store-bot.vercel.app`

> 💡 Alternatif: Deploy via CLI
> ```bash
> npm i -g vercel
> vercel login
> vercel --prod
> ```

---

## ⚙️ Step 5: Konfigurasi Environment Variables

### Via Vercel Dashboard

1. Buka proyek di [Vercel Dashboard](https://vercel.com/dashboard)
2. **Settings** → **Environment Variables**
3. Tambahkan semua variabel berikut (pilih environment: **Production**, **Preview**, **Development**):

| Variable | Nilai | Keterangan |
|---|---|---|
| `DISCORD_APPLICATION_ID` | `123456...` | Dari Discord Developer Portal |
| `DISCORD_PUBLIC_KEY` | `abcdef...` | Dari Discord Developer Portal |
| `DISCORD_BOT_TOKEN` | `Bot.Token...` | Dari Discord Bot settings |
| `DISCORD_GUILD_ID` | `123456...` | ID server Discord (opsional) |
| `DISCORD_ADMIN_ROLE_ID` | `123456...` | Role ID admin (opsional) |
| `DISCORD_ADMIN_USER_ID` | `123456...` | User ID admin (opsional) |
| `MIDTRANS_SERVER_KEY` | `SB-Mid-server-...` | Dari Midtrans Dashboard |
| `MIDTRANS_CLIENT_KEY` | `SB-Mid-client-...` | Dari Midtrans Dashboard |
| `MIDTRANS_IS_PRODUCTION` | `false` | Ganti `true` saat go-live |
| `SUPABASE_URL` | `https://xxx.supabase.co` | Dari Supabase Project Settings |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` | Service role key Supabase |

4. Setelah menambahkan semua variabel, klik **"Redeploy"** agar environment variables aktif

### Untuk Development Lokal

Buat file `.env.local` di root folder:
```bash
cp .env.example .env.local
# Edit .env.local dan isi semua nilai
```

---

## 📡 Step 6: Daftarkan Slash Commands

### 6.1 Setup Environment Lokal

```bash
npm install
cp .env.example .env.local
# Edit .env.local dan isi nilai yang diperlukan
```

### 6.2 Jalankan Script Registrasi

```bash
node scripts/register-commands.js
```

Output yang diharapkan:
```
🚀 Mendaftarkan 7 slash commands ke Discord...
📍 Endpoint: Guild 123456789012345678
⚠️  Global commands membutuhkan ~1 jam untuk aktif.

✅ Berhasil! 7 commands terdaftar:

  • /beli (ID: 1234567890123456789)
  • /donasi (ID: 1234567890123456789)
  • /add-product (ID: 1234567890123456789)
  • /del-product (ID: 1234567890123456789)
  • /add-stock (ID: 1234567890123456789)
  • /del-stock (ID: 1234567890123456789)
  • /reset-stock (ID: 1234567890123456789)

🎉 Slash commands siap digunakan!
```

> 💡 **Tips:** Isi `DISCORD_GUILD_ID` di `.env.local` untuk mendaftarkan command ke server tertentu (update instan). Kosongkan untuk global (tunggu ~1 jam).

---

## 🔗 Step 7: Konfigurasi Discord Interactions Endpoint

1. Buka [Discord Developer Portal](https://discord.com/developers/applications)
2. Pilih aplikasimu
3. Di sidebar: **General Information**
4. Di bagian **"Interactions Endpoint URL"**, masukkan:
   ```
   https://discord-store-bot.vercel.app/api/interactions
   ```
   (Ganti dengan URL Vercel deployment kamu)
5. Klik **"Save Changes"**

Discord akan melakukan PING verification ke URL kamu. Jika berhasil tersimpan, endpoint kamu berfungsi dengan benar ✅

---

## 🔗 Step 8: Konfigurasi Midtrans Webhook

1. Login ke [Midtrans Dashboard](https://dashboard.midtrans.com)
2. **Settings** → **Configuration**
3. Di bagian **"Payment Notification URL"**, masukkan:
   ```
   https://discord-store-bot.vercel.app/api/midtrans-webhook
   ```
4. Di bagian **"Finish Redirect URL"** (opsional):
   ```
   https://discord.com/channels/GUILD_ID/CHANNEL_ID
   ```
5. Klik **"Save"**

---

## 📝 Daftar Slash Commands

### User Commands

| Command | Parameter | Keterangan |
|---|---|---|
| `/beli` | `nama_produk` (wajib) | Membeli produk digital via QRIS |
| `/donasi` | `nominal` (wajib, min. 1000) | Berdonasi via QRIS |

### Admin Commands

| Command | Parameter | Keterangan |
|---|---|---|
| `/add-product` | `nama`, `harga`, `deskripsi` (opsional) | Tambah produk baru |
| `/del-product` | `nama` | Hapus produk beserta stoknya |
| `/add-stock` | `nama_produk`, `key` | Tambah key/lisensi ke produk |
| `/del-stock` | `nama_produk`, `id_stok` | Hapus stok tertentu |
| `/reset-stock` | `nama_produk` | Kosongkan semua stok |

### Contoh Penggunaan Admin

```
# Tambah produk baru
/add-product nama:Netflix Premium harga:45000 deskripsi:Akun Netflix shared 1 bulan

# Tambah stok (key)
/add-stock nama_produk:Netflix Premium key:XXXX-YYYY-ZZZZ-WWWW

# Tambah banyak key satu per satu
/add-stock nama_produk:Netflix Premium key:AAAA-BBBB-CCCC-1111
/add-stock nama_produk:Netflix Premium key:AAAA-BBBB-CCCC-2222

# User membeli
/beli nama_produk:Netflix Premium
→ Bot mengirim embed dengan QRIS Midtrans
→ User scan & bayar
→ Bot otomatis kirim key via DM ✅
```

---

## 🧪 Testing di Sandbox Midtrans

Untuk test pembayaran QRIS di sandbox:

1. Download aplikasi **Midtrans Simulator** atau gunakan:
   [https://simulator.sandbox.midtrans.com/qris/index](https://simulator.sandbox.midtrans.com/qris/index)
2. Scan QR code yang dihasilkan bot
3. Simulasikan pembayaran sukses
4. Midtrans akan mengirim webhook ke URL kamu
5. Bot akan mengirim key ke DM user ✅

---

## 🔍 Troubleshooting

### ❌ "Invalid request signature" dari Discord

**Penyebab:** `DISCORD_PUBLIC_KEY` salah atau request tidak dari Discord.

**Solusi:**
- Pastikan `DISCORD_PUBLIC_KEY` di Vercel Environment Variables sudah benar
- Setelah update env var, lakukan **Redeploy**
- Jangan ada spasi di awal/akhir nilai

### ❌ Bot tidak merespons command

**Kemungkinan penyebab:**
1. Slash commands belum didaftarkan → jalankan `node scripts/register-commands.js`
2. Interactions Endpoint URL salah di Discord Developer Portal
3. Vercel function error → cek Logs di Vercel Dashboard
4. Environment variables belum di-set atau salah → cek ulang

### ❌ QRIS tidak muncul / error Midtrans

**Kemungkinan penyebab:**
1. `MIDTRANS_SERVER_KEY` salah
2. QRIS belum diaktifkan di Midtrans Dashboard
3. Mode production diset tapi pakai server key sandbox (atau sebaliknya)

**Debug:**
- Cek Vercel Function Logs untuk error detail
- Test API Midtrans langsung via Postman/curl

### ❌ Key tidak terkirim setelah bayar

**Kemungkinan penyebab:**
1. Midtrans Webhook URL salah → cek di Settings → Configuration
2. `DISCORD_BOT_TOKEN` salah atau bot tidak di server
3. User memblokir DM dari bot / DM dinonaktifkan → minta user enable DM
4. Stok habis → tambah stok dengan `/add-stock`

**Debug:**
- Cek Midtrans Dashboard → Transactions → lihat apakah webhook terkirim
- Cek Vercel Function Logs untuk error di `midtrans-webhook.js`

### ❌ Database error (Supabase)

1. Pastikan schema sudah dijalankan (tabel `products`, `stocks`, `transactions` ada)
2. Pastikan `SUPABASE_SERVICE_ROLE_KEY` benar (bukan `anon` key)
3. Cek apakah project Supabase aktif (tidak di-pause karena inaktif)

---

## 📊 Monitoring

- **Vercel Logs:** Vercel Dashboard → Project → **Functions** tab → klik function untuk lihat log
- **Supabase:** Dashboard → Table Editor untuk lihat data transaksi
- **Midtrans:** Dashboard → Transactions untuk lihat status pembayaran

---

## 🛡️ Security Notes

1. **Jangan pernah commit** file `.env.local` atau token ke GitHub
2. `DISCORD_PUBLIC_KEY` digunakan untuk verifikasi Ed25519 — tanpa ini bot bisa di-spoof
3. Midtrans webhook diverifikasi ulang ke server Midtrans untuk mencegah notifikasi palsu
4. `SUPABASE_SERVICE_ROLE_KEY` memberikan akses penuh ke database — jaga baik-baik
5. Key produk hanya dikirim via Discord DM (bukan di channel publik)

---

## 📄 License

MIT — Bebas digunakan dan dimodifikasi.

---

*Dibuat dengan ❤️ untuk komunitas Discord Indonesia*
