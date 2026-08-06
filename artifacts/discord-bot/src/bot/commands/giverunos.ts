import {
  type ChatInputCommandInteraction,
  type Message,
  EmbedBuilder,
  GuildMember,
} from "discord.js";
import { getOrCreateUser, updateBalance } from "../db.js";
import { Colors, errorEmbed, formatCoins } from "../embeds.js";

const ADMIN_ROLE_ID = "1480151118276202649";
const UNO_PRIZE = 2000;

function hasAdminRole(source: Message | ChatInputCommandInteraction): boolean {
  const member =
    "author" in source
      ? (source.member as GuildMember | null)
      : (source.member as GuildMember | null);
  if (!member) return false;
  return member.roles.cache.has(ADMIN_ROLE_ID);
}

export async function handleGiveRunos(
  source: Message | ChatInputCommandInteraction,
  targetId: string,
  targetUsername: string,
  amountStr: string,
): Promise<void> {
  if (!hasAdminRole(source)) {
    await source.reply({
      embeds: [errorEmbed("You don't have permission to use this command.")],
    });
    return;
  }

  const amount = parseInt(amountStr, 10);
  if (isNaN(amount) || amount <= 0) {
    await source.reply({
      embeds: [errorEmbed("Please provide a valid positive amount.")],
    });
    return;
  }

  if (amount > 1_000_000) {
    await source.reply({
      embeds: [errorEmbed("Maximum single grant is 🪙 **1,000,000** Runos.")],
    });
    return;
  }

  await getOrCreateUser(targetId, targetUsername);
  await updateBalance(targetId, amount);

  const issuerId =
    "author" in source ? source.author.id : source.user.id;
  const issuerName =
    "author" in source ? source.author.username : source.user.username;

  const embed = new EmbedBuilder()
    .setColor(Colors.gold)
    .setTitle("💸 Admin: Runos Granted")
    .setDescription(
      `**${issuerName}** granted ${formatCoins(amount)} to <@${targetId}>.`,
    )
    .addFields(
      { name: "Recipient", value: `<@${targetId}> (${targetUsername})`, inline: true },
      { name: "Amount", value: formatCoins(amount), inline: true },
    )
    .setFooter({ text: `Granted by ${issuerName}` })
    .setTimestamp();

  await source.reply({ embeds: [embed] });
}
