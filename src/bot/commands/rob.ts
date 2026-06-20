import { type Message, type ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getOrCreateUser, updateBalance, setLastRob, hasItem } from "../db.js";
import { Colors, cooldownEmbed, errorEmbed, formatCoins } from "../embeds.js";

const ROB_COOLDOWN = 60 * 60 * 1000;
const SUCCESS_CHANCE = 0.45;
const MIN_ROB_BALANCE = 100;

export async function handleRob(
  source: Message | ChatInputCommandInteraction,
  targetId: string,
  targetUsername: string,
): Promise<void> {
  const discordId = "author" in source ? source.author.id : source.user.id;
  const username = "author" in source ? source.author.username : source.user.username;

  if (targetId === discordId) {
    await source.reply({ embeds: [errorEmbed("You can't rob yourself!")] });
    return;
  }

  const robber = await getOrCreateUser(discordId, username);

  if (robber.lastRob) {
    const elapsed = Date.now() - new Date(robber.lastRob).getTime();
    if (elapsed < ROB_COOLDOWN) {
      await source.reply({ embeds: [cooldownEmbed("rob", ROB_COOLDOWN - elapsed)] });
      return;
    }
  }

  const victim = await getOrCreateUser(targetId, targetUsername);

  if (victim.balance < MIN_ROB_BALANCE) {
    await source.reply({ embeds: [errorEmbed(`**${targetUsername}** is too broke to rob! They only have ${formatCoins(victim.balance)}.`)] }); // formatCoins already says Runos
    return;
  }

  await setLastRob(discordId);

  const victimHasShield = await hasItem(targetId, "shield");
  const successChance = SUCCESS_CHANCE - (victimHasShield ? 0.15 : 0);
  const success = Math.random() < successChance;

  if (success) {
    let stolen = Math.floor(victim.balance * (0.1 + Math.random() * 0.2));
    if (victimHasShield) stolen = Math.floor(stolen * 0.8);
    stolen = Math.max(1, stolen);

    await updateBalance(targetId, -stolen);
    await updateBalance(discordId, stolen);

    const embed = new EmbedBuilder()
      .setColor(Colors.orange)
      .setTitle("🦹 Robbery Successful!")
      .setDescription(`You robbed **${targetUsername}** and got away with ${formatCoins(stolen)}!${victimHasShield ? "\n> 🛡️ Their shield reduced your haul." : ""}`)
      .setTimestamp();

    await source.reply({ embeds: [embed] });
  } else {
    const fine = Math.floor(robber.balance * 0.1);
    await updateBalance(discordId, -fine);

    const embed = new EmbedBuilder()
      .setColor(Colors.red)
      .setTitle("🚔 Caught Red-Handed!")
      .setDescription(`You tried to rob **${targetUsername}** but got caught!\nYou paid a fine of ${formatCoins(fine)}.`)
      .setTimestamp();

    await source.reply({ embeds: [embed] });
  }
}
