import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from "discord.js";
import { STAFF_ROLE, TICKET_TYPES } from "../ticket.js";

export async function handleTicketHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member?.roles.cache.has(STAFF_ROLE)) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ This command is for staff only.")],
      ephemeral: true,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xFF6B35)
    .setTitle("📋 RUNCANDELS Ticket System — Staff Guide")
    .setDescription("Everything you need to know about managing support tickets.")
    .addFields(
      {
        name: "📁 Ticket Categories",
        value: Object.entries(TICKET_TYPES)
          .map(([, info]) => `${info.emoji} **${info.label}** — ${info.description}`)
          .join("\n"),
        inline: false,
      },
      {
        name: "🙋 Claiming a Ticket",
        value: [
          "Click the **Claim** button inside a ticket channel to take ownership.",
          "Only staff members can claim tickets.",
          "Claiming lets the user know someone is helping them.",
        ].join("\n"),
        inline: false,
      },
      {
        name: "🔒 Closing a Ticket",
        value: [
          "**Close** — Closes and deletes the channel after 5 seconds.",
          "**Close with Reason** — Opens a prompt to write a closing reason before deleting.",
          "Both the ticket opener and staff can close tickets.",
        ].join("\n"),
        inline: false,
      },
      {
        name: "⚙️ Admin Commands",
        value: [
          "`/ticket-panel` — Post the ticket panel in a channel (admin only).",
          "`/set-ticket-role [type] [role]` — Assign the staff role for a ticket category (admin only).",
        ].join("\n"),
        inline: false,
      },
      {
        name: "💡 Best Practices",
        value: [
          "• Always **claim** a ticket before responding — it prevents double-handling.",
          "• Use **Close with Reason** when resolving so users understand the outcome.",
          "• Be patient and professional — users may be frustrated when they reach out.",
          "• If a ticket isn't yours to handle, leave it for the right staff member.",
        ].join("\n"),
        inline: false,
      },
    )
    .setFooter({ text: "RUNCANDELS Support System • Staff only" })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
