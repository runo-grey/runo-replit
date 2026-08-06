import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  GuildMember,
} from "discord.js";
import { ADMIN_ROLE, TICKET_TYPES } from "../ticket.js";

export async function handleTicketPanel(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member?.roles.cache.has(ADMIN_ROLE)) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ You don't have permission to use this command.")],
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xFF6B35)
    .setTitle("🕯️ RUNCANDELS — Support Center")
    .setDescription([
      "Need help? We've got you covered.",
      "",
      "Select the category that best matches your issue from the dropdown below and a support ticket will be created for you.",
      "",
      "**🎧 General Support** — General help and server assistance",
      "**🐛 Bug Report** — Report a bug or technical issue",
      "**🛒 Store Support** — Help with purchases and store issues",
      "**⚖️ Ban Appeal** — Appeal a ban or punishment",
      "**🚨 Player Report** — Report a player for rule violations",
      "",
      "> 📌 We are not available 24/7. Please be patient while awaiting a response.",
    ].join("\n"))
    .setFooter({ text: "RUNCANDELS Support System" })
    .setTimestamp();

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("ticket_select")
    .setPlaceholder("📂  Select a category...")
    .addOptions(
      Object.entries(TICKET_TYPES).map(([value, info]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(info.label)
          .setDescription(info.description)
          .setEmoji(info.emoji)
          .setValue(value),
      ),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({ content: "✅ Ticket panel posted!", ephemeral: true });
  await interaction.channel?.send({ embeds: [embed], components: [row] });
}
