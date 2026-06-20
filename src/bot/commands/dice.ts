import { type Message, type ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getOrCreateUser, updateBalance } from "../db.js";
import { Colors, errorEmbed, formatCoins } from "../embeds.js";

const DICE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

type DiceBet = "high" | "low" | "seven" | "doubles";

function parseDiceBet(input: string): DiceBet | null {
  const lower = input.toLowerCase().trim();
  if (lower === "high" || lower === "hi") return "high";
  if (lower === "low" || lower === "lo") return "low";
  if (lower === "seven" || lower === "7") return "seven";
  if (lower === "doubles" || lower === "double") return "doubles";
  return null;
}

export async function handleDice(
  source: Message | ChatInputCommandInteraction,
  betStr: string,
  betOnStr: string,
): Promise<void> {
  const discordId = "author" in source ? source.author.id : source.user.id;
  const username = "author" in source ? source.author.username : source.user.username;

  const user = await getOrCreateUser(discordId, username);
  const bet = parseInt(betStr, 10);

  if (isNaN(bet) || bet <= 0) {
    await source.reply({ embeds: [errorEmbed("Please provide a valid bet amount.")] });
    return;
  }
  if (bet < 10) {
    await source.reply({ embeds: [errorEmbed("Minimum bet is 🪙 **10** coins.")] });
    return;
  }
  if (bet > user.balance) {
    await source.reply({ embeds: [errorEmbed(`You don't have enough coins! You have ${formatCoins(user.balance)}.`)] });
    return;
  }

  const betType = parseDiceBet(betOnStr);
  if (!betType) {
    await source.reply({
      embeds: [errorEmbed("Invalid bet. Choose: `high` (8–12), `low` (2–6), `seven` (3x), or `doubles` (5x).")],
    });
    return;
  }

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const sum = d1 + d2;
  const isDoubles = d1 === d2;

  let won = false;
  let multiplier = 0;

  switch (betType) {
    case "high":    won = sum >= 8 && sum <= 12; multiplier = 2; break;
    case "low":     won = sum >= 2 && sum <= 6;  multiplier = 2; break;
    case "seven":   won = sum === 7;              multiplier = 3; break;
    case "doubles": won = isDoubles;              multiplier = 5; break;
  }

  const net = won ? Math.floor(bet * multiplier) - bet : -bet;
  await updateBalance(discordId, net);

  const betLabel: Record<DiceBet, string> = {
    high: "High (8–12)",
    low: "Low (2–6)",
    seven: "Seven (7)",
    doubles: "Doubles",
  };

  const embed = new EmbedBuilder()
    .setColor(won ? Colors.green : Colors.red)
    .setTitle(`🎲 Dice Roll — ${DICE_FACES[d1 - 1]} ${DICE_FACES[d2 - 1]} = **${sum}**`)
    .setDescription(
      won
        ? `You bet on **${betLabel[betType]}** and won ${formatCoins(Math.floor(bet * multiplier))}! (net: +${net})`
        : `You bet on **${betLabel[betType]}** and lost ${formatCoins(bet)}.${isDoubles ? " (Doubles rolled! 🎲)" : ""}`,
    )
    .addFields(
      { name: "Dice", value: `${DICE_FACES[d1 - 1]} + ${DICE_FACES[d2 - 1]} = ${sum}`, inline: true },
      { name: "Multiplier", value: won ? `${multiplier}x` : "0x", inline: true },
      { name: "Result", value: won ? `✅ +${net}` : `❌ -${bet}`, inline: true },
    )
    .setFooter({ text: "Bet options: high 8-12 (2x) • low 2-6 (2x) • seven (3x) • doubles (5x)" })
    .setTimestamp();

  await source.reply({ embeds: [embed] });
}
