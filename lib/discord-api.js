/**
 * lib/discord-api.js
 * Helper untuk berinteraksi dengan Discord REST API
 * (digunakan oleh webhook handler Midtrans untuk kirim DM ke user)
 */

const axios = require("axios");

const DISCORD_API = "https://discord.com/api/v10";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

const headers = {
  Authorization: `Bot ${BOT_TOKEN}`,
  "Content-Type": "application/json",
  "User-Agent": "DiscordBot (https://github.com/store-bot, 1.0.0)",
};

/**
 * Kirim Direct Message ke user Discord
 * 1. Buka DM channel dengan user
 * 2. Kirim pesan ke channel tersebut
 *
 * @param {string} userId  - Discord User ID
 * @param {Object} message - Discord message payload (content, embeds, dll)
 */
async function sendDM(userId, message) {
  // Step 1: Buat DM channel
  const dmRes = await axios.post(
    `${DISCORD_API}/users/@me/channels`,
    { recipient_id: userId },
    { headers }
  );

  const channelId = dmRes.data.id;

  // Step 2: Kirim pesan
  await axios.post(`${DISCORD_API}/channels/${channelId}/messages`, message, { headers });
}

/**
 * Kirim pesan ke channel Discord tertentu
 *
 * @param {string} channelId - Discord Channel ID
 * @param {Object} message   - Discord message payload
 */
async function sendChannelMessage(channelId, message) {
  await axios.post(`${DISCORD_API}/channels/${channelId}/messages`, message, { headers });
}

/**
 * Edit follow-up message dari interaction (untuk deferred responses)
 * Digunakan jika kamu pakai DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
 *
 * @param {string} applicationId    - Discord Application ID
 * @param {string} interactionToken - Token dari interaksi
 * @param {Object} message          - Payload pesan baru
 */
async function editOriginalInteractionResponse(applicationId, interactionToken, message) {
  await axios.patch(
    `${DISCORD_API}/webhooks/${applicationId}/${interactionToken}/messages/@original`,
    message,
    { headers }
  );
}

/**
 * Kirim follow-up message baru ke interaction
 */
async function createFollowupMessage(applicationId, interactionToken, message) {
  await axios.post(
    `${DISCORD_API}/webhooks/${applicationId}/${interactionToken}`,
    message,
    { headers }
  );
}

module.exports = {
  sendDM,
  sendChannelMessage,
  editOriginalInteractionResponse,
  createFollowupMessage,
};
