import { type Message, type ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getOrCreateUser } from "../db.js";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Colors, errorEmbed, formatCoins } from "../embeds.js";

export async function handleDeposit(
  source: Message | ChatInputCommandInteraction,
  amountStr: string,
): Promise<void> {
  const discordId = "author" in source ? source.author.id : source.user.id;
  const username = "author" in source ? source.author.username : source.user.username;

  const user = await getOrCreateUser(discordId, username);

  let amount: number;
  if (amountStr.toLowerCase() === "all" || amountStr.toLowerCase() === "max") {
    amount = user.balance;
  } else {
    amount = parseInt(amountStr, 10);
  }

  if (isNaN(amount) || amount <= 0) {
    await source.reply({ embeds: [errorEmbed("Please provide a valid amount. e.g. `!deposit 500` or `!deposit all`")] });
    return;
  }
  if (amount > user.balance) {
    await source.reply({ embeds: [errorEmbed(`You only have ${formatCoins(user.balance)} in your wallet.`)] });
    return;
  }

  await db.update(usersTable)
    .set({ balance: user.balance - amount, bank: user.bank + amount })
    .where(eq(usersTable.discordId, discordId));

  const embed = new EmbedBuilder()
    .setColor(Colors.teal)
    .setTitle("🏦 Deposit Successful")
    .setDescription(`You deposited ${formatCoins(amount)} into your bank.`)
    .addFields(
      { name: "👛 Wallet", value: formatCoins(user.balance - amount), inline: true },
      { name: "🏦 Bank", value: formatCoins(user.bank + amount), inline: true },
    )
    .setFooter({ text: "Banked Runos are safe from robbery!" })
    .setTimestamp();

  await source.reply({ embeds: [embed] });
}

export async function handleWithdraw(
  source: Message | ChatInputCommandInteraction,
  amountStr: string,
): Promise<void> {
  const discordId = "author" in source ? source.author.id : source.user.id;
  const username = "author" in source ? source.author.username : source.user.username;

  const user = await getOrCreateUser(discordId, username);

  let amount: number;
  if (amountStr.toLowerCase() === "all" || amountStr.toLowerCase() === "max") {
    amount = user.bank;
  } else {
    amount = parseInt(amountStr, 10);
  }

  if (isNaN(amount) || amount <= 0) {
    await source.reply({ embeds: [errorEmbed("Please provide a valid amount. e.g. `!withdraw 500` or `!withdraw all`")] });
    return;
  }
  if (amount > user.bank) {
    await source.reply({ embeds: [errorEmbed(`You only have ${formatCoins(user.bank)} in your bank.`)] });
    return;
  }

  await db.update(usersTable)
    .set({ balance: user.balance + amount, bank: user.bank - amount })
    .where(eq(usersTable.discordId, discordId));

  const embed = new EmbedBuilder()
    .setColor(Colors.orange)
    .setTitle("🏦 Withdrawal Successful")
    .setDescription(`You withdrew ${formatCoins(amount)} from your bank.`)
    .addFields(
      { name: "👛 Wallet", value: formatCoins(user.balance + amount), inline: true },
      { name: "🏦 Bank", value: formatCoins(user.bank - amount), inline: true },
    )
    .setFooter({ text: "Wallet Runos can be robbed — stay safe!" })
    .setTimestamp();

  await source.reply({ embeds: [embed] });
}
