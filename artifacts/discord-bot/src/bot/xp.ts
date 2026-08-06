/**
 * XP & Leveling system for Runo Bot
 *
 * Formula (MEE6-style): XP needed to go from level n → n+1 = 5n² + 50n + 100
 * - Level 0→1:  100 XP
 * - Level 1→2:  155 XP
 * - Level 5→6:  475 XP
 * - Level 10→11: 1100 XP
 */

/** XP required to advance FROM level `n` to `n+1` */
export function xpForLevel(n: number): number {
  return 5 * n * n + 50 * n + 100;
}

/** Calculate level and progress from total accumulated XP */
export function calcLevel(totalXp: number): { level: number; currentXp: number; xpForNext: number } {
  let level = 0;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { level, currentXp: remaining, xpForNext: xpForLevel(level) };
}

/** Random XP gain per message: 15–25 */
export function randomXp(): number {
  return Math.floor(Math.random() * 11) + 15;
}

// In-memory cooldown map: "discordId:guildId" → timestamp of last XP gain
const xpCooldowns = new Map<string, number>();
const XP_COOLDOWN_MS = 60_000; // 1 minute

export function isOnXpCooldown(discordId: string, guildId: string): boolean {
  const key = `${discordId}:${guildId}`;
  const last = xpCooldowns.get(key);
  return last !== undefined && Date.now() - last < XP_COOLDOWN_MS;
}

export function setXpCooldown(discordId: string, guildId: string): void {
  xpCooldowns.set(`${discordId}:${guildId}`, Date.now());
}
