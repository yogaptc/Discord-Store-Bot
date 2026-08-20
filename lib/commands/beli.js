/**
 * lib/commands/beli.js
 * Handler untuk slash command /beli [nama_produk]
 */

const { getProductByName, getStocksByProduct, createTransaction } = require("../supabase");
const { generateQris } = require("../midtrans");
const { nanoid } = require("../utils");

/**
 * @param {Object} interaction - Objek interaction dari Discord
 * @returns {Object} Discord interaction response
 */
async function handleBeli(interaction) {
  const options = interaction.data.options || [];
  const namaProduk = options.find((o) => o.name === "nama_produk")?.value?.trim();

  if (!namaProduk) {
    return ephemeralReply("❌ Mohon masukkan nama produk yang ingin dibeli.");
  }

  // 1. Cari produk di database
  const product = await getProductByName(namaProduk);
  if (!product) {
    return ephemeralReply(`❌ Produk **${namaProduk}** tidak ditemukan. Cek kembali nama produknya.`);
  }

  // 2. Cek stok
  const stocks = await getStocksByProduct(product.id);
  if (!stocks || stocks.length === 0) {
    return ephemeralReply(`⚠️ Maaf, stok untuk **${product.name}** sedang kosong. Coba lagi nanti.`);
  }

  // 3. Generate order ID unik
  const orderId = `BELI-${product.id.substring(0, 8).toUpperCase()}-${nanoid(8)}`;

  // 4. Generate QRIS dari Midtrans
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const userName = interaction.member?.user?.username || interaction.user?.username || "Pelanggan";

  let qrisData;
  try {
    qrisData = await generateQris({
      orderId,
      amount: product.price,
      itemName: product.name,
      customerName: userName,
      customerEmail: `${userId}@discord.user`,
    });
  } catch (err) {
    console.error("[beli] Gagal generate QRIS:", err.message);
    return ephemeralReply("❌ Gagal membuat pembayaran QRIS. Silakan coba beberapa saat lagi.");
  }

  // 5. Simpan transaksi ke database
  const channelId = interaction.channel_id;
  await createTransaction({
    orderId,
    userId,
    discordChannelId: channelId,
    type: "purchase",
    productId: product.id,
    amount: product.price,
  });

  // 6. Kirim response ke Discord dengan embed QRIS
  const expiryFormatted = qrisData.expiryTime
    ? new Date(qrisData.expiryTime).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
    : "15 menit dari sekarang";

  return {
    type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      embeds: [
        {
          title: `🛒 Pembelian: ${product.name}`,
          description:
            `Halo <@${userId}>! Berikut adalah detail pembayaranmu.\n\n` +
            `**Produk:** ${product.name}\n` +
            `**Harga:** Rp ${product.price.toLocaleString("id-ID")}\n` +
            `**Deskripsi:** ${product.description}\n\n` +
            `📌 **Scan QRIS di bawah ini** untuk menyelesaikan pembayaran.\n` +
            `Setelah pembayaran berhasil, produk digital akan dikirim otomatis ke DM kamu.\n\n` +
            `⏰ **Berlaku hingga:** ${expiryFormatted}`,
          color: 0x5865f2, // Warna biru Discord
          image: qrisData.qrCodeUrl ? { url: qrisData.qrCodeUrl } : undefined,
          footer: {
            text: `Order ID: ${orderId} | Stok tersisa: ${stocks.length - 1}`,
          },
          thumbnail: {
            url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Qris_logo.svg/1200px-Qris_logo.svg.png",
          },
        },
      ],
      components: qrisData.paymentUrl
        ? [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5, // LINK button
                  label: "Buka Halaman Pembayaran",
                  url: qrisData.paymentUrl,
                  emoji: { name: "💳" },
                },
              ],
            },
          ]
        : [],
    },
  };
}

function ephemeralReply(content) {
  return {
    type: 4,
    data: {
      content,
      flags: 64, // EPHEMERAL — hanya terlihat oleh user yang klik
    },
  };
}

module.exports = { handleBeli };
