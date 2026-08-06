import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from "discord.js";
import { ADMIN_ROLE, TICKET_TYPES } from "../ticket.js";
import { setTicketStaffRole } from "../ticket-db.js";

export async function handleSetTicketRole(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member?.roles.cache.has(ADMIN_ROLE)) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ You don't have permission to use this command.")],
      ephemeral: true,
    });
    return;
  }

  const ticketType = interaction.options.getString("type", true);
  const role = interaction.options.getRole("role", true);

  if (!(ticketType in TICKET_TYPES)) {
    await interaction.reply({ content: "Invalid ticket type.", ephemeral: true });
    return;
  }

  const typeInfo = TICKET_TYPES[ticketType as keyof typeof TICKET_TYPES];

  await setTicketStaffRole(interaction.guildId!, ticketType, role.id);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle("✅ Staff Role Updated")
        .setDescription(
          `**${typeInfo.emoji} ${typeInfo.label}** tickets will now notify and grant access to <@&${role.id}>.`,
        )
        .setFooter({ text: "RUNCANDELS Support System" })
        .setTimestamp(),
    ],
    ephemeral: true,
  });
}
