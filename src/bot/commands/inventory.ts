import { type Message, type ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getOrCreateUser, getInventory } from "../db.js";
import { SHOP_ITEMS } from "../items.js";
import { Colors } from "../embeds.js";

export async function handleInventory(source: Message | ChatInputCommandInteraction): Promise<void> {
  const discordId = "author" in source ? source.author.id : source.user.id;
  const username = "author" in source ? source.author.username : source.user.username;

  await getOrCreateUser(discordId, username);
  const inventory = await getInventory(discordId);

  const embed = new EmbedBuilder().setColor(Colors.purple).setTitle(`🎒 ${username}'s Inventory`).setTimestamp();

  if (inventory.length === 0) {
    embed.setDescription("Your inventory is empty. Use `!shop` or `/shop` to buy items!");
  } else {
    const rows = inventory.map(inv => {
      const shopItem = SHOP_ITEMS.find(i => i.id === inv.itemId);
      if (!shopItem) return `• Unknown item x${inv.quantity}`;
      return `${shopItem.emoji} **${shopItem.name}** x${inv.quantity}\n> ${shopItem.description}`;
    });
    embed.setDescription(rows.join("\n\n"));
  }

  await source.reply({ embeds: [embed] });
}
