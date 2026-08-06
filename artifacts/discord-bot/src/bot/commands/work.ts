import { type Message, type ChatInputCommandInteraction } from "discord.js";
import { getOrCreateUser, updateBalance, setLastWork, hasItem } from "../db.js";
import { successEmbed, cooldownEmbed, formatCoins } from "../embeds.js";

const WORK_COOLDOWN = 30 * 60 * 1000;
const BASE_MIN = 100;
const BASE_MAX = 300;

const WORK_SCENARIOS = [
  "You worked as a street musician and earned",
  "You delivered pizzas all evening and earned",
  "You coded a freelance website and earned",
  "You washed dishes at the diner and earned",
  "You drove for a rideshare company and earned",
  "You sold lemonade on a hot day and earned",
  "You tutored a student in math and earned",
  "You walked dogs around the neighborhood and earned",
  "You fixed a neighbor's computer and earned",
  "You stocked shelves overnight and earned",
];

export async function handleWork(source: Message | ChatInputCommandInteraction): Promise<void> {
  const discordId = "author" in source ? source.author.id : source.user.id;
  const username = "author" in source ? source.author.username : source.user.username;

  const user = await getOrCreateUser(discordId, username);

  if (user.lastWork) {
    const elapsed = Date.now() - new Date(user.lastWork).getTime();
    if (elapsed < WORK_COOLDOWN) {
      const embed = cooldownEmbed("work", WORK_COOLDOWN - elapsed);
      await source.reply({ embeds: [embed] });
      return;
    }
  }

  let amount = Math.floor(Math.random() * (BASE_MAX - BASE_MIN + 1)) + BASE_MIN;

  const hasBriefcase = await hasItem(discordId, "briefcase");
  if (hasBriefcase) amount = Math.floor(amount * 1.25);

  const scenario = WORK_SCENARIOS[Math.floor(Math.random() * WORK_SCENARIOS.length)];

  await updateBalance(discordId, amount);
  await setLastWork(discordId);

  const embed = successEmbed(
    "💼 Work",
    `${scenario} ${formatCoins(amount)}!\nYou can work again in **30 minutes**.`,
  );

  await source.reply({ embeds: [embed] });
}
