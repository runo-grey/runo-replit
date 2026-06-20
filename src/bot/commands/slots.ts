import { type Message, type ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getOrCreateUser, updateBalance, hasItem } from "../db.js";
import { Colors, errorEmbed, formatCoins } from "../embeds.js";

const SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "⭐", "💎"];
const WEIGHTS =  [30,   25,   20,   15,   7,    3];

function weightedRandom(): string {
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < SYMBOLS.length; i++) {
    rand -= WEIGHTS[i];
    if (rand <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[0];
}

function getMultiplier(reels: string[]): number {
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    if (reels[0] === "💎") return 10;
    if (reels[0] === "⭐") return 5;
    return 3;
  }
  if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) return 1.5;
  return 0;
}

export async function handleSlots(
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
  if (bet > user.balance) {
    await source.reply({ embeds: [errorEmbed(`You don't have enough coins! You have ${formatCoins(user.balance)}.`)] });
    return;
  }
  if (bet < 10) {
    await source.reply({ embeds: [errorEmbed("Minimum bet is 🪙 **10** coins.")] });
    return;
  }

  const hasLuckyCharm = await hasItem(discordId, "lucky_charm");
  const reels = Array.from({ length: 3 }, () => weightedRandom());
  if (hasLuckyCharm && Math.random() < 0.1) reels[1] = reels[0];
  if (hasLuckyCharm && Math.random() < 0.05) reels[2] = reels[0];

  let multiplier = getMultiplier(reels);
  if (hasLuckyCharm && multiplier === 0 && Math.random() < 0.1) multiplier = 0.5;

  const display = `[ ${reels.join(" | ")} ]`;

  let winnings = 0;
  let resultText = "";
  let color = Colors.red;

  if (multiplier === 0) {
    await updateBalance(discordId, -bet);
    resultText = `You lost ${formatCoins(bet)}. Better luck next time!`;
    color = Colors.red;
  } else {
    winnings = Math.floor(bet * multiplier);
    const net = winnings - bet;
    await updateBalance(discordId, net);
    resultText = `You won ${formatCoins(winnings)}! (net: +${winnings - bet})`;
    color = multiplier >= 5 ? Colors.purple : Colors.green;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle("🎰 Slot Machine")
    .setDescription(`**${display}**\n\n${resultText}`)
    .addFields({ name: "Bet", value: formatCoins(bet), inline: true })
    .setFooter({ text: multiplier >= 10 ? "JACKPOT! 💎💎💎" : multiplier >= 5 ? "Big win! ⭐⭐⭐" : multiplier > 0 ? "Winner!" : "No match" })
    .setTimestamp();

  await source.reply({ embeds: [embed] });
}
