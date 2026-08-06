import {
  type Message,
  type PartialMessage,
  EmbedBuilder,
  WebhookClient,
} from "discord.js";
import { logger } from "../lib/logger.js";

function getWebhook(): WebhookClient | null {
  const url = process.env["AUDIT_LOGS_WEBHOOK_URL"];
  if (!url) {
    logger.warn("AUDIT_LOGS_WEBHOOK_URL not set — skipping message log");
    return null;
  }
  return new WebhookClient({ url });
}

export async function handleMessageDelete(message: Message | PartialMessage): Promise<void> {
  // Ignore DMs and bot messages
  if (!message.guild) return;
  if (message.author?.bot) return;

  const webhook = getWebhook();
  if (!webhook) return;

  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setTitle("🗑️ Message Deleted")
    .addFields(
      { name: "Author", value: message.author ? `<@${message.author.id}> (${message.author.username})` : "Unknown", inline: true },
      { name: "Channel", value: `<#${message.channelId}>`, inline: true },
    );

  if (message.content) {
    embed.addFields({ name: "Content", value: message.content.slice(0, 1024) });
  } else {
    embed.addFields({ name: "Content", value: "*Message content unavailable (was not cached)*" });
  }

  if (message.attachments?.size) {
    const urls = message.attachments.map(a => a.url).join("\n");
    embed.addFields({ name: "Attachments", value: urls.slice(0, 1024) });
  }

  embed.setTimestamp().setFooter({ text: `Message ID: ${message.id}` });

  await webhook.send({ username: "Runo Logs", embeds: [embed] }).catch(err => {
    logger.error({ err }, "Failed to send message-delete log");
  });
  webhook.destroy();
}

export async function handleMessageUpdate(
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage,
): Promise<void> {
  // Ignore DMs and bots
  if (!newMessage.guild) return;
  if (newMessage.author?.bot) return;

  // Ignore embed-only updates (Discord auto-adding link previews)
  const oldContent = oldMessage.content ?? "";
  const newContent = newMessage.content ?? "";
  if (oldContent === newContent) return;

  const webhook = getWebhook();
  if (!webhook) return;

  const embed = new EmbedBuilder()
    .setColor(0xF39C12)
    .setTitle("✏️ Message Edited")
    .setURL(newMessage.url)
    .addFields(
      { name: "Author", value: newMessage.author ? `<@${newMessage.author.id}> (${newMessage.author.username})` : "Unknown", inline: true },
      { name: "Channel", value: `<#${newMessage.channelId}>`, inline: true },
      { name: "Before", value: oldContent.slice(0, 1024) || "*empty*" },
      { name: "After", value: newContent.slice(0, 1024) || "*empty*" },
    )
    .setTimestamp()
    .setFooter({ text: `Message ID: ${newMessage.id}` });

  if (newMessage.author) {
    embed.setThumbnail(newMessage.author.displayAvatarURL());
  }

  await webhook.send({ username: "Runo Logs", embeds: [embed] }).catch(err => {
    logger.error({ err }, "Failed to send message-edit log");
  });
  webhook.destroy();
}
