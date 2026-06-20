import { type Message, type ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getOrCreateUser, updateBalance } from "../db.js";
import { Colors, errorEmbed, formatCoins } from "../embeds.js";

export async function handleCoinflip(
  source: Message | ChatInputCommandInteraction,
  betStr: string,
  choiceStr: string,
): Promise<void> {
  const discordId = "author" in source ? source.author.id : source.user.id;
  const username = "author" in source ? source.author.username : source.user.username;

  const user = await getOrCreateUser(discordId, username);
  const bet = parseInt(betStr, 10);
  const choice = choiceStr.toLowerCase();

  if (!["heads", "tails", "h", "t"].includes(choice)) {
    await source.reply({ embeds: [errorEmbed("Choose **heads** or **tails**.")] });
    return;
  }
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

  const isHeads = Math.random() < 0.5;
  const result = isHeads ? "heads" : "tails";
  const playerChoseHeads = choice === "heads" || choice === "h";
  const won = (isHeads && playerChoseHeads) || (!isHeads && !playerChoseHeads);
  const emoji = isHeads ? "🪙" : "🌑";

  if (won) {
    await updateBalance(discordId, bet);
  } else {
    await updateBalance(discordId, -bet);
  }

  const embed = new EmbedBuilder()
    .setColor(won ? Colors.green : Colors.red)
    .setTitle(`${emoji} Coin Flip`)
    .setDescription(
      `The coin landed on **${result}**!\n\n` +
      (won
        ? `You guessed correctly and won ${formatCoins(bet)}!`
        : `You guessed wrong and lost ${formatCoins(bet)}.`),
    )
    .addFields(
      { name: "Your choice", value: playerChoseHeads ? "Heads 🪙" : "Tails 🌑", inline: true },
      { name: "Result", value: isHeads ? "Heads 🪙" : "Tails 🌑", inline: true },
      { name: "Outcome", value: won ? "✅ Win" : "❌ Loss", inline: true },
    )
    .setTimestamp();

  await source.reply({ embeds: [embed] });
}
