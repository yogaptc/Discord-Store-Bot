/**
 * lib/commands/admin.js
 * Handler untuk semua slash command admin:
 * /add-product, /del-product, /add-stock, /del-stock, /reset-stock
 */

const {
  addProduct,
  deleteProduct,
  getProductByName,
  addStock,
  getStocksByProduct,
  deleteStock,
  resetStock,
} = require("../supabase");

// ─────────────────────────────────────────────
// Cek apakah user adalah admin
// ─────────────────────────────────────────────
function isAdmin(interaction) {
  // Cek berdasarkan Role ID admin yang ada di env
  const adminRoleId = process.env.DISCORD_ADMIN_ROLE_ID;
  const adminUserId = process.env.DISCORD_ADMIN_USER_ID;

  const userId = interaction.member?.user?.id || interaction.user?.id;
  const roles = interaction.member?.roles || [];

  if (adminUserId && userId === adminUserId) return true;
  if (adminRoleId && roles.includes(adminRoleId)) return true;

  // Fallback: cek permission ADMINISTRATOR (bit 0x8)
  const permissions = BigInt(interaction.member?.permissions || "0");
  if ((permissions & BigInt(0x8)) !== BigInt(0)) return true;

  return false;
}

// ─────────────────────────────────────────────
// /add-product [nama] [harga] [deskripsi]
// ─────────────────────────────────────────────
async function handleAddProduct(interaction) {
  if (!isAdmin(interaction)) return noPermission();

  const options = interaction.data.options || [];
  const nama = options.find((o) => o.name === "nama")?.value?.trim();
  const harga = options.find((o) => o.name === "harga")?.value;
  const deskripsi = options.find((o) => o.name === "deskripsi")?.value?.trim() || "-";

  if (!nama || !harga) return ephemeralReply("❌ Nama dan harga produk wajib diisi.");

  const hargaNum = parseInt(harga);
  if (isNaN(hargaNum) || hargaNum < 1) return ephemeralReply("❌ Harga harus berupa angka positif.");

  // Cek duplikat
  const existing = await getProductByName(nama);
  if (existing) return ephemeralReply(`❌ Produk dengan nama **${nama}** sudah ada.`);

  const product = await addProduct({ name: nama, price: hargaNum, description: deskripsi });

  return ephemeralReply(
    `✅ Produk berhasil ditambahkan!\n\n` +
      `**ID:** \`${product.id}\`\n` +
      `**Nama:** ${product.name}\n` +
      `**Harga:** Rp ${hargaNum.toLocaleString("id-ID")}\n` +
      `**Deskripsi:** ${deskripsi}`
  );
}

// ─────────────────────────────────────────────
// /del-product [nama]
// ─────────────────────────────────────────────
async function handleDelProduct(interaction) {
  if (!isAdmin(interaction)) return noPermission();

  const options = interaction.data.options || [];
  const nama = options.find((o) => o.name === "nama")?.value?.trim();
  if (!nama) return ephemeralReply("❌ Nama produk wajib diisi.");

  const deleted = await deleteProduct(nama);
  if (!deleted) return ephemeralReply(`❌ Produk **${nama}** tidak ditemukan.`);

  return ephemeralReply(`✅ Produk **${nama}** beserta semua stoknya berhasil dihapus.`);
}

// ─────────────────────────────────────────────
// /add-stock [nama_produk] [key]
// ─────────────────────────────────────────────
async function handleAddStock(interaction) {
  if (!isAdmin(interaction)) return noPermission();

  const options = interaction.data.options || [];
  const namaProduk = options.find((o) => o.name === "nama_produk")?.value?.trim();
  const keyValue = options.find((o) => o.name === "key")?.value?.trim();

  if (!namaProduk || !keyValue) return ephemeralReply("❌ Nama produk dan key wajib diisi.");

  const product = await getProductByName(namaProduk);
  if (!product) return ephemeralReply(`❌ Produk **${namaProduk}** tidak ditemukan.`);

  const stock = await addStock(product.id, keyValue);
  const allStocks = await getStocksByProduct(product.id);

  return ephemeralReply(
    `✅ Stok berhasil ditambahkan!\n\n` +
      `**Produk:** ${product.name}\n` +
      `**Stock ID:** \`${stock.id}\`\n` +
      `**Key:** \`||${keyValue}||\` *(spoiler)*\n` +
      `**Total stok tersedia:** ${allStocks.length}`
  );
}

// ─────────────────────────────────────────────
// /del-stock [nama_produk] [id_stok]
// ─────────────────────────────────────────────
async function handleDelStock(interaction) {
  if (!isAdmin(interaction)) return noPermission();

  const options = interaction.data.options || [];
  const namaProduk = options.find((o) => o.name === "nama_produk")?.value?.trim();
  const stockId = options.find((o) => o.name === "id_stok")?.value?.trim();

  if (!namaProduk || !stockId) return ephemeralReply("❌ Nama produk dan ID stok wajib diisi.");

  const product = await getProductByName(namaProduk);
  if (!product) return ephemeralReply(`❌ Produk **${namaProduk}** tidak ditemukan.`);

  await deleteStock(stockId);
  const remaining = await getStocksByProduct(product.id);

  return ephemeralReply(
    `✅ Stok \`${stockId}\` berhasil dihapus dari **${product.name}**.\n` +
      `Stok tersisa: **${remaining.length}**`
  );
}

// ─────────────────────────────────────────────
// /reset-stock [nama_produk]
// ─────────────────────────────────────────────
async function handleResetStock(interaction) {
  if (!isAdmin(interaction)) return noPermission();

  const options = interaction.data.options || [];
  const namaProduk = options.find((o) => o.name === "nama_produk")?.value?.trim();
  if (!namaProduk) return ephemeralReply("❌ Nama produk wajib diisi.");

  const product = await getProductByName(namaProduk);
  if (!product) return ephemeralReply(`❌ Produk **${namaProduk}** tidak ditemukan.`);

  await resetStock(product.id);

  return ephemeralReply(`✅ Semua stok produk **${product.name}** berhasil dikosongkan.`);
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function ephemeralReply(content) {
  return { type: 4, data: { content, flags: 64 } };
}

function noPermission() {
  return ephemeralReply("🚫 Kamu tidak memiliki izin untuk menggunakan command ini.");
}

module.exports = {
  handleAddProduct,
  handleDelProduct,
  handleAddStock,
  handleDelStock,
  handleResetStock,
};
