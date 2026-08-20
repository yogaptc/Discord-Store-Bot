/**
 * scripts/register-commands.js
 * ════════════════════════════════════════════════════════════════
 * Script untuk mendaftarkan semua slash commands ke Discord.
 * Jalankan sekali saja (atau setiap kali ada perubahan command):
 *
 *   node scripts/register-commands.js
 *
 * Pastikan file .env.local sudah ada dan terisi.
 * ════════════════════════════════════════════════════════════════
 */

require("dotenv").config({ path: ".env.local" });
const https = require("https");

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const APP_ID = process.env.DISCORD_APPLICATION_ID;
// Kosongkan GUILD_ID untuk global commands, isi untuk guild-specific (lebih cepat update)
const GUILD_ID = process.env.DISCORD_GUILD_ID || "";

if (!TOKEN || !APP_ID) {
  console.error("❌ DISCORD_BOT_TOKEN dan DISCORD_APPLICATION_ID harus diisi di .env.local");
  process.exit(1);
}

// ─────────────────────────────────────────────
// Definisi semua slash commands
// ─────────────────────────────────────────────
const commands = [
  // ── User Commands ──
  {
    name: "beli",
    description: "Beli produk digital menggunakan QRIS",
    options: [
      {
        name: "nama_produk",
        description: "Nama produk yang ingin dibeli",
        type: 3, // STRING
        required: true,
      },
    ],
  },
  {
    name: "donasi",
    description: "Berdonasi via QRIS",
    options: [
      {
        name: "nominal",
        description: "Nominal donasi dalam Rupiah (minimal Rp 1.000)",
        type: 4, // INTEGER
        required: true,
        min_value: 1000,
      },
    ],
  },

  // ── Admin Commands ──
  {
    name: "add-product",
    description: "[ADMIN] Tambah produk baru ke toko",
    default_member_permissions: "8", // ADMINISTRATOR permission
    options: [
      {
        name: "nama",
        description: "Nama produk",
        type: 3,
        required: true,
      },
      {
        name: "harga",
        description: "Harga dalam Rupiah",
        type: 4, // INTEGER
        required: true,
        min_value: 100,
      },
      {
        name: "deskripsi",
        description: "Deskripsi produk",
        type: 3,
        required: false,
      },
    ],
  },
  {
    name: "del-product",
    description: "[ADMIN] Hapus produk dari toko",
    default_member_permissions: "8",
    options: [
      {
        name: "nama",
        description: "Nama produk yang akan dihapus",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "add-stock",
    description: "[ADMIN] Tambah stok (key/lisensi) ke produk",
    default_member_permissions: "8",
    options: [
      {
        name: "nama_produk",
        description: "Nama produk",
        type: 3,
        required: true,
      },
      {
        name: "key",
        description: "Key atau lisensi yang akan ditambahkan",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "del-stock",
    description: "[ADMIN] Hapus stok tertentu dari produk",
    default_member_permissions: "8",
    options: [
      {
        name: "nama_produk",
        description: "Nama produk",
        type: 3,
        required: true,
      },
      {
        name: "id_stok",
        description: "ID stok yang akan dihapus (lihat dengan /list-stock)",
        type: 3,
        required: true,
      },
    ],
  },
  {
    name: "reset-stock",
    description: "[ADMIN] Kosongkan semua stok produk",
    default_member_permissions: "8",
    options: [
      {
        name: "nama_produk",
        description: "Nama produk",
        type: 3,
        required: true,
      },
    ],
  },
];

// ─────────────────────────────────────────────
// Kirim ke Discord API
// ─────────────────────────────────────────────
const url = GUILD_ID
  ? `/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`
  : `/api/v10/applications/${APP_ID}/commands`;

const body = JSON.stringify(commands);

const options = {
  hostname: "discord.com",
  path: url,
  method: "PUT", // PUT untuk replace semua commands sekaligus
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    Authorization: `Bot ${TOKEN}`,
  },
};

console.log(`\n🚀 Mendaftarkan ${commands.length} slash commands ke Discord...`);
console.log(`📍 Endpoint: ${GUILD_ID ? `Guild ${GUILD_ID}` : "Global"}`);
console.log(`⚠️  Global commands membutuhkan ~1 jam untuk aktif.\n`);

const req = https.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      const parsed = JSON.parse(data);
      console.log(`✅ Berhasil! ${parsed.length} commands terdaftar:\n`);
      parsed.forEach((cmd) => console.log(`  • /${cmd.name} (ID: ${cmd.id})`));
      console.log("\n🎉 Slash commands siap digunakan!");
    } else {
      console.error(`❌ Gagal mendaftarkan commands. Status: ${res.statusCode}`);
      console.error(data);
    }
  });
});

req.on("error", (err) => {
  console.error("❌ Network error:", err.message);
});

req.write(body);
req.end();
