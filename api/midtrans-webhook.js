/**
 * api/midtrans-webhook.js
 * ════════════════════════════════════════════════════════════════
 * Endpoint untuk menerima Payment Notification dari Midtrans.
 * URL ini didaftarkan di Midtrans Dashboard sebagai
 * "Payment Notification URL".
 *
 * Alur:
 * 1. Midtrans mengirim POST request ketika pembayaran berhasil/gagal
 * 2. Kita verifikasi notifikasi tersebut (signature & re-check ke API)
 * 3. Jika sukses → kirim produk digital (key) via Discord DM
 * 4. Update status transaksi di database
 * ════════════════════════════════════════════════════════════════
 */

const { verifyMidtransNotification } = require("../lib/midtrans");
const {
  getTransactionByOrderId,
  updateTransactionStatus,
  claimOneStock,
} = require("../lib/supabase");
const { sendDM, sendChannelMessage } = require("../lib/discord-api");

// Status pembayaran Midtrans yang dianggap "sukses"
const SUCCESS_STATUSES = ["settlement", "capture"];
// Status yang dianggap "gagal/dibatalkan"
const FAILED_STATUSES = ["cancel", "deny", "expire", "failure"];

export default async function handler(req, res) {
  // ── Hanya terima POST ──────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const notification = req.body;
  const orderId = notification?.order_id;

  if (!orderId) {
    console.warn("[midtrans-webhook] Notifikasi tanpa order_id");
    return res.status(400).json({ error: "Missing order_id" });
  }

  console.log(`[midtrans-webhook] Notifikasi diterima untuk order: ${orderId}`);

  // ── Verifikasi notifikasi ke Midtrans (re-check) ────────────────
  let verifiedData;
  try {
    verifiedData = await verifyMidtransNotification(notification);
    if (!verifiedData) throw new Error("Verifikasi gagal");
  } catch (err) {
    console.error("[midtrans-webhook] Gagal verifikasi:", err.message);
    return res.status(400).json({ error: "Invalid notification" });
  }

  const transactionStatus = verifiedData.transaction_status;
  const fraudStatus = verifiedData.fraud_status;

  console.log(`[midtrans-webhook] Order: ${orderId}, Status: ${transactionStatus}, Fraud: ${fraudStatus}`);

  // ── Ambil data transaksi dari database ──────────────────────────
  const transaction = await getTransactionByOrderId(orderId);
  if (!transaction) {
    console.warn(`[midtrans-webhook] Transaksi ${orderId} tidak ditemukan di DB`);
    // Tetap return 200 agar Midtrans tidak retry terus
    return res.status(200).json({ message: "Transaction not found, ignored" });
  }

  // Jangan proses ulang transaksi yang sudah selesai
  if (transaction.status === "success" || transaction.status === "failed") {
    console.log(`[midtrans-webhook] Transaksi ${orderId} sudah diproses (${transaction.status}), skip`);
    return res.status(200).json({ message: "Already processed" });
  }

  // ── Tentukan apakah pembayaran sukses ───────────────────────────
  const isSuccess =
    SUCCESS_STATUSES.includes(transactionStatus) &&
    (fraudStatus === "accept" || fraudStatus === undefined || fraudStatus === null);

  const isFailed = FAILED_STATUSES.includes(transactionStatus);

  if (isSuccess) {
    await handleSuccessfulPayment(transaction, res);
  } else if (isFailed) {
    await handleFailedPayment(transaction, orderId);
    return res.status(200).json({ message: "Payment failed, noted" });
  } else {
    // Masih pending / dalam proses — tidak perlu aksi
    console.log(`[midtrans-webhook] Order ${orderId} masih ${transactionStatus}, no action`);
    return res.status(200).json({ message: "Pending, no action" });
  }
}

// ─────────────────────────────────────────────────────────────────
// Tangani pembayaran SUKSES
// ─────────────────────────────────────────────────────────────────
async function handleSuccessfulPayment(transaction, res) {
  const { order_id, user_id, discord_channel_id, type, product_id, amount } = transaction;

  try {
    if (type === "purchase" && product_id) {
      // ── Pembelian produk digital → kirim key via DM ─────────────
      const stock = await claimOneStock(product_id);

      if (!stock) {
        // Stok habis setelah pembayaran — kasus kritis
        console.error(`[midtrans-webhook] STOK HABIS setelah pembayaran untuk order ${order_id}!`);

        await sendDM(user_id, {
          embeds: [
            {
              title: "✅ Pembayaran Berhasil - Stok Habis",
              description:
                `Pembayaran kamu untuk **${transaction.products?.name || "produk"}** telah diterima.\n\n` +
                `⚠️ Namun sayangnya stok produk sudah habis.\n` +
                `Tim kami akan segera menghubungimu untuk refund atau penggantian produk.\n\n` +
                `**Order ID:** \`${order_id}\``,
              color: 0xffa500,
              footer: { text: "Mohon maaf atas ketidaknyamanan ini" },
            },
          ],
        });

        // Notif ke channel jika ada
        if (discord_channel_id) {
          await sendChannelMessage(discord_channel_id, {
            content: `⚠️ <@${user_id}> Pembayaran berhasil tapi stok habis! Admin mohon segera tambah stok atau proses refund.`,
          });
        }

        await updateTransactionStatus(order_id, "out_of_stock");
      } else {
        // Kirim key via DM ──────────────────────────────────────────
        await sendDM(user_id, {
          embeds: [
            {
              title: "🎉 Pembayaran Berhasil! Produk Kamu Sudah Siap",
              description:
                `Terima kasih telah berbelanja! Berikut adalah produk digitalmu:\n\n` +
                `**Produk:** ${transaction.products?.name || "Produk Digital"}\n` +
                `**Harga:** Rp ${Number(amount).toLocaleString("id-ID")}\n\n` +
                `🔑 **Key / Lisensi kamu:**\n\`\`\`\n${stock.key_value}\n\`\`\`\n\n` +
                `Simpan key ini dengan baik dan jangan bagikan ke siapapun.\n\n` +
                `**Order ID:** \`${order_id}\``,
              color: 0x57f287, // Hijau sukses
              footer: { text: "Terima kasih sudah berbelanja! ❤️" },
              timestamp: new Date().toISOString(),
            },
          ],
        });

        // Notif sukses ke channel (tanpa menampilkan key)
        if (discord_channel_id) {
          await sendChannelMessage(discord_channel_id, {
            embeds: [
              {
                description: `✅ <@${user_id}> Pembayaran untuk **${transaction.products?.name}** berhasil! Cek DM kamu untuk produk digitalnya. 📬`,
                color: 0x57f287,
              },
            ],
          });
        }

        await updateTransactionStatus(order_id, "success");
        console.log(`[midtrans-webhook] ✅ Key berhasil dikirim ke user ${user_id} untuk order ${order_id}`);
      }
    } else if (type === "donation") {
      // ── Donasi berhasil ─────────────────────────────────────────
      await sendDM(user_id, {
        embeds: [
          {
            title: "❤️ Donasi Berhasil! Terima Kasih",
            description:
              `Donasi kamu sebesar **Rp ${Number(amount).toLocaleString("id-ID")}** telah kami terima.\n\n` +
              `Dukunganmu sangat berarti bagi kami! 🙏\n\n` +
              `**Order ID:** \`${order_id}\``,
            color: 0xff6b6b,
            footer: { text: "Semoga selalu dilancarkan rezekinya! ❤️" },
            timestamp: new Date().toISOString(),
          },
        ],
      });

      if (discord_channel_id) {
        await sendChannelMessage(discord_channel_id, {
          embeds: [
            {
              description: `❤️ <@${user_id}> berhasil berdonasi sebesar **Rp ${Number(amount).toLocaleString("id-ID")}**! Terima kasih! 🙏`,
              color: 0xff6b6b,
            },
          ],
        });
      }

      await updateTransactionStatus(order_id, "success");
    }

    return res.status(200).json({ message: "OK" });
  } catch (err) {
    console.error(`[midtrans-webhook] Error saat proses sukses untuk ${order_id}:`, err);
    // Tetap return 200 agar Midtrans tidak retry (proses sudah sebagian berjalan)
    return res.status(200).json({ message: "Processed with errors" });
  }
}

// ─────────────────────────────────────────────────────────────────
// Tangani pembayaran GAGAL/DIBATALKAN
// ─────────────────────────────────────────────────────────────────
async function handleFailedPayment(transaction, orderId) {
  const { user_id, discord_channel_id, type } = transaction;

  try {
    await sendDM(user_id, {
      embeds: [
        {
          title: "❌ Pembayaran Gagal / Kedaluwarsa",
          description:
            `${type === "purchase" ? "Pembelian" : "Donasi"} kamu dengan Order ID \`${orderId}\` telah **gagal atau kedaluwarsa**.\n\n` +
            `Silakan buat transaksi baru jika kamu masih ingin melanjutkan.`,
          color: 0xed4245, // Merah error
          footer: { text: "Tidak ada uang yang ditarik" },
        },
      ],
    });

    await updateTransactionStatus(orderId, "failed");
    console.log(`[midtrans-webhook] ❌ Transaksi ${orderId} ditandai gagal`);
  } catch (err) {
    console.error(`[midtrans-webhook] Error saat proses gagal untuk ${orderId}:`, err);
  }
}
