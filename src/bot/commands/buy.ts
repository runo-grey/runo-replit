import { type Message, type ChatInputCommandInteraction } from "discord.js";
import { getOrCreateUser, updateBalance, addInventoryItem } from "../db.js";
import { SHOP_ITEMS } from "../items.js";
import { successEmbed, errorEmbed, formatCoins } from "../embeds.js";

export async function handleBuy(
  source: Message | ChatInputCommandInteraction,
  itemQuery: string,
): Promise<void> {
  const discordId = "author" in source ? source.author.id : source.user.id;
  const username = "author" in source ? source.author.username : source.user.username;

  const query = itemQuery.toLowerCase().trim();
  const item = SHOP_ITEMS.find(i =>
    i.name.toLowerCase().includes(query) || i.id.toLowerCase().includes(query),
  );

  if (!item) {
    await source.reply({ embeds: [errorEmbed(`Item **"${itemQuery}"** not found. Use \`!shop\` or \`/shop\` to see available items.`)] });
    return;
  }

  const user = await getOrCreateUser(discordId, username);
  if (user.balance < item.price) {
    await source.reply({ embeds: [errorEmbed(`You need ${formatCoins(item.price)} but only have ${formatCoins(user.balance)}.`)] });
    return;
  }

  await updateBalance(discordId, -item.price);
  await addInventoryItem(discordId, item.id);

  const embed = successEmbed(
    "✅ Purchase Successful",
    `You bought **${item.emoji} ${item.name}** for ${formatCoins(item.price)}!\n\n> ${item.description}`,
  );

  await source.reply({ embeds: [embed] });
}
