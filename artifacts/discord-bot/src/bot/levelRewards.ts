/**
 * Level-up role rewards for Runo Bot.
 * When a user reaches one of these levels, they are automatically given the mapped role.
 * The bot must have Manage Roles permission and its role must be above the reward roles.
 */
export const LEVEL_ROLE_REWARDS: Record<number, string> = {
  5:  "1485818597870796840",
  10: "1485817312098385950",
  20: "1485817682682183731",
  50: "1485817752965877790",
};

/**
 * Returns the role ID to award at the given level, or null if none.
 */
export function getRoleRewardForLevel(level: number): string | null {
  return LEVEL_ROLE_REWARDS[level] ?? null;
}
