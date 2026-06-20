import { type ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ChannelType } from "discord.js";
import { setGameChannel } from "../db.js";
import { Colors, errorEmbed } from "../embeds.js";

export async function handleGameSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member;
  if (!member || !("permissions" in member)) {
    await interaction.reply({ embeds: [errorEmbed("Cannot check permissions.")], ephemeral: true });
    return;
  }

  const perms = typeof member.permissions === "string"
    ? BigInt(member.permissions)
    : member.permissions.valueOf();

  const isAdmin = (perms & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator
    || (perms & PermissionFlagsBits.ManageGuild) === PermissionFlagsBits.ManageGuild;

  if (!isAdmin) {
    await interaction.reply({ embeds: [errorEmbed("You need **Manage Server** or **Administrator** permissions.")], ephemeral: true });
    return;
  }

  const channel = interaction.options.getChannel("channel", true);

  if (channel.type !== ChannelType.GuildText) {
    await interaction.reply({ embeds: [errorEmbed("Please select a text channel.")], ephemeral: true });
    return;
  }

  if (!interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed("This command can only be used in a server.")], ephemeral: true });
    return;
  }

  await setGameChannel(interaction.guildId, channel.id);

  const embed = new EmbedBuilder()
    .setColor(Colors.teal)
    .setTitle("⚙️ Game Channel Set")
    .setDescription(`All economy bot commands will now only work in <#${channel.id}>.\n\nUse \`/gamesetup channel\` again to change it.`)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
