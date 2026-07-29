import { type Message, type ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getLeaderboard } from "../db.js";
import { Colors } from "../embeds.js";

const MEDALS = ["🥇", "🥈", "🥉"];

export async function handleLeaderboard(source: Message | ChatInputCommandInteraction): Promise<void> {
  const users = await getLeaderboard(10);

  if (users.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(Colors.gold)
      .setTitle("🏆 Leaderboard")
      .setDescription("No one is on the leaderboard yet. Start earning Runos!");
    await source.reply({ embeds: [embed] });
    return;
  }

  const rows = users.map((u, i) => {
    const medal = MEDALS[i] ?? `**${i + 1}.**`;
    return `${medal} **${u.username}** — 🪙 ${(u.balance + u.bank).toLocaleString()} Runos`;
  });

  const embed = new EmbedBuilder()
    .setColor(Colors.gold)
    .setTitle("🏆 Richest Players")
    .setDescription(rows.join("\n"))
    .setFooter({ text: "Net worth = wallet + bank" })
    .setTimestamp();

  await source.reply({ embeds: [embed] });
}
