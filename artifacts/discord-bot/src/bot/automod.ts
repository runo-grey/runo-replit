import {
  type AutoModerationActionExecution,
  EmbedBuilder,
  WebhookClient,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { addAutomodWarning } from "./db.js";

// ─── Called when Discord's native AutoMod fires ────────────────────────────────
// Discord blocks the message. We DM the user a warning and post a rich log
// to the configured webhook.
export async function handleAutomodExecution(execution: AutoModerationActionExecution): Promise<void> {
  const { guild, userId, channelId, content, ruleName } = execution;

  const webhookUrl = process.env["AUTOMOD_WEBHOOK_URL"];

  // Fetch the user who triggered automod
  const user = await guild.client.users.fetch(userId).catch(() => null);
  if (!user) return;

  const username = user.username;

  // 1. Increment warning count in DB
  const warningCount = await addAutomodWarning(guild.id, userId, username);

  // 2. DM the user a warning
  const dmEmbed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle("⚠️ AutoMod Warning")
    .setDescription(
      `Your message in **${guild.name}** was automatically removed by Discord's AutoMod.\n\n` +
      `Please keep the conversation clean and respectful.`
    )
    .addFields(
      { name: "Server", value: guild.name, inline: true },
      { name: "Warning #", value: `${warningCount}`, inline: true },
    )
    .setFooter({ text: "Continued violations may result in a mute or ban." })
    .setTimestamp();

  await user.send({ embeds: [dmEmbed] }).catch(() => null); // ignore if DMs are closed

  // 3. Post a rich log embed via the webhook
  if (!webhookUrl) {
    logger.warn("AUTOMOD_WEBHOOK_URL not set — skipping log");
    return;
  }

  const webhook = new WebhookClient({ url: webhookUrl });

  const logEmbed = new EmbedBuilder()
    .setColor(0xFF6B00)
    .setTitle("🛡️ AutoMod | Message Blocked")
    .addFields(
      { name: "User", value: `<@${userId}> (${username})`, inline: true },
      { name: "Channel", value: channelId ? `<#${channelId}>` : "Unknown", inline: true },
      { name: "Warning #", value: `${warningCount}`, inline: true },
      { name: "Rule Triggered", value: ruleName, inline: true },
      { name: "Blocked Content", value: content ? `\`\`\`${content.slice(0, 900)}\`\`\`` : "*content unavailable*" },
    )
    .setThumbnail(user.displayAvatarURL())
    .setTimestamp();

  await webhook.send({
    username: "Runo AutoMod",
    avatarURL: "https://cdn.discordapp.com/emojis/1234567890.png",
    embeds: [logEmbed],
  }).catch((err) => {
    logger.error({ err }, "Failed to send automod log via webhook");
  });

  webhook.destroy();
}
