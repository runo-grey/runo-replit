import {
  Client,
  GatewayIntentBits,
  Partials,
  type Message,
  type ChatInputCommandInteraction,
  Events,
  ChannelType,
} from "discord.js";

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
import { errorEmbed } from "./embeds.js";

const PREFIX = "!";

async function isAllowedChannel(guildId: string | null, channelId: string): Promise<boolean> {
  if (!guildId) return true;
  const settings = await getGuildSettings(guildId);
  if (!settings?.gameChannelId) return true;
  return settings.gameChannelId === channelId;
}

export async function startBot(): Promise<void> {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) {
    console.error("DISCORD_TOKEN not set — bot will not start");
    return;
  }

  await registerSlashCommands();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`Discord bot ready: ${c.user.tag}`);
  });

  // --- PREFIX COMMANDS ---
  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase();
    if (!command) return;

    // Check channel restriction (skip for DMs)
    if (message.channel.type === ChannelType.GuildText) {
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
          await handleBalance(
            message,
            mention?.id,
            mention?.username,
          );
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
          await handleLeaderboard(message);
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
        case "deposit":
        case "dep":
          await handleDeposit(message, args[0] ?? "");
          break;
        case "withdraw":
        case "with":
          await handleWithdraw(message, args[0] ?? "");
          break;
        case "help":
          await handleHelp(message);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error({ err, command }, "Error handling prefix command");
      await message.reply({ embeds: [errorEmbed("Something went wrong. Please try again.")] }).catch(() => null);
    }
  });

  // --- SLASH COMMANDS ---
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const i = interaction as ChatInputCommandInteraction;

    // gamesetup is admin-only and always allowed
    if (i.commandName !== "gamesetup") {
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
        case "gamesetup":
          await handleGameSetup(i);
          break;
        default:
          break;
      }
    } catch (err) {
      console.error({ err, command: i.commandName }, "Error handling slash command");
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
