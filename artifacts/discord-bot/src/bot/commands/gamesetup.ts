import { type ChatInputCommandInteraction, EmbedBuilder, GuildMember, ChannelType } from "discord.js";
import { setGameChannel } from "../db.js";
import { Colors, errorEmbed } from "../embeds.js";

const ADMIN_ROLE_ID = "1480151118276202649";

export async function handleGameSetup(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
    await interaction.reply({ embeds: [errorEmbed("You don't have permission to use this command.")], ephemeral: true });
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
