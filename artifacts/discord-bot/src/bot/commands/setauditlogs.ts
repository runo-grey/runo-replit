import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  ChannelType,
} from "discord.js";
import { logger } from "../../lib/logger.js";
import { setAuditLogChannel } from "../db.js";

const ADMIN_ROLE_ID = "1480151118276202649";

export async function handleSetAuditLogs(i: ChatInputCommandInteraction): Promise<void> {
  const member = i.member as GuildMember;
  if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xE74C3C)
          .setDescription("❌ You don't have permission to use this command."),
      ],
      ephemeral: true,
    });
    return;
  }

  const channel = i.options.getChannel("channel", true);
  if (channel.type !== ChannelType.GuildText) {
    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xE74C3C)
          .setDescription("❌ Please select a text channel."),
      ],
      ephemeral: true,
    });
    return;
  }

  await i.deferReply();

  try {
    await setAuditLogChannel(i.guild!.id, channel.id);
    logger.info({ guildId: i.guild!.id, channelId: channel.id }, "Audit log channel set");

    const webhookSet = !!process.env["AUDIT_LOGS_WEBHOOK_URL"];

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle("📋 Audit Logs Channel Set")
      .setDescription(
        `All audit logs (deleted messages, edited messages) will now be sent to <#${channel.id}> via the configured webhook.`
      )
      .addFields(
        { name: "Channel", value: `<#${channel.id}>`, inline: true },
        { name: "Set by", value: `<@${i.user.id}>`, inline: true },
        { name: "Webhook", value: webhookSet ? "✅ Configured" : "⚠️ Not set — contact bot admin", inline: true },
      )
      .setFooter({ text: "Logs are sent via webhook — make sure the webhook points to this channel." })
      .setTimestamp();

    await i.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error({ err }, "Failed to set audit log channel");
    await i.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xE74C3C)
          .setDescription("❌ Something went wrong while saving the audit log channel."),
      ],
    });
  }
}
