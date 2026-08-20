/**
 * lib/commands/donasi.js
 * Handler untuk slash command /donasi [nominal]
 */

const { createTransaction } = require("../supabase");
const { generateQris } = require("../midtrans");
const { nanoid } = require("../utils");

const MINIMUM_DONASI = 1000; // Rp 1.000

async function handleDonasi(interaction) {
  const options = interaction.data.options || [];
  const nominalRaw = options.find((o) => o.name === "nominal")?.value;
  const nominal = parseInt(nominalRaw);

  if (!nominal || isNaN(nominal) || nominal < MINIMUM_DONASI) {
    return ephemeralReply(
      `❌ Nominal donasi minimal adalah **Rp ${MINIMUM_DONASI.toLocaleString("id-ID")}**.`
    );
  }

  const userId = interaction.member?.user?.id || interaction.user?.id;
  const userName = interaction.member?.user?.username || interaction.user?.username || "Donatur";

  const orderId = `DONASI-${userId.substring(0, 6)}-${nanoid(8)}`;

  let qrisData;
  try {
    qrisData = await generateQris({
      orderId,
      amount: nominal,
      itemName: `Donasi dari ${userName}`,
      customerName: userName,
      customerEmail: `${userId}@discord.user`,
    });
  } catch (err) {
    console.error("[donasi] Gagal generate QRIS:", err.message);
    return ephemeralReply("❌ Gagal membuat QRIS donasi. Coba lagi beberapa saat lagi.");
  }

  await createTransaction({
    orderId,
    userId,
    discordChannelId: interaction.channel_id,
    type: "donation",
    productId: null,
    amount: nominal,
  });

  const expiryFormatted = qrisData.expiryTime
    ? new Date(qrisData.expiryTime).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
    : "15 menit dari sekarang";

  return {
    type: 4,
    data: {
      embeds: [
        {
          title: "❤️ Terima Kasih atas Donasimu!",
          description:
            `Halo <@${userId}>! Donasi kamu sangat berarti bagi kami 🙏\n\n` +
            `**Nominal:** Rp ${nominal.toLocaleString("id-ID")}\n` +
            `**Dari:** ${userName}\n\n` +
            `📌 **Scan QRIS di bawah ini** untuk menyelesaikan donasi.\n\n` +
            `⏰ **Berlaku hingga:** ${expiryFormatted}`,
          color: 0xff6b6b, // Merah muda/love
          image: qrisData.qrCodeUrl ? { url: qrisData.qrCodeUrl } : undefined,
          footer: {
            text: `Order ID: ${orderId}`,
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
                  style: 5,
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
  return { type: 4, data: { content, flags: 64 } };
}

module.exports = { handleDonasi };
