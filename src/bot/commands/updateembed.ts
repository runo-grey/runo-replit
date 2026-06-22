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

// ─── /update-embed-added ─────────────────────────────────────────────────────

export async function handleUpdateEmbedAdded(
  source: Message | ChatInputCommandInteraction,
  content: string,
): Promise<void> {
  if (!hasAdminRole(source)) {
    await source.reply({
      embeds: [errorEmbed("You don't have permission to use this command.")],
      ...(("replied" in source) ? { ephemeral: true } : {}),
    });
    return;
  }

  if (!content.trim()) {
    await source.reply({
      embeds: [errorEmbed("Please provide content for the update.")],
      ...(("replied" in source) ? { ephemeral: true } : {}),
    });
    return;
  }

  const issuerName = "author" in source ? source.author.username : source.user.username;

  const embed = new EmbedBuilder()
    .setColor(0x57F287) // Discord green
    .setTitle("✅  ─  ADDED  ─  ✅")
    .setDescription(
      [
        "```",
        "╔══════════════════════════╗",
        "║      RUNO  UPDATES       ║",
        "╚══════════════════════════╝",
        "```",
        "",
        `> ${content.split("\n").join("\n> ")}`,
        "",
        "─────────────────────────",
        "🪙 **Runo Bot** • Stay Updated!",
      ].join("\n"),
    )
    .setThumbnail("https://cdn.discordapp.com/emojis/1382394861518725201.webp")
    .setFooter({
      text: `Posted by ${issuerName} • Runo Updates`,
    })
    .setTimestamp();

  // Delete the slash command response and send a clean message instead
  if ("replied" in source) {
    const i = source as ChatInputCommandInteraction;
    await i.reply({ content: "✅ Update posted!", ephemeral: true });
    await i.channel?.send({ embeds: [embed] });
  } else {
    await (source as Message).delete().catch(() => null);
    await (source as Message).channel.send({ embeds: [embed] });
  }
}

// ─── /update-embed-removed ───────────────────────────────────────────────────

export async function handleUpdateEmbedRemoved(
  source: Message | ChatInputCommandInteraction,
  content: string,
): Promise<void> {
  if (!hasAdminRole(source)) {
    await source.reply({
      embeds: [errorEmbed("You don't have permission to use this command.")],
      ...(("replied" in source) ? { ephemeral: true } : {}),
    });
    return;
  }

  if (!content.trim()) {
    await source.reply({
      embeds: [errorEmbed("Please provide content for the update.")],
      ...(("replied" in source) ? { ephemeral: true } : {}),
    });
    return;
  }

  const issuerName = "author" in source ? source.author.username : source.user.username;

  const embed = new EmbedBuilder()
    .setColor(0xED4245) // Discord red
    .setTitle("❌  ─  REMOVED  ─  ❌")
    .setDescription(
      [
        "```",
        "╔══════════════════════════╗",
        "║      RUNO  UPDATES       ║",
        "╚══════════════════════════╝",
        "```",
        "",
        `> ${content.split("\n").join("\n> ")}`,
        "",
        "─────────────────────────",
        "🪙 **Runo Bot** • Stay Updated!",
      ].join("\n"),
    )
    .setThumbnail("https://cdn.discordapp.com/emojis/1382394861518725201.webp")
    .setFooter({
      text: `Posted by ${issuerName} • Runo Updates`,
    })
    .setTimestamp();

  if ("replied" in source) {
    const i = source as ChatInputCommandInteraction;
    await i.reply({ content: "✅ Update posted!", ephemeral: true });
    await i.channel?.send({ embeds: [embed] });
  } else {
    await (source as Message).delete().catch(() => null);
    await (source as Message).channel.send({ embeds: [embed] });
  }
}

