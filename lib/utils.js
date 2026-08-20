/**
 * lib/utils.js
 * Utility functions
 */

/**
 * Generate random alphanumeric string sebagai pengganti nanoid
 * (agar tidak perlu install package tambahan)
 *
 * @param {number} length
 * @returns {string}
 */
function nanoid(length = 10) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Format Rupiah
 */
function formatRupiah(amount) {
  return `Rp ${Number(amount).toLocaleString("id-ID")}`;
}

/**
 * Baca raw body dari Vercel request sebagai string
 * (Diperlukan untuk verifikasi signature Discord)
 *
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<string>}
 */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

module.exports = { nanoid, formatRupiah, getRawBody };
