import { EmbedBuilder } from "discord.js";

export const Colors = {
  gold: 0xFFD700,
  green: 0x2ECC71,
  red: 0xE74C3C,
  blue: 0x3498DB,
  purple: 0x9B59B6,
  orange: 0xE67E22,
  teal: 0x1ABC9C,
  dark: 0x2C2F33,
};

export function successEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.green).setTitle(title).setDescription(description).setTimestamp();
}

export function errorEmbed(description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.red).setTitle("❌ Error").setDescription(description);
}

export function infoEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.blue).setTitle(title).setDescription(description).setTimestamp();
}

export function goldEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.gold).setTitle(title).setDescription(description).setTimestamp();
}

export function formatCoins(amount: number): string {
  return `🪙 **${amount.toLocaleString()}** Runos`;
}

export function cooldownEmbed(command: string, remainingMs: number): EmbedBuilder {
  const remaining = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0) parts.push(`${seconds}s`);
  return errorEmbed(`You can use \`${command}\` again in **${parts.join(" ")}**.`);
}
