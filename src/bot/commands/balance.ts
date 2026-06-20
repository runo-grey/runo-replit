import { type Message, type ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getOrCreateUser } from "../db.js";
import { Colors, formatCoins } from "../embeds.js";

export async function handleBalance(
  source: Message | ChatInputCommandInteraction,
  targetDiscordId?: string,
  targetUsername?: string,
): Promise<void> {
  const discordId = targetDiscordId ?? source.member?.user.id ?? ("author" in source ? source.author.id : "");
  const username = targetUsername ?? source.member?.user.username ?? ("author" in source ? source.author.username : "");

  const user = await getOrCreateUser(discordId, username);
  const total = user.balance + user.bank;

  const embed = new EmbedBuilder()
    .setColor(Colors.gold)
    .setTitle(`💰 ${user.username}'s Wallet`)
    .addFields(
      { name: "👛 Wallet", value: formatCoins(user.balance), inline: true },
      { name: "🏦 Bank", value: formatCoins(user.bank), inline: true },
      { name: "💎 Net Worth", value: formatCoins(total), inline: true },
    )
    .setTimestamp();

  if ("reply" in source) {
    await source.reply({ embeds: [embed] });
  } else {
    await (source as ChatInputCommandInteraction).reply({ embeds: [embed] });
  }
}
