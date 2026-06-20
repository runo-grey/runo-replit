import { type Message, type ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Colors } from "../embeds.js";

export async function handleHelp(source: Message | ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(Colors.blue)
    .setTitle("📖 Economy Bot Commands")
    .setDescription("All commands work with both `!` prefix and `/` slash commands.")
    .addFields(
      {
        name: "💰 Economy",
        value: [
          "`balance [@user]` — Check wallet & bank",
          "`daily` — Claim daily reward (500 Runos, 24h cooldown)",
          "`work` — Earn 100–300 Runos (30m cooldown)",
          "`give <@user> <amount>` — Send Runos to someone",
        ].join("\n"),
      },
      {
        name: "🎰 Gambling",
        value: [
          "`slots <bet>` — Spin the slot machine",
          "`coinflip <bet> <heads/tails>` — Double or nothing",
          "`blackjack <bet>` — Play blackjack vs dealer",
          "`rob <@user>` — Attempt to steal Runos (1h cooldown)",
        ].join("\n"),
      },
      {
        name: "🛒 Shop",
        value: [
          "`shop` — Browse available items",
          "`buy <item name>` — Purchase an item",
          "`inventory` — View your items",
        ].join("\n"),
      },
      {
        name: "🏆 Other",
        value: [
          "`leaderboard` — Top 10 richest players",
          "`help` — Show this help message",
        ].join("\n"),
      },
      {
        name: "⚙️ Admin",
        value: "`/gamesetup channel #channel` — Lock bot to a specific channel",
      },
    )
    .setFooter({ text: "Start with !daily to get your first Runos!" })
    .setTimestamp();

  await source.reply({ embeds: [embed] });
}
