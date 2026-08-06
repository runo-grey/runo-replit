import { type Message, type ChatInputCommandInteraction } from "discord.js";
import { getOrCreateUser, updateBalance, setLastDaily } from "../db.js";
import { successEmbed, cooldownEmbed, formatCoins } from "../embeds.js";

const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
const DAILY_AMOUNT = 500;

export async function handleDaily(source: Message | ChatInputCommandInteraction): Promise<void> {
  const discordId = "author" in source ? source.author.id : source.user.id;
  const username = "author" in source ? source.author.username : source.user.username;

  const user = await getOrCreateUser(discordId, username);

  if (user.lastDaily) {
    const elapsed = Date.now() - new Date(user.lastDaily).getTime();
    if (elapsed < DAILY_COOLDOWN) {
      const embed = cooldownEmbed("daily", DAILY_COOLDOWN - elapsed);
      await source.reply({ embeds: [embed] });
      return;
    }
  }

  await updateBalance(discordId, DAILY_AMOUNT);
  await setLastDaily(discordId);

  const embed = successEmbed(
    "📅 Daily Reward",
    `You collected your daily reward of ${formatCoins(DAILY_AMOUNT)}!\nCome back in **24 hours** for more.`,
  );

  await source.reply({ embeds: [embed] });
}
