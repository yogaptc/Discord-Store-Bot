/**
 * lib/midtrans.js
 * Integrasi Midtrans Core API untuk generate QRIS
 */

const midtransClient = require("midtrans-client");

// Inisialisasi Midtrans Core API
const core = new midtransClient.CoreApi({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

/**
 * Generate QRIS payment via Midtrans Core API
 *
 * @param {Object} params
 * @param {string} params.orderId     - Unique order ID
 * @param {number} params.amount      - Nominal dalam Rupiah
 * @param {string} params.itemName    - Nama produk / keterangan
 * @param {string} params.customerName - Nama pembeli
 * @param {string} params.customerEmail - Email pembeli (dummy jika tidak ada)
 * @returns {Object} { qrCode (base64 string), expiryTime }
 */
async function generateQris({ orderId, amount, itemName, customerName, customerEmail }) {
  const parameter = {
    payment_type: "qris",
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
    qris: {
      acquirer: "gopay", // bisa "airpay shopee", "gopay", dll — "gopay" paling umum
    },
    item_details: [
      {
        id: orderId,
        price: amount,
        quantity: 1,
        name: itemName.substring(0, 50), // Midtrans max 50 char
      },
    ],
    customer_details: {
      first_name: customerName || "Pelanggan",
      email: customerEmail || `${orderId}@noreply.store`,
    },
  };

  const response = await core.charge(parameter);

  if (!response || !response.actions) {
    throw new Error("Midtrans tidak mengembalikan data QRIS yang valid");
  }

  // Cari action generate-qr-code
  const qrAction = response.actions.find((a) => a.name === "generate-qr-code");
  const displayQrAction = response.actions.find((a) => a.name === "display-payment-window");

  return {
    transactionId: response.transaction_id,
    qrCodeUrl: qrAction ? qrAction.url : null,       // URL gambar QR (PNG)
    paymentUrl: displayQrAction ? displayQrAction.url : null,
    expiryTime: response.expiry_time,
    status: response.transaction_status,
  };
}

/**
 * Verifikasi notifikasi dari Midtrans menggunakan server key
 * Midtrans mengirim signature_key: SHA512(order_id + status_code + gross_amount + server_key)
 *
 * @param {Object} notification - Body dari Midtrans webhook
 * @returns {boolean}
 */
async function verifyMidtransNotification(notification) {
  try {
    const statusResponse = await core.transaction.notification(notification);
    return statusResponse;
  } catch (err) {
    console.error("[midtrans] Verifikasi notifikasi gagal:", err.message);
    return null;
  }
}

/**
 * Cek status transaksi langsung ke Midtrans
 */
async function checkTransactionStatus(orderId) {
  try {
    const status = await core.transaction.status(orderId);
    return status;
  } catch (err) {
    console.error("[midtrans] Cek status gagal:", err.message);
    return null;
  }
}

module.exports = { generateQris, verifyMidtransNotification, checkTransactionStatus };
