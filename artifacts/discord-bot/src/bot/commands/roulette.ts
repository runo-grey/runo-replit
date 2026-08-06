import { type Message, type ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getOrCreateUser, updateBalance } from "../db.js";
import { Colors, errorEmbed, formatCoins } from "../embeds.js";

const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const BLACK_NUMBERS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

type BetType = "red" | "black" | "green" | "odd" | "even" | "number";

function classifyBet(input: string): { type: BetType; number?: number } | null {
  const lower = input.toLowerCase().trim();
  if (lower === "red") return { type: "red" };
  if (lower === "black") return { type: "black" };
  if (lower === "green" || lower === "0") return { type: "green" };
  if (lower === "odd") return { type: "odd" };
  if (lower === "even") return { type: "even" };
  const num = parseInt(lower, 10);
  if (!isNaN(num) && num >= 0 && num <= 36) return { type: "number", number: num };
  return null;
}

function getMultiplier(bet: { type: BetType; number?: number }, landed: number): number {
  const isRed = RED_NUMBERS.includes(landed);
  const isBlack = BLACK_NUMBERS.includes(landed);

  switch (bet.type) {
    case "red":    return isRed ? 2 : 0;
    case "black":  return isBlack ? 2 : 0;
    case "green":  return landed === 0 ? 14 : 0;
    case "odd":    return landed !== 0 && landed % 2 !== 0 ? 2 : 0;
    case "even":   return landed !== 0 && landed % 2 === 0 ? 2 : 0;
    case "number": return landed === bet.number ? 35 : 0;
    default:       return 0;
  }
}

const WHEEL = ["🔴", "⚫", "🟢"];

function getColor(n: number): string {
  if (n === 0) return "🟢";
  return RED_NUMBERS.includes(n) ? "🔴" : "⚫";
}

export async function handleRoulette(
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

  const betInfo = classifyBet(betOnStr);
  if (!betInfo) {
    await source.reply({
      embeds: [errorEmbed("Invalid bet. Choose: `red`, `black`, `green`, `odd`, `even`, or a number `0–36`.")],
    });
    return;
  }

  const landed = Math.floor(Math.random() * 37); // 0–36
  const multiplier = getMultiplier(betInfo, landed);
  const won = multiplier > 0;
  const net = won ? Math.floor(bet * multiplier) - bet : -bet;

  await updateBalance(discordId, net);

  const betLabel = betInfo.type === "number" ? `Number ${betInfo.number}` : betInfo.type.charAt(0).toUpperCase() + betInfo.type.slice(1);

  const embed = new EmbedBuilder()
    .setColor(won ? (multiplier >= 14 ? Colors.purple : Colors.green) : Colors.red)
    .setTitle(`🎡 Roulette — ${getColor(landed)} **${landed}**`)
    .setDescription(
      won
        ? `The ball landed on **${landed}**! You bet on **${betLabel}** and won ${formatCoins(Math.floor(bet * multiplier))}! (net: +${net})`
        : `The ball landed on **${landed}**. You bet on **${betLabel}** and lost ${formatCoins(bet)}.`,
    )
    .addFields(
      { name: "Bet", value: formatCoins(bet), inline: true },
      { name: "Multiplier", value: won ? `${multiplier}x` : "0x", inline: true },
      { name: "Result", value: won ? `✅ +${net}` : `❌ -${bet}`, inline: true },
    )
    .setFooter({ text: "Bet options: red (2x) • black (2x) • green (14x) • odd/even (2x) • number 0–36 (35x)" })
    .setTimestamp();

  await source.reply({ embeds: [embed] });
}
