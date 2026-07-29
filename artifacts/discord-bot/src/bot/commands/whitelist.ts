import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from "discord.js";
import { logger } from "../../lib/logger.js";

const ADMIN_ROLE_ID = "1480151118276202649";
const RULE_NAME = "Runo AutoMod — Bad Words";

export async function handleWhitelist(i: ChatInputCommandInteraction): Promise<void> {
  // Role check
  const member = i.member as GuildMember;
  if (!member.roles.cache.has(ADMIN_ROLE_ID)) {
    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xE74C3C)
          .setDescription("❌ You don't have permission to use this command."),
      ],
      ephemeral: true,
    });
    return;
  }

  const target = i.options.getUser("user", true);
  await i.deferReply();

  const guild = i.guild!;

  try {
    // Find the AutoMod rule
    const rules = await guild.autoModerationRules.fetch();
    const rule = rules.find(r => r.name === RULE_NAME);

    if (!rule) {
      await i.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle("❌ AutoMod Rule Not Found")
            .setDescription(
              "No AutoMod rule is set up yet. Run `/set-automod` first to create one, then whitelist users."
            ),
        ],
      });
      return;
    }

    // Check if user is already exempt
    if (rule.exemptUsers.has(target.id)) {
      await i.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xF39C12)
            .setTitle("⚠️ Already Whitelisted")
            .setDescription(`<@${target.id}> is already whitelisted — AutoMod already ignores their messages.`),
        ],
      });
      return;
    }

    // Add user to exempt list
    const updatedExemptUsers = [...rule.exemptUsers.keys(), target.id];
    await rule.edit({ exemptUsers: updatedExemptUsers });

    logger.info({ guildId: guild.id, userId: target.id, username: target.username }, "User whitelisted from AutoMod");

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle("✅ User Whitelisted")
      .setDescription(`<@${target.id}> has been whitelisted from AutoMod.\nAutoMod will no longer block or flag their messages.`)
      .addFields(
        { name: "User", value: `${target.username} (<@${target.id}>)`, inline: true },
        { name: "Whitelisted by", value: `<@${i.user.id}>`, inline: true },
        { name: "Total exempt users", value: `${updatedExemptUsers.length}`, inline: true },
      )
      .setThumbnail(target.displayAvatarURL())
      .setFooter({ text: "You can view this in Server Settings → AutoMod" })
      .setTimestamp();

    await i.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error({ err }, "Failed to whitelist user");
    await i.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle("❌ Failed to whitelist user")
          .setDescription("Make sure the bot has **Manage Server** permission."),
      ],
    });
  }
}
