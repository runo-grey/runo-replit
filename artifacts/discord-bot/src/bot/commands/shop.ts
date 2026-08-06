import { type Message, type ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { SHOP_ITEMS } from "../items.js";
import { Colors } from "../embeds.js";

export async function handleShop(source: Message | ChatInputCommandInteraction): Promise<void> {
  const rows = SHOP_ITEMS.map(item =>
    `${item.emoji} **${item.name}** — 🪙 ${item.price.toLocaleString()} Runos\n> ${item.description}`,
  );

  const embed = new EmbedBuilder()
    .setColor(Colors.teal)
    .setTitle("🛒 Shop")
    .setDescription(rows.join("\n\n"))
    .setFooter({ text: "Use !buy <item name> or /buy <item> to purchase" })
    .setTimestamp();

  await source.reply({ embeds: [embed] });
}
