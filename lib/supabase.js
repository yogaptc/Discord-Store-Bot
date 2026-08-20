/**
 * lib/supabase.js
 * Koneksi ke Supabase dan semua operasi database
 */

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Gunakan service_role untuk akses penuh di server
);

// ─────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────

/**
 * Ambil semua produk
 */
async function getAllProducts() {
  const { data, error } = await supabase.from("products").select("*").order("name");
  if (error) throw new Error(`getAllProducts: ${error.message}`);
  return data;
}

/**
 * Ambil produk berdasarkan nama (case-insensitive)
 */
async function getProductByName(name) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .ilike("name", name.trim())
    .single();
  if (error && error.code !== "PGRST116") throw new Error(`getProductByName: ${error.message}`);
  return data || null;
}

/**
 * Tambah produk baru
 */
async function addProduct({ name, price, description }) {
  const { data, error } = await supabase
    .from("products")
    .insert([{ name: name.trim(), price: parseInt(price), description }])
    .select()
    .single();
  if (error) throw new Error(`addProduct: ${error.message}`);
  return data;
}

/**
 * Hapus produk beserta stoknya
 */
async function deleteProduct(name) {
  const product = await getProductByName(name);
  if (!product) return false;

  // Hapus stok dulu
  await supabase.from("stocks").delete().eq("product_id", product.id);

  const { error } = await supabase.from("products").delete().eq("id", product.id);
  if (error) throw new Error(`deleteProduct: ${error.message}`);
  return true;
}

// ─────────────────────────────────────────────
// STOCKS
// ─────────────────────────────────────────────

/**
 * Tambah stok (key/lisensi) ke produk
 */
async function addStock(productId, keyValue) {
  const { data, error } = await supabase
    .from("stocks")
    .insert([{ product_id: productId, key_value: keyValue.trim(), is_sold: false }])
    .select()
    .single();
  if (error) throw new Error(`addStock: ${error.message}`);
  return data;
}

/**
 * Ambil semua stok produk
 */
async function getStocksByProduct(productId) {
  const { data, error } = await supabase
    .from("stocks")
    .select("*")
    .eq("product_id", productId)
    .eq("is_sold", false)
    .order("created_at");
  if (error) throw new Error(`getStocksByProduct: ${error.message}`);
  return data;
}

/**
 * Hapus stok tertentu by ID
 */
async function deleteStock(stockId) {
  const { error } = await supabase.from("stocks").delete().eq("id", stockId);
  if (error) throw new Error(`deleteStock: ${error.message}`);
  return true;
}

/**
 * Reset (hapus semua) stok produk
 */
async function resetStock(productId) {
  const { error } = await supabase.from("stocks").delete().eq("product_id", productId);
  if (error) throw new Error(`resetStock: ${error.message}`);
  return true;
}

/**
 * Ambil 1 stok tersedia (FIFO) dan tandai sebagai terjual
 */
async function claimOneStock(productId) {
  // Ambil stok pertama yang belum terjual
  const { data: stocks, error: fetchErr } = await supabase
    .from("stocks")
    .select("*")
    .eq("product_id", productId)
    .eq("is_sold", false)
    .order("created_at")
    .limit(1);

  if (fetchErr) throw new Error(`claimOneStock fetch: ${fetchErr.message}`);
  if (!stocks || stocks.length === 0) return null;

  const stock = stocks[0];

  // Tandai sebagai terjual
  const { error: updateErr } = await supabase
    .from("stocks")
    .update({ is_sold: true, sold_at: new Date().toISOString() })
    .eq("id", stock.id);

  if (updateErr) throw new Error(`claimOneStock update: ${updateErr.message}`);
  return stock;
}

// ─────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────

/**
 * Simpan transaksi baru
 */
async function createTransaction({ orderId, userId, discordChannelId, type, productId, amount }) {
  const { data, error } = await supabase
    .from("transactions")
    .insert([{
      order_id: orderId,
      user_id: userId,
      discord_channel_id: discordChannelId,
      type,               // "purchase" | "donation"
      product_id: productId || null,
      amount,
      status: "pending",
    }])
    .select()
    .single();
  if (error) throw new Error(`createTransaction: ${error.message}`);
  return data;
}

/**
 * Ambil transaksi berdasarkan order_id Midtrans
 */
async function getTransactionByOrderId(orderId) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*, products(*)")
    .eq("order_id", orderId)
    .single();
  if (error && error.code !== "PGRST116") throw new Error(`getTransactionByOrderId: ${error.message}`);
  return data || null;
}

/**
 * Update status transaksi
 */
async function updateTransactionStatus(orderId, status) {
  const { error } = await supabase
    .from("transactions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("order_id", orderId);
  if (error) throw new Error(`updateTransactionStatus: ${error.message}`);
}

module.exports = {
  getAllProducts,
  getProductByName,
  addProduct,
  deleteProduct,
  addStock,
  getStocksByProduct,
  deleteStock,
  resetStock,
  claimOneStock,
  createTransaction,
  getTransactionByOrderId,
  updateTransactionStatus,
};
