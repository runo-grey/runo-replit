import {
  type ChatInputCommandInteraction,
  type Message,
  EmbedBuilder,
  GuildMember,
  ChannelType,
} from "discord.js";
import { setRankChannel } from "../db.js";
import { logger } from "../../lib/logger.js";

const ADMIN_ROLE_ID = "1480151118276202649";

export async function handleSetRankChannel(
  source: ChatInputCommandInteraction | Message,
  channelId?: string,
): Promise<void> {
  // ── Permission check ────────────────────────────────────────────────────
  const member = ("member" in source ? source.member : null) as GuildMember | null;
  if (!member?.roles.cache.has(ADMIN_ROLE_ID)) {
    const deny = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setDescription("❌ You don't have permission to use this command.");

    if ("isChatInputCommand" in source && source.isChatInputCommand()) {
      await source.reply({ embeds: [deny], ephemeral: true });
    } else {
      await (source as Message).reply({ embeds: [deny] });
    }
    return;
  }

  // ── Get channel from slash option or prefix arg ─────────────────────────
  let resolvedChannelId: string | null = null;

  if ("isChatInputCommand" in source && source.isChatInputCommand()) {
    await source.deferReply();
    const ch = source.options.getChannel("channel", true);
    if (ch.type !== ChannelType.GuildText) {
      await source.editReply({
        embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription("❌ Please select a text channel.")],
      });
      return;
    }
    resolvedChannelId = ch.id;
  } else {
    // prefix: !set-rank-channel #channel
    const msg = source as Message;
    const mentioned = msg.mentions.channels.first();
    if (!mentioned || mentioned.type !== ChannelType.GuildText) {
      await msg.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setDescription("❌ Please mention a text channel. e.g. `!set-rank-channel #channel`"),
        ],
      });
      return;
    }
    resolvedChannelId = mentioned.id;
  }

  if (!resolvedChannelId || !source.guildId) return;

  try {
    await setRankChannel(source.guildId, resolvedChannelId);
    logger.info({ guildId: source.guildId, channelId: resolvedChannelId }, "Rank channel set");

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("🏅 Rank Channel Set")
      .setDescription(
        `The \`!rank\` and \`/rank\` commands are now restricted to <#${resolvedChannelId}>.\n` +
        `Members using rank outside that channel will be redirected.`,
      )
      .addFields(
        { name: "Channel", value: `<#${resolvedChannelId}>`, inline: true },
        { name: "Set by", value: `<@${"user" in source ? source.user.id : (source as Message).author.id}>`, inline: true },
      )
      .setTimestamp();

    if ("isChatInputCommand" in source && source.isChatInputCommand()) {
      await source.editReply({ embeds: [embed] });
    } else {
      await (source as Message).reply({ embeds: [embed] });
    }
  } catch (err) {
    logger.error({ err }, "Failed to set rank channel");
    const errEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setDescription("❌ Something went wrong saving the rank channel.");
    if ("isChatInputCommand" in source && source.isChatInputCommand()) {
      await source.editReply({ embeds: [errEmbed] });
    } else {
      await (source as Message).reply({ embeds: [errEmbed] });
    }
  }
}
