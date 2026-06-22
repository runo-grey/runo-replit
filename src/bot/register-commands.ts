import { REST, Routes, SlashCommandBuilder } from "discord.js";


const commands = [
  new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your wallet and bank balance")
    .addUserOption(opt => opt.setName("user").setDescription("Check another user's balance")),

  new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily reward of 500 Runos"),

  new SlashCommandBuilder()
    .setName("work")
    .setDescription("Work to earn Runos (30 minute cooldown)"),

  new SlashCommandBuilder()
    .setName("slots")
    .setDescription("Play the slot machine")
    .addStringOption(opt =>
      opt.setName("bet").setDescription("Amount to bet").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Flip a coin — double or nothing")
    .addStringOption(opt =>
      opt.setName("bet").setDescription("Amount to bet").setRequired(true),
    )
    .addStringOption(opt =>
      opt.setName("choice").setDescription("heads or tails").setRequired(true)
        .addChoices({ name: "Heads", value: "heads" }, { name: "Tails", value: "tails" }),
    ),

  new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("Play blackjack against the dealer")
    .addStringOption(opt =>
      opt.setName("bet").setDescription("Amount to bet").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Browse the item shop"),

  new SlashCommandBuilder()
    .setName("buy")
    .setDescription("Buy an item from the shop")
    .addStringOption(opt =>
      opt.setName("item").setDescription("Name of the item to buy").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("View your inventory"),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("See the top 10 richest players"),

  new SlashCommandBuilder()
    .setName("give")
    .setDescription("Give Runos to another player")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Who to give Runos to").setRequired(true),
    )
    .addStringOption(opt =>
      opt.setName("amount").setDescription("Amount to give").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("rob")
    .setDescription("Attempt to rob another player (1h cooldown)")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Who to rob").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("roulette")
    .setDescription("Bet on roulette — red/black/green/odd/even or a number 0–36")
    .addStringOption(opt =>
      opt.setName("bet").setDescription("Amount to bet").setRequired(true),
    )
    .addStringOption(opt =>
      opt.setName("on").setDescription("red | black | green | odd | even | 0–36").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("dice")
    .setDescription("Roll two dice — bet on high, low, seven, or doubles")
    .addStringOption(opt =>
      opt.setName("bet").setDescription("Amount to bet").setRequired(true),
    )
    .addStringOption(opt =>
      opt.setName("on").setDescription("high | low | seven | doubles").setRequired(true)
        .addChoices(
          { name: "High (8–12) — 2x", value: "high" },
          { name: "Low (2–6) — 2x",   value: "low"  },
          { name: "Seven (7) — 3x",    value: "seven" },
          { name: "Doubles — 5x",      value: "doubles" },
        ),
    ),

  new SlashCommandBuilder()
    .setName("scratch")
    .setDescription("Buy a scratch card — match 3+ symbols to win")
    .addStringOption(opt =>
      opt.setName("bet").setDescription("Amount to bet").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("deposit")
    .setDescription("Deposit Runos from your wallet into the bank (safe from robbery)")
    .addStringOption(opt =>
      opt.setName("amount").setDescription('Amount to deposit, or "all"').setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("withdraw")
    .setDescription("Withdraw Runos from your bank into your wallet")
    .addStringOption(opt =>
      opt.setName("amount").setDescription('Amount to withdraw, or "all"').setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all available commands"),

  new SlashCommandBuilder()
    .setName("uno")
    .setDescription("Create or join a UNO game in this channel"),

  new SlashCommandBuilder()
    .setName("unostart")
    .setDescription("Start the UNO game (host only)"),

  new SlashCommandBuilder()
    .setName("unoplay")
    .setDescription("Play a card in UNO")
    .addStringOption(opt =>
      opt.setName("card").setDescription('Card to play e.g. "red 5" "wild blue" "3" (position)').setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("unodraw")
    .setDescription("Draw a card in UNO (or take stacked draw penalty)"),

  new SlashCommandBuilder()
    .setName("unohand")
    .setDescription("See your UNO hand privately"),

  new SlashCommandBuilder()
    .setName("unoleave")
    .setDescription("Leave the current UNO game"),

  new SlashCommandBuilder()
    .setName("unohelp")
    .setDescription("Show how to play Runo UNO"),

  new SlashCommandBuilder()
    .setName("giverunos")
    .setDescription("Admin: give Runos to a user (restricted role only)")
    .addUserOption(opt =>
      opt.setName("user").setDescription("Who to give Runos to").setRequired(true),
    )
    .addIntegerOption(opt =>
      opt.setName("amount").setDescription("Amount of Runos to give").setRequired(true).setMinValue(1).setMaxValue(1000000),
    ),

  new SlashCommandBuilder()
    .setName("update-embed-added")
    .setDescription("Admin: post a ✅ Added update embed (restricted role only)")
    .addStringOption(opt =>
      opt.setName("content").setDescription("What was added").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("update-embed-removed")
    .setDescription("Admin: post a ❌ Removed update embed (restricted role only)")
    .addStringOption(opt =>
      opt.setName("content").setDescription("What was removed").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("update-embed-updated")
    .setDescription("Admin: post a 🔄 Updated update embed (restricted role only)")
    .addStringOption(opt =>
      opt.setName("content").setDescription("What was updated").setRequired(true),
    ),

  new SlashCommandBuilder()
    .setName("gamesetup")
    .setDescription("Admin: configure bot settings")
    .addSubcommand(sub =>
      sub.setName("channel")
        .setDescription("Set the channel where bot commands are allowed")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("The game channel").setRequired(true),
        ),
    ),
].map(cmd => cmd.toJSON());

export async function registerSlashCommands(): Promise<void> {
  const token = process.env["DISCORD_TOKEN"];
  const clientId = process.env["DISCORD_CLIENT_ID"];

  if (!token || !clientId) {
    console.error("DISCORD_TOKEN or DISCORD_CLIENT_ID not set — skipping slash command registration");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log(`Registered ${commands.length} slash commands`);
  } catch (err) {
    console.error({ err }, "Failed to register slash commands");
  }
}
