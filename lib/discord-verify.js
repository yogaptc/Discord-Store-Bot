/**
 * lib/discord-verify.js
 * Verifikasi request signature dari Discord menggunakan Ed25519 (tweetnacl)
 */

const nacl = require("tweetnacl");

/**
 * Memverifikasi bahwa request berasal dari Discord secara resmi.
 * Discord menandatangani setiap request dengan Ed25519.
 *
 * @param {string} rawBody   - Raw body string dari request
 * @param {string} signature - Header "x-signature-ed25519"
 * @param {string} timestamp - Header "x-signature-timestamp"
 * @returns {boolean}
 */
function verifyDiscordRequest(rawBody, signature, timestamp) {
  try {
    const publicKey = process.env.DISCORD_PUBLIC_KEY;
    if (!publicKey) {
      console.error("[verify] DISCORD_PUBLIC_KEY tidak ditemukan di env");
      return false;
    }

    const isVerified = nacl.sign.detached.verify(
      Buffer.from(timestamp + rawBody),
      Buffer.from(signature, "hex"),
      Buffer.from(publicKey, "hex")
    );

    return isVerified;
  } catch (err) {
    console.error("[verify] Error saat verifikasi:", err.message);
    return false;
  }
}

module.exports = { verifyDiscordRequest };
