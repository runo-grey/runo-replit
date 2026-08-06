import {
  type StringSelectMenuInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type GuildMember,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { logger } from "../lib/logger.js";
import {
  getTicketStaffRole,
  createTicketRecord,
  getTicketByChannel,
  getUserOpenTicket,
  claimTicket,
  deleteTicketRecord,
} from "./ticket-db.js";

// ─── Constants ────────────────────────────────────────────────────────────────

export const ADMIN_ROLE = "1480151118276202649";
export const STAFF_ROLE = "1513373603842752682";

export const TICKET_TYPES = {
  "general-support": {
    label: "General Support",
    emoji: "🎧",
    description: "General help and server assistance",
    categoryId: "1534870377568665670",
    color: 0x5865F2,
    channelPrefix: "general",
  },
  "bug-report": {
    label: "Bug Report",
    emoji: "🐛",
    description: "Report a bug or technical issue",
    categoryId: "1534870528941097101",
    color: 0xED4245,
    channelPrefix: "bug",
  },
  "store-support": {
    label: "Store Support",
    emoji: "🛒",
    description: "Help with purchases and store issues",
    categoryId: "1534870633110835272",
    color: 0x57F287,
    channelPrefix: "store",
  },
  "ban-appeal": {
    label: "Ban Appeal",
    emoji: "⚖️",
    description: "Appeal a ban or punishment",
    categoryId: "1534870701243105312",
    color: 0xFEE75C,
    channelPrefix: "appeal",
  },
  "player-report": {
    label: "Player Report",
    emoji: "🚨",
    description: "Report a player for rule violations",
    categoryId: "1534871072480956416",
    color: 0xEB459E,
    channelPrefix: "report",
  },
} as const;

export type TicketType = keyof typeof TICKET_TYPES;

function isTicketType(value: string): value is TicketType {
  return value in TICKET_TYPES;
}

function sanitizeUsername(username: string): string {
  return username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15) || "user";
}

function buildTicketButtons(claimed = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel(claimed ? "Claimed" : "Claim")
      .setEmoji("🙋")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(claimed),
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Close")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("ticket_close_reason")
      .setLabel("Close with Reason")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Secondary),
  );
}

// ─── Select Menu: Open Ticket ─────────────────────────────────────────────────

export async function handleTicketSelect(interaction: StringSelectMenuInteraction): Promise<void> {
  const value = interaction.values[0];
  if (!isTicketType(value)) return;

  const typeInfo = TICKET_TYPES[value];
  const guild = interaction.guild;
  const member = interaction.member as GuildMember;

  if (!guild || !member) {
    await interaction.reply({ content: "This can only be used in a server.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Prevent duplicate open tickets of the same type
    const existing = await getUserOpenTicket(guild.id, member.id, value);
    if (existing) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription(
              `❌ You already have an open **${typeInfo.label}** ticket: <#${existing.channelId}>\n\nPlease use that ticket or close it first.`,
            ),
        ],
      });
      return;
    }

    // Look up the configured staff role for this ticket type
    const staffRoleId = await getTicketStaffRole(guild.id, value);

    // Build permission overrides
    const permissionOverwrites: {
      id: string;
      allow?: bigint[];
      deny?: bigint[];
    }[] = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ];

    if (staffRoleId) {
      permissionOverwrites.push({
        id: staffRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageMessages,
        ],
      });
    }

    // Create the ticket channel inside the correct category
    const channelName = `${typeInfo.channelPrefix}-${sanitizeUsername(member.user.username)}`;

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: typeInfo.categoryId,
      permissionOverwrites,
      topic: `${typeInfo.emoji} ${typeInfo.label} — Opened by ${member.user.tag}`,
    });

    // Save to DB
    await createTicketRecord(channel.id, guild.id, member.id, member.user.username, value);

    // Build welcome embed
    const welcomeEmbed = new EmbedBuilder()
      .setColor(typeInfo.color)
      .setTitle(`${typeInfo.emoji}  ${typeInfo.label} — RUNCANDELS Support`)
      .setDescription(
        [
          `Hey <@${member.id}>, thanks for reaching out!`,
          "",
          `**Ticket Type:** ${typeInfo.label}`,
          `**Topic:** ${typeInfo.description}`,
          "",
          "Please describe your issue in as much detail as possible. A staff member will assist you shortly.",
          "",
          "> 📌 We are not online 24/7. Please be patient — we'll get to you as soon as possible.",
        ].join("\n"),
      )
      .setFooter({ text: "RUNCANDELS Support • Use the buttons below to manage this ticket" })
      .setTimestamp();

    const buttons = buildTicketButtons();

    const pingContent = staffRoleId
      ? `<@${member.id}> | <@&${staffRoleId}>`
      : `<@${member.id}>`;

    await channel.send({ content: pingContent, embeds: [welcomeEmbed], components: [buttons] });

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(typeInfo.color)
          .setDescription(`${typeInfo.emoji} Ticket created! Head over to <#${channel.id}>.`),
      ],
    });

    logger.info({ userId: member.id, ticketType: value, channelId: channel.id }, "Ticket created");
  } catch (err) {
    logger.error({ err }, "Failed to create ticket");
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription("❌ Failed to create ticket. Please contact an admin."),
      ],
    }).catch(() => null);
  }
}

// ─── Button: Claim ────────────────────────────────────────────────────────────

export async function handleTicketClaim(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember;

  if (!member?.roles.cache.has(STAFF_ROLE)) {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xED4245).setDescription("❌ Only staff members can claim tickets.")],
      ephemeral: true,
    });
    return;
  }

  const ticket = await getTicketByChannel(interaction.channelId);
  if (!ticket) {
    await interaction.reply({ content: "This ticket was not found in the database.", ephemeral: true });
    return;
  }

  if (ticket.status === "claimed") {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xFEE75C)
          .setDescription(`⚠️ This ticket is already claimed by <@${ticket.claimedBy}>.`),
      ],
      ephemeral: true,
    });
    return;
  }

  await claimTicket(interaction.channelId, member.id);

  const typeInfo = isTicketType(ticket.ticketType) ? TICKET_TYPES[ticket.ticketType] : null;

  // Disable the claim button on the original message
  if (interaction.message.editable) {
    const disabledRow = buildTicketButtons(true);
    await interaction.message.edit({ components: [disabledRow] }).catch(() => null);
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(typeInfo?.color ?? 0x57F287)
        .setTitle("🙋 Ticket Claimed")
        .setDescription(
          `This ticket has been claimed by <@${member.id}>.\nOpener: <@${ticket.userId}>\n\nA response is on the way!`,
        )
        .setFooter({ text: "RUNCANDELS Support" })
        .setTimestamp(),
    ],
  });
}

// ─── Button: Close ────────────────────────────────────────────────────────────

export async function handleTicketClose(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const ticket = await getTicketByChannel(interaction.channelId);

  if (!ticket) {
    await interaction.reply({ content: "Ticket not found.", ephemeral: true });
    return;
  }

  const isOpener = member.id === ticket.userId;
  const isStaff = member.roles.cache.has(STAFF_ROLE);

  if (!isOpener && !isStaff) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription("❌ Only the ticket opener or staff can close this ticket."),
      ],
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🔒 Ticket Closing")
        .setDescription(
          `This ticket has been closed by <@${member.id}>.\nChannel will be deleted in **5 seconds**.`,
        )
        .setFooter({ text: "RUNCANDELS Support" })
        .setTimestamp(),
    ],
  });

  await deleteTicketRecord(interaction.channelId).catch(() => null);

  setTimeout(() => {
    interaction.channel?.delete().catch(() => null);
  }, 5000);
}

// ─── Button: Close with Reason (opens modal) ─────────────────────────────────

export async function handleTicketCloseReason(interaction: ButtonInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const ticket = await getTicketByChannel(interaction.channelId);

  if (!ticket) {
    await interaction.reply({ content: "Ticket not found.", ephemeral: true });
    return;
  }

  const isOpener = member.id === ticket.userId;
  const isStaff = member.roles.cache.has(STAFF_ROLE);

  if (!isOpener && !isStaff) {
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription("❌ Only the ticket opener or staff can close this ticket."),
      ],
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId("ticket_close_reason_modal")
    .setTitle("Close Ticket with Reason");

  const reasonInput = new TextInputBuilder()
    .setCustomId("ticket_reason_input")
    .setLabel("Reason for closing this ticket")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("e.g. Issue resolved, duplicate ticket, no response from user...")
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(1000);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
  await interaction.showModal(modal);
}

// ─── Modal Submit: Close with Reason ─────────────────────────────────────────

export async function handleTicketCloseReasonModal(interaction: ModalSubmitInteraction): Promise<void> {
  const reason = interaction.fields.getTextInputValue("ticket_reason_input");
  const member = interaction.member as GuildMember;

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle("🔒 Ticket Closed")
        .setDescription(
          [
            `Closed by <@${member.id}>`,
            "",
            "**Reason:**",
            reason,
            "",
            "Channel will be deleted in **5 seconds**.",
          ].join("\n"),
        )
        .setFooter({ text: "RUNCANDELS Support" })
        .setTimestamp(),
    ],
  });

  await deleteTicketRecord(interaction.channelId).catch(() => null);

  setTimeout(() => {
    interaction.channel?.delete().catch(() => null);
  }, 5000);
}
