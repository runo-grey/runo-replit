import {
  type ChatInputCommandInteraction,
  type Message,
  EmbedBuilder,
  GuildMember,
} from "discord.js";
import { errorEmbed } from "../embeds.js";

const ADMIN_ROLE_ID = "1480151118276202649";

function hasAdminRole(source: Message | ChatInputCommandInteraction): boolean {
  const member = source.member as GuildMember | null;
  if (!member) return false;
  return member.roles.cache.has(ADMIN_ROLE_ID);
}

async function postUpdate(
  source: Message | ChatInputCommandInteraction,
  embed: EmbedBuilder,
): Promise<void> {
  if ("replied" in source) {
    const i = source as ChatInputCommandInteraction;
    await i.reply({ content: "✅ Update posted!", ephemeral: true });
    await i.channel?.send({ embeds: [embed] });
  } else {
    await (source as Message).delete().catch(() => null);
    await (source as Message).channel.send({ embeds: [embed] });
  }
}

// ─── /update-embed-added ─────────────────────────────────────────────────────

export async function handleUpdateEmbedAdded(
  source: Message | ChatInputCommandInteraction,
  content: string,
): Promise<void> {
  if (!hasAdminRole(source)) {
    await source.reply({
      embeds: [errorEmbed("You don't have permission to use this command.")],
      ...("replied" in source ? { ephemeral: true } : {}),
    });
    return;
  }

  if (!content.trim()) {
    await source.reply({
      embeds: [errorEmbed("Please provide content for the update.")],
      ...("replied" in source ? { ephemeral: true } : {}),
    });
    return;
  }

  const issuerName = "author" in source ? source.author.username : source.user.username;

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle("✅ Added")
    .setDescription(content)
    .setFooter({ text: `Posted by ${issuerName} • Runo Updates` })
    .setTimestamp();

  await postUpdate(source, embed);
}

// ─── /update-embed-removed ───────────────────────────────────────────────────

export async function handleUpdateEmbedRemoved(
  source: Message | ChatInputCommandInteraction,
  content: string,
): Promise<void> {
  if (!hasAdminRole(source)) {
    await source.reply({
      embeds: [errorEmbed("You don't have permission to use this command.")],
      ...("replied" in source ? { ephemeral: true } : {}),
    });
    return;
  }

  if (!content.trim()) {
    await source.reply({
      embeds: [errorEmbed("Please provide content for the update.")],
      ...("replied" in source ? { ephemeral: true } : {}),
    });
    return;
  }

  const issuerName = "author" in source ? source.author.username : source.user.username;

  const embed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle("❌ Removed")
    .setDescription(content)
    .setFooter({ text: `Posted by ${issuerName} • Runo Updates` })
    .setTimestamp();

  await postUpdate(source, embed);
}

// ─── /update-embed-updated ───────────────────────────────────────────────────

export async function handleUpdateEmbedUpdated(
  source: Message | ChatInputCommandInteraction,
  content: string,
): Promise<void> {
  if (!hasAdminRole(source)) {
    await source.reply({
      embeds: [errorEmbed("You don't have permission to use this command.")],
      ...("replied" in source ? { ephemeral: true } : {}),
    });
    return;
  }

  if (!content.trim()) {
    await source.reply({
      embeds: [errorEmbed("Please provide content for the update.")],
      ...("replied" in source ? { ephemeral: true } : {}),
    });
    return;
  }

  const issuerName = "author" in source ? source.author.username : source.user.username;

  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle("🔄 Updated")
    .setDescription(content)
    .setFooter({ text: `Posted by ${issuerName} • Runo Updates` })
    .setTimestamp();

  await postUpdate(source, embed);
}
