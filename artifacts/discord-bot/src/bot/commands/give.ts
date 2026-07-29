import { type Message, type ChatInputCommandInteraction } from "discord.js";
import { getOrCreateUser, updateBalance } from "../db.js";
import { successEmbed, errorEmbed, formatCoins } from "../embeds.js";

export async function handleGive(
  source: Message | ChatInputCommandInteraction,
  targetId: string,
  targetUsername: string,
  amountStr: string,
): Promise<void> {
  const discordId = "author" in source ? source.author.id : source.user.id;
  const username = "author" in source ? source.author.username : source.user.username;

  if (targetId === discordId) {
    await source.reply({ embeds: [errorEmbed("You can't give Runos to yourself!")] });
    return;
  }

  const amount = parseInt(amountStr, 10);
  if (isNaN(amount) || amount <= 0) {
    await source.reply({ embeds: [errorEmbed("Please provide a valid amount to give.")] });
    return;
  }

  const sender = await getOrCreateUser(discordId, username);
  if (sender.balance < amount) {
    await source.reply({ embeds: [errorEmbed(`You don't have enough coins! You have ${formatCoins(sender.balance)}.`)] });
    return;
  }

  await getOrCreateUser(targetId, targetUsername);
  await updateBalance(discordId, -amount);
  await updateBalance(targetId, amount);

  const embed = successEmbed(
    "💸 Coins Sent",
    `You sent ${formatCoins(amount)} to **${targetUsername}**!`,
  );

  await source.reply({ embeds: [embed] });
}
