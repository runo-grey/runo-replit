import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  ChannelType,
  AutoModerationRuleTriggerType,
  AutoModerationActionType,
  AutoModerationRuleEventType,
} from "discord.js";
import { logger } from "../../lib/logger.js";
import { setAutomodLogChannel } from "../db.js";

const ADMIN_ROLE_ID = "1480151118276202649";
const RULE_NAME = "Runo AutoMod — Bad Words";

// Bad words — wrapped in * wildcards so Discord matches them anywhere in a message
// e.g. *fuck* catches "fucking", "motherfucker", "what the fuck", etc.
const BAD_WORDS = [
  "*nigger*", "*nigga*", "*faggot*", "*fag*", "*retard*",
  "*kike*", "*spic*", "*chink*", "*gook*", "*wetback*", "*coon*",
  "*tranny*", "*shemale*", "*dyke*",
  "*fuck*", "*shit*", "*bitch*", "*cunt*", "*pussy*", "*cock*", "*dick*",
  "*bastard*", "*whore*", "*slut*", "*motherfucker*", "*asshole*", "*prick*",
  "*jackass*", "*douchebag*",
];

export async function handleSetAutomod(i: ChatInputCommandInteraction): Promise<void> {
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

  const channel = i.options.getChannel("channel", true);
  if (channel.type !== ChannelType.GuildText) {
    await i.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xE74C3C)
          .setDescription("❌ Please select a text channel."),
      ],
      ephemeral: true,
    });
    return;
  }

  await i.deferReply();

  const guild = i.guild!;

  try {
    // Check if a rule with this name already exists — update it instead of creating a duplicate
    const existing = await guild.autoModerationRules.fetch();
    const existingRule = existing.find(r => r.name === RULE_NAME);

    if (existingRule) {
      await existingRule.edit({
        actions: [{ type: AutoModerationActionType.BlockMessage }],
        enabled: true,
      });
      logger.info({ guildId: guild.id }, "AutoMod rule updated");
    } else {
      await guild.autoModerationRules.create({
        name: RULE_NAME,
        eventType: AutoModerationRuleEventType.MessageSend,
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: { keywordFilter: BAD_WORDS },
        actions: [{ type: AutoModerationActionType.BlockMessage }],
        enabled: true,
      });
      logger.info({ guildId: guild.id }, "AutoMod rule created");
    }

    // Save the log channel in DB (used for any future reference)
    await setAutomodLogChannel(guild.id, channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle("🛡️ Discord AutoMod Activated")
      .setDescription(
        `Discord's native AutoMod rule has been ${existingRule ? "updated" : "created"} and is now active.\n\n` +
        `Bad messages will be **automatically blocked by Discord** before anyone sees them.\n` +
        `Logs and warnings will be sent to <#${channel.id}>.`
      )
      .addFields(
        { name: "Log Channel", value: `<#${channel.id}>`, inline: true },
        { name: "Keywords", value: `${BAD_WORDS.length} words`, inline: true },
        { name: "Set by", value: `<@${i.user.id}>`, inline: true },
      )
      .setFooter({ text: "You can view and edit this rule in Server Settings → AutoMod" })
      .setTimestamp();

    await i.editReply({ embeds: [embed] });
  } catch (err) {
    logger.error({ err }, "Failed to create/update AutoMod rule");
    await i.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xE74C3C)
          .setTitle("❌ Failed to set up AutoMod")
          .setDescription(
            "Could not create the AutoMod rule. Make sure the bot has the **Manage Server** permission."
          ),
      ],
    });
  }
}
