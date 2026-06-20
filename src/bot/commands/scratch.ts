import { type Message, type ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getOrCreateUser, updateBalance } from "../db.js";
import { Colors, errorEmbed, formatCoins } from "../embeds.js";

const SYMBOLS = [
  { emoji: "💎", weight: 1, multiplier: 50 },
  { emoji: "7️⃣",  weight: 2, multiplier: 20 },
  { emoji: "⭐",  weight: 4, multiplier: 10 },
  { emoji: "🍀",  weight: 6, multiplier: 5  },
  { emoji: "🍒",  weight: 10, multiplier: 3  },
  { emoji: "🍋",  weight: 15, multiplier: 2  },
  { emoji: "🍊",  weight: 20, multiplier: 0  },
  { emoji: "💩",  weight: 30, multiplier: 0  },
];

function pickSymbol() {
  const total = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const s of SYMBOLS) { r -= s.weight; if (r <= 0) return s; }
  return SYMBOLS[SYMBOLS.length - 1];
}

export async function handleScratch(
  source: Message | ChatInputCommandInteraction,
  betStr: string,
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

  // 9 cells in a 3x3 grid
  const cells = Array.from({ length: 9 }, () => pickSymbol());

  // Count symbol frequencies
  const freq: Record<string, { count: number; multiplier: number }> = {};
  for (const cell of cells) {
    if (!freq[cell.emoji]) freq[cell.emoji] = { count: 0, multiplier: cell.multiplier };
    freq[cell.emoji].count++;
  }

  // Best prize: most-matching high-value symbol with 3+ matches
  let bestMultiplier = 0;
  let bestEmoji = "";
  let bestCount = 0;

  for (const [emoji, data] of Object.entries(freq)) {
    if (data.count >= 3 && data.multiplier > 0) {
      const effective = data.multiplier * (data.count >= 6 ? 2 : data.count >= 5 ? 1.5 : 1);
      if (effective > bestMultiplier) {
        bestMultiplier = Math.floor(effective);
        bestEmoji = emoji;
        bestCount = data.count;
      }
    }
  }

  const won = bestMultiplier > 0;
  const winnings = won ? Math.floor(bet * bestMultiplier) : 0;
  const net = winnings - bet;

  await updateBalance(discordId, net);

  const grid = [
    cells.slice(0, 3).map(c => c.emoji).join(" "),
    cells.slice(3, 6).map(c => c.emoji).join(" "),
    cells.slice(6, 9).map(c => c.emoji).join(" "),
  ].join("\n");

  const embed = new EmbedBuilder()
    .setColor(won ? (bestMultiplier >= 20 ? Colors.purple : Colors.green) : Colors.red)
    .setTitle("🎟️ Scratch Card")
    .addFields({ name: "Your Card", value: grid, inline: false })
    .setDescription(
      won
        ? `**${bestCount}x ${bestEmoji} — ${bestMultiplier}x multiplier!**\nYou won ${formatCoins(winnings)}! (net: +${net})`
        : "No match (need 3+ of the same symbol). Better luck next time!",
    )
    .addFields(
      { name: "Bet", value: formatCoins(bet), inline: true },
      { name: "Result", value: won ? `✅ +${net}` : `❌ -${bet}`, inline: true },
    )
    .setFooter({ text: "3+ matches wins! 💎50x • 7️⃣20x • ⭐10x • 🍀5x • 🍒3x • 🍋2x" })
    .setTimestamp();

  await source.reply({ embeds: [embed] });
}
