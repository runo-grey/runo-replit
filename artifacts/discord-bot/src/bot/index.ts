import {
  Client,
  GatewayIntentBits,
  Partials,
  type Message,
  type ChatInputCommandInteraction,
  Events,
  ChannelType,
  EmbedBuilder,
} from "discord.js";
import { logger } from "../lib/logger.js";
import { getGuildSettings } from "./db.js";
import { registerSlashCommands } from "./register-commands.js";
import { handleBalance } from "./commands/balance.js";
import { handleDaily } from "./commands/daily.js";
import { handleWork } from "./commands/work.js";
import { handleSlots } from "./commands/slots.js";
import { handleCoinflip } from "./commands/coinflip.js";
import { handleBlackjack } from "./commands/blackjack.js";
import { handleLeaderboard } from "./commands/leaderboard.js";
import { handleShop } from "./commands/shop.js";
import { handleBuy } from "./commands/buy.js";
import { handleInventory } from "./commands/inventory.js";
import { handleGive } from "./commands/give.js";
import { handleRob } from "./commands/rob.js";
import { handleHelp } from "./commands/help.js";
import { handleGameSetup } from "./commands/gamesetup.js";
import { handleDeposit, handleWithdraw } from "./commands/bank.js";
import { handleRoulette } from "./commands/roulette.js";
import { handleDice } from "./commands/dice.js";
import { handleScratch } from "./commands/scratch.js";
import {
  handleUno,
  handleUnoStart,
  handleUnoPlay,
  handleUnoDraw,
  handleUnoHand,
  handleUnoLeave,
  handleUnoHelp,
} from "./commands/uno.js";
import { handleGiveRunos } from "./commands/giverunos.js";
import { handleUpdateEmbedAdded, handleUpdateEmbedRemoved } from "./commands/updateembed.js";
import { handleSetAutomod } from "./commands/setautomod.js";
import { handleWhitelist } from "./commands/whitelist.js";
import { handleSetAuditLogs } from "./commands/setauditlogs.js";
import { handleRank } from "./commands/rank.js";
import { handleSetRankChannel } from "./commands/setrankchannel.js";
import { handleXpLeaderboard, handleXpLeaderboardButton, XP_LB_CHANNEL } from "./commands/leaderboard-xp.js";
import { handleAutomodExecution } from "./automod.js";
import { handleMessageDelete, handleMessageUpdate } from "./messagelog.js";
import { errorEmbed } from "./embeds.js";
import { addXp, getLevelData, getRankChannelId } from "./db.js";
import { isOnXpCooldown, setXpCooldown, randomXp, calcLevel } from "./xp.js";
import { getRoleRewardForLevel } from "./levelRewards.js";

const PREFIX = "!";

async function isAllowedChannel(guildId: string | null, channelId: string): Promise<boolean> {
  if (!guildId) return true;
  const settings = await getGuildSettings(guildId);
  if (!settings?.gameChannelId) return true;
  return settings.gameChannelId === channelId;
}

export async function startBot(): Promise<void> {
  const token = process.env["DISCORD_BOT_TOKEN"] ?? process.env["DISCORD_TOKEN"];
  if (!token) {
    logger.error("DISCORD_BOT_TOKEN not set — bot will not start");
    return;
  }

  // Expose the token as DISCORD_TOKEN for discord.js's REST client used in register-commands
  process.env["DISCORD_TOKEN"] = token;

  await registerSlashCommands();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.AutoModerationConfiguration,
      GatewayIntentBits.AutoModerationExecution,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember],
  });

  client.once(Events.ClientReady, (c) => {
    logger.info(`Discord bot ready: ${c.user.tag}`);
  });

  // --- DISCORD NATIVE AUTOMOD: fires when Discord's built-in AutoMod blocks a message ---
  client.on(Events.AutoModerationActionExecution, async (execution) => {
    await handleAutomodExecution(execution).catch((err) => {
      logger.error({ err }, "AutoMod execution handler error");
    });
  });

  // --- MESSAGE LOGS: deleted & edited messages sent to webhook ---
  client.on(Events.MessageDelete, async (message) => {
    await handleMessageDelete(message).catch((err) => {
      logger.error({ err }, "Message delete log error");
    });
  });

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    await handleMessageUpdate(oldMessage, newMessage).catch((err) => {
      logger.error({ err }, "Message update log error");
    });
  });

  // --- XP GAIN: award XP for every message (with cooldown) ---
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    if (!message.guildId) return; // no XP in DMs

    const discordId = message.author.id;
    const username = message.author.username;
    const guildId = message.guildId;

    if (!isOnXpCooldown(discordId, guildId)) {
      setXpCooldown(discordId, guildId);
      const xpGain = randomXp();
      try {
        const { oldLevel, newLevel } = await addXp(discordId, guildId, username, xpGain, calcLevel);
        if (newLevel > oldLevel) {
          // Check every newly passed level for a role reward
          for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
            const rewardRoleId = getRoleRewardForLevel(lvl);
            if (rewardRoleId && message.guild) {
              try {
                const member = await message.guild.members.fetch(discordId);
                if (!member.roles.cache.has(rewardRoleId)) {
                  await member.roles.add(rewardRoleId);
                }
              } catch (roleErr) {
                logger.error({ err: roleErr }, `Failed to assign level ${lvl} role reward`);
              }
            }
          }

          // Level-up notification
          const rewardRoleId = getRoleRewardForLevel(newLevel);
          const rewardLine = rewardRoleId
            ? `\n🎖️ You've been given a new role: <@&${rewardRoleId}>`
            : "";

          await message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xffd700)
                .setTitle("🎉 Level Up!")
                .setDescription(
                  `Congrats <@${discordId}>! You've reached **Level ${newLevel}**! 🏅${rewardLine}\nKeep chatting to climb higher.`,
                )
                .setThumbnail(message.author.displayAvatarURL({ extension: "png" }))
                .setTimestamp(),
            ],
          }).catch(() => null);
        }
      } catch {
        // XP errors are non-critical; don't crash message handling
      }
    }

    // --- PREFIX COMMANDS ---
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();
    if (!command) return;

    // Admin commands bypass channel restriction
    const adminCommands = new Set(["giverunos", "gamesetup", "update-embed-added", "update-embed-removed", "set-automod", "whitelist", "set-audit-logs", "set-rank-channel"]);

    // Check channel restriction (skip for DMs, admin commands, and the XP leaderboard channel)
    if (
      message.channel.type === ChannelType.GuildText &&
      !adminCommands.has(command) &&
      message.channelId !== XP_LB_CHANNEL
    ) {
      const allowed = await isAllowedChannel(message.guildId, message.channelId);
      if (!allowed) {
        await message.reply({ embeds: [errorEmbed("Bot commands are restricted to a specific channel in this server.")] });
        return;
      }
    }

    try {
      switch (command) {
        case "balance":
        case "bal": {
          const mention = message.mentions.users.first();
          await handleBalance(message, mention?.id, mention?.username);
          break;
        }
        case "daily":
          await handleDaily(message);
          break;
        case "work":
          await handleWork(message);
          break;
        case "slots":
        case "slot":
          await handleSlots(message, args[0] ?? "");
          break;
        case "coinflip":
        case "cf":
          await handleCoinflip(message, args[0] ?? "", args[1] ?? "");
          break;
        case "blackjack":
        case "bj":
          await handleBlackjack(message, args[0] ?? "");
          break;
        case "leaderboard":
        case "lb":
          if (message.channelId === XP_LB_CHANNEL) {
            await handleXpLeaderboard(message, 0);
          } else {
            await handleLeaderboard(message);
          }
          break;
        case "shop":
          await handleShop(message);
          break;
        case "buy":
          await handleBuy(message, args.join(" "));
          break;
        case "inventory":
        case "inv":
          await handleInventory(message);
          break;
        case "give":
        case "pay": {
          const target = message.mentions.users.first();
          if (!target) {
            await message.reply({ embeds: [errorEmbed("Mention a user to give Runos to. e.g. `!give @user 100`")] });
            break;
          }
          await handleGive(message, target.id, target.username, args[1] ?? "");
          break;
        }
        case "rob": {
          const target = message.mentions.users.first();
          if (!target) {
            await message.reply({ embeds: [errorEmbed("Mention a user to rob. e.g. `!rob @user`")] });
            break;
          }
          await handleRob(message, target.id, target.username);
          break;
        }
        case "roulette":
        case "rl":
          await handleRoulette(message, args[0] ?? "", args[1] ?? "");
          break;
        case "dice":
          await handleDice(message, args[0] ?? "", args[1] ?? "");
          break;
        case "scratch":
        case "sc":
          await handleScratch(message, args[0] ?? "");
          break;
        case "uno":
          await handleUno(message);
          break;
        case "unostart":
          await handleUnoStart(message);
          break;
        case "unoplay":
          await handleUnoPlay(message, args.join(" "));
          break;
        case "unodraw":
          await handleUnoDraw(message);
          break;
        case "unohand":
          await handleUnoHand(message);
          break;
        case "unoleave":
          await handleUnoLeave(message);
          break;
        case "unohelp":
          await handleUnoHelp(message);
          break;
        case "giverunos": {
          const target = message.mentions.users.first();
          if (!target) {
            await message.reply({ embeds: [errorEmbed("Mention a user. e.g. `!giverunos @user 500`")] });
            break;
          }
          await handleGiveRunos(message, target.id, target.username, args[1] ?? "");
          break;
        }
        case "update-embed-added":
          await handleUpdateEmbedAdded(message, args.join(" "));
          break;
        case "update-embed-removed":
          await handleUpdateEmbedRemoved(message, args.join(" "));
          break;
        case "deposit":
        case "dep":
          await handleDeposit(message, args[0] ?? "");
          break;
        case "withdraw":
        case "with":
          await handleWithdraw(message, args[0] ?? "");
          break;
        case "rank": {
          const rankChannelId = message.guildId ? await getRankChannelId(message.guildId) : null;
          if (rankChannelId && message.channelId !== rankChannelId) {
            await message.reply({ embeds: [errorEmbed(`Rank commands can only be used in <#${rankChannelId}>.`)] });
            break;
          }
          const mention = message.mentions.users.first();
          await handleRank(
            message,
            mention?.id,
            mention?.username,
            mention?.displayName ?? mention?.username,
            mention?.displayAvatarURL({ extension: "png" }),
          );
          break;
        }
        case "set-rank-channel":
          await handleSetRankChannel(message);
          break;
        case "help":
          await handleHelp(message);
          break;
        default:
          break;
      }
    } catch (err) {
      logger.error({ err, command }, "Error handling prefix command");
      await message.reply({ embeds: [errorEmbed("Something went wrong. Please try again.")] }).catch(() => null);
    }
  });

  // --- BUTTON INTERACTIONS ---
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId.startsWith("lb_xp_p_")) {
      await handleXpLeaderboardButton(interaction).catch((err) => {
        logger.error({ err }, "XP leaderboard button handler error");
      });
    }
  });

  // --- SLASH COMMANDS ---
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const i = interaction as ChatInputCommandInteraction;

    // Admin commands bypass channel restriction
    const adminSlashCommands = new Set(["gamesetup", "giverunos", "update-embed-added", "update-embed-removed", "set-automod", "whitelist", "set-audit-logs", "set-rank-channel"]);
    if (!adminSlashCommands.has(i.commandName)) {
      const allowed = await isAllowedChannel(i.guildId, i.channelId);
      if (!allowed) {
        await i.reply({ embeds: [errorEmbed("Bot commands are restricted to a specific channel in this server.")], ephemeral: true });
        return;
      }
    }

    try {
      switch (i.commandName) {
        case "balance": {
          const user = i.options.getUser("user");
          await handleBalance(i, user?.id, user?.username);
          break;
        }
        case "daily":
          await handleDaily(i);
          break;
        case "work":
          await handleWork(i);
          break;
        case "slots":
          await handleSlots(i, i.options.getString("bet") ?? "");
          break;
        case "coinflip":
          await handleCoinflip(i, i.options.getString("bet") ?? "", i.options.getString("choice") ?? "");
          break;
        case "blackjack":
          await handleBlackjack(i, i.options.getString("bet") ?? "");
          break;
        case "leaderboard":
          await handleLeaderboard(i);
          break;
        case "shop":
          await handleShop(i);
          break;
        case "buy":
          await handleBuy(i, i.options.getString("item") ?? "");
          break;
        case "inventory":
          await handleInventory(i);
          break;
        case "give": {
          const user = i.options.getUser("user", true);
          await handleGive(i, user.id, user.username, i.options.getString("amount") ?? "");
          break;
        }
        case "rob": {
          const user = i.options.getUser("user", true);
          await handleRob(i, user.id, user.username);
          break;
        }
        case "roulette":
          await handleRoulette(i, i.options.getString("bet") ?? "", i.options.getString("on") ?? "");
          break;
        case "dice":
          await handleDice(i, i.options.getString("bet") ?? "", i.options.getString("on") ?? "");
          break;
        case "scratch":
          await handleScratch(i, i.options.getString("bet") ?? "");
          break;
        case "deposit":
          await handleDeposit(i, i.options.getString("amount") ?? "");
          break;
        case "withdraw":
          await handleWithdraw(i, i.options.getString("amount") ?? "");
          break;
        case "help":
          await handleHelp(i);
          break;
        case "uno":
          await handleUno(i);
          break;
        case "unostart":
          await handleUnoStart(i);
          break;
        case "unoplay":
          await handleUnoPlay(i, i.options.getString("card") ?? "");
          break;
        case "unodraw":
          await handleUnoDraw(i);
          break;
        case "unohand":
          await handleUnoHand(i);
          break;
        case "unoleave":
          await handleUnoLeave(i);
          break;
        case "unohelp":
          await handleUnoHelp(i);
          break;
        case "giverunos": {
          const user = i.options.getUser("user", true);
          await handleGiveRunos(i, user.id, user.username, String(i.options.getInteger("amount", true)));
          break;
        }
        case "update-embed-added":
          await handleUpdateEmbedAdded(i, i.options.getString("content", true));
          break;
        case "update-embed-removed":
          await handleUpdateEmbedRemoved(i, i.options.getString("content", true));
          break;
        case "set-automod":
          await handleSetAutomod(i);
          break;
        case "whitelist":
          await handleWhitelist(i);
          break;
        case "set-audit-logs":
          await handleSetAuditLogs(i);
          break;
        case "gamesetup":
          await handleGameSetup(i);
          break;
        case "rank": {
          const rankChannelId = i.guildId ? await getRankChannelId(i.guildId) : null;
          if (rankChannelId && i.channelId !== rankChannelId) {
            await i.reply({ embeds: [errorEmbed(`Rank commands can only be used in <#${rankChannelId}>.`)], ephemeral: true });
            break;
          }
          const user = i.options.getUser("user");
          await handleRank(
            i,
            user?.id,
            user?.username,
            user?.displayName ?? user?.username,
            user?.displayAvatarURL({ extension: "png" }),
          );
          break;
        }
        case "set-rank-channel":
          await handleSetRankChannel(i);
          break;
        default:
          break;
      }
    } catch (err) {
      logger.error({ err, command: i.commandName }, "Error handling slash command");
      const errEmbed = errorEmbed("Something went wrong. Please try again.");
      if (i.replied || i.deferred) {
        await i.editReply({ embeds: [errEmbed] }).catch(() => null);
      } else {
        await i.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
      }
    }
  });

  await client.login(token);
}
