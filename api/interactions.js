/**
 * api/interactions.js
 * ════════════════════════════════════════════════════════════════
 * Endpoint utama Discord Interactions (HTTP Webhooks)
 * URL ini didaftarkan di Discord Developer Portal sebagai
 * "Interactions Endpoint URL"
 *
 * Vercel akan memanggil fungsi ini setiap kali user menggunakan
 * slash command di Discord.
 * ════════════════════════════════════════════════════════════════
 */

const { verifyDiscordRequest } = require("../lib/discord-verify");
const { getRawBody } = require("../lib/utils");
const { handleBeli } = require("../lib/commands/beli");
const { handleDonasi } = require("../lib/commands/donasi");
const {
  handleAddProduct,
  handleDelProduct,
  handleAddStock,
  handleDelStock,
  handleResetStock,
} = require("../lib/commands/admin");

// Disable body parser bawaan Vercel agar kita bisa baca raw body
// untuk verifikasi signature Ed25519
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Main handler
 */
export default async function handler(req, res) {
  // ── Hanya terima POST ──────────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Baca raw body ──────────────────────────────────────────────
  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error("[interactions] Gagal membaca body:", err);
    return res.status(400).json({ error: "Cannot read body" });
  }

  // ── Verifikasi Signature Discord (WAJIB) ───────────────────────
  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];

  if (!signature || !timestamp) {
    return res.status(401).json({ error: "Missing signature headers" });
  }

  const isValid = verifyDiscordRequest(rawBody, signature, timestamp);
  if (!isValid) {
    console.warn("[interactions] Signature tidak valid! Possible spoofing attempt.");
    return res.status(401).json({ error: "Invalid request signature" });
  }

  // ── Parse body ──────────────────────────────────────────────────
  let interaction;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const { type } = interaction;

  // ── Type 1: PING (verifikasi dari Discord Developer Portal) ─────
  if (type === 1) {
    console.log("[interactions] PING diterima dari Discord");
    return res.status(200).json({ type: 1 });
  }

  // ── Type 2: APPLICATION_COMMAND (slash commands) ────────────────
  if (type === 2) {
    const commandName = interaction.data?.name;
    console.log(`[interactions] Command: /${commandName}`);

    let response;
    try {
      switch (commandName) {
        case "beli":
          response = await handleBeli(interaction);
          break;

        case "donasi":
          response = await handleDonasi(interaction);
          break;

        case "add-product":
          response = await handleAddProduct(interaction);
          break;

        case "del-product":
          response = await handleDelProduct(interaction);
          break;

        case "add-stock":
          response = await handleAddStock(interaction);
          break;

        case "del-stock":
          response = await handleDelStock(interaction);
          break;

        case "reset-stock":
          response = await handleResetStock(interaction);
          break;

        default:
          response = {
            type: 4,
            data: {
              content: `⚠️ Command \`/${commandName}\` tidak dikenali.`,
              flags: 64,
            },
          };
      }
    } catch (err) {
      console.error(`[interactions] Error handling /${commandName}:`, err);
      response = {
        type: 4,
        data: {
          content: "❌ Terjadi kesalahan internal. Silakan coba lagi.",
          flags: 64,
        },
      };
    }

    return res.status(200).json(response);
  }

  // ── Type lainnya: abaikan ───────────────────────────────────────
  return res.status(200).json({ type: 1 });
}
