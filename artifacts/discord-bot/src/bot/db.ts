import {
  db,
  usersTable,
  inventoryTable,
  guildSettingsTable,
  automodWarningsTable,
  levelsTable,
} from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import type {
  User,
  Inventory,
  GuildSettings,
  AutomodWarning,
  Level,
} from "@workspace/db";

// ─── Economy ──────────────────────────────────────────────────────────────────

export async function getOrCreateUser(discordId: string, username: string): Promise<User> {
  const existing = await db.select().from(usersTable).where(eq(usersTable.discordId, discordId)).limit(1);
  if (existing.length > 0) {
    if (existing[0].username !== username) {
      await db.update(usersTable).set({ username }).where(eq(usersTable.discordId, discordId));
      return { ...existing[0], username };
    }
    return existing[0];
  }
  const [user] = await db.insert(usersTable).values({ discordId, username, balance: 100, bank: 0 }).returning();
  return user;
}

export async function getUser(discordId: string): Promise<User | null> {
  const result = await db.select().from(usersTable).where(eq(usersTable.discordId, discordId)).limit(1);
  return result[0] ?? null;
}

export async function updateBalance(discordId: string, amount: number): Promise<void> {
  const user = await db.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.discordId, discordId)).limit(1);
  if (!user[0]) return;
  const newBalance = Math.max(0, user[0].balance + amount);
  await db.update(usersTable).set({ balance: newBalance }).where(eq(usersTable.discordId, discordId));
}

export async function setBalance(discordId: string, balance: number): Promise<void> {
  await db.update(usersTable).set({ balance: Math.max(0, balance) }).where(eq(usersTable.discordId, discordId));
}

export async function setLastDaily(discordId: string): Promise<void> {
  await db.update(usersTable).set({ lastDaily: new Date() }).where(eq(usersTable.discordId, discordId));
}

export async function setLastWork(discordId: string): Promise<void> {
  await db.update(usersTable).set({ lastWork: new Date() }).where(eq(usersTable.discordId, discordId));
}

export async function setLastRob(discordId: string): Promise<void> {
  await db.update(usersTable).set({ lastRob: new Date() }).where(eq(usersTable.discordId, discordId));
}

export async function getLeaderboard(limit = 10): Promise<User[]> {
  return db.select().from(usersTable).orderBy(desc(usersTable.balance)).limit(limit);
}

export async function getInventory(discordId: string): Promise<Inventory[]> {
  return db.select().from(inventoryTable).where(eq(inventoryTable.discordId, discordId));
}

export async function addInventoryItem(discordId: string, itemId: string): Promise<void> {
  const existing = await db.select().from(inventoryTable)
    .where(eq(inventoryTable.discordId, discordId))
    .limit(100);
  const found = existing.find(i => i.itemId === itemId);
  if (found) {
    await db.update(inventoryTable).set({ quantity: found.quantity + 1 })
      .where(eq(inventoryTable.id, found.id));
  } else {
    await db.insert(inventoryTable).values({ discordId, itemId, quantity: 1 });
  }
}

export async function hasItem(discordId: string, itemId: string): Promise<boolean> {
  const result = await db.select().from(inventoryTable)
    .where(eq(inventoryTable.discordId, discordId))
    .limit(100);
  return result.some(i => i.itemId === itemId && i.quantity > 0);
}

// ─── Guild Settings ───────────────────────────────────────────────────────────

export async function getGuildSettings(guildId: string): Promise<GuildSettings | null> {
  const result = await db.select().from(guildSettingsTable).where(eq(guildSettingsTable.guildId, guildId)).limit(1);
  return result[0] ?? null;
}

export async function setGameChannel(guildId: string, channelId: string): Promise<void> {
  const existing = await db.select().from(guildSettingsTable).where(eq(guildSettingsTable.guildId, guildId)).limit(1);
  if (existing.length > 0) {
    await db.update(guildSettingsTable).set({ gameChannelId: channelId }).where(eq(guildSettingsTable.guildId, guildId));
  } else {
    await db.insert(guildSettingsTable).values({ guildId, gameChannelId: channelId });
  }
}

export async function setAutomodLogChannel(guildId: string, channelId: string): Promise<void> {
  const existing = await db.select().from(guildSettingsTable).where(eq(guildSettingsTable.guildId, guildId)).limit(1);
  if (existing.length > 0) {
    await db.update(guildSettingsTable).set({ automodLogChannelId: channelId }).where(eq(guildSettingsTable.guildId, guildId));
  } else {
    await db.insert(guildSettingsTable).values({ guildId, automodLogChannelId: channelId });
  }
}

export async function setAuditLogChannel(guildId: string, channelId: string): Promise<void> {
  const existing = await db.select().from(guildSettingsTable).where(eq(guildSettingsTable.guildId, guildId)).limit(1);
  if (existing.length > 0) {
    await db.update(guildSettingsTable).set({ auditLogChannelId: channelId }).where(eq(guildSettingsTable.guildId, guildId));
  } else {
    await db.insert(guildSettingsTable).values({ guildId, auditLogChannelId: channelId });
  }
}

export async function setRankChannel(guildId: string, channelId: string): Promise<void> {
  const existing = await db.select().from(guildSettingsTable).where(eq(guildSettingsTable.guildId, guildId)).limit(1);
  if (existing.length > 0) {
    await db.update(guildSettingsTable).set({ rankChannelId: channelId }).where(eq(guildSettingsTable.guildId, guildId));
  } else {
    await db.insert(guildSettingsTable).values({ guildId, rankChannelId: channelId });
  }
}

export async function getRankChannelId(guildId: string): Promise<string | null> {
  const result = await db.select({ rankChannelId: guildSettingsTable.rankChannelId })
    .from(guildSettingsTable).where(eq(guildSettingsTable.guildId, guildId)).limit(1);
  return result[0]?.rankChannelId ?? null;
}

// ─── AutoMod Warnings ─────────────────────────────────────────────────────────

export async function addAutomodWarning(guildId: string, discordId: string, username: string): Promise<number> {
  const existing = await db.select().from(automodWarningsTable)
    .where(and(eq(automodWarningsTable.guildId, guildId), eq(automodWarningsTable.discordId, discordId)))
    .limit(1);
  if (existing.length > 0) {
    const newCount = existing[0].count + 1;
    await db.update(automodWarningsTable)
      .set({ count: newCount, username })
      .where(and(eq(automodWarningsTable.guildId, guildId), eq(automodWarningsTable.discordId, discordId)));
    return newCount;
  } else {
    await db.insert(automodWarningsTable).values({ guildId, discordId, username, count: 1 });
    return 1;
  }
}

export async function getAutomodWarnings(guildId: string, discordId: string): Promise<AutomodWarning | null> {
  const result = await db.select().from(automodWarningsTable)
    .where(and(eq(automodWarningsTable.guildId, guildId), eq(automodWarningsTable.discordId, discordId)))
    .limit(1);
  return result[0] ?? null;
}

// ─── XP / Leveling ───────────────────────────────────────────────────────────

/**
 * Get or create a level row for a user in a guild.
 */
export async function getLevelData(discordId: string, guildId: string, username: string): Promise<Level> {
  const existing = await db.select().from(levelsTable)
    .where(and(eq(levelsTable.discordId, discordId), eq(levelsTable.guildId, guildId)))
    .limit(1);
  if (existing.length > 0) {
    // Update username if changed
    if (existing[0].username !== username) {
      await db.update(levelsTable).set({ username })
        .where(and(eq(levelsTable.discordId, discordId), eq(levelsTable.guildId, guildId)));
      return { ...existing[0], username };
    }
    return existing[0];
  }
  const [row] = await db.insert(levelsTable).values({ discordId, guildId, username, xp: 0, level: 0 }).returning();
  return row;
}

/**
 * Add XP to a user and return { oldLevel, newLevel } so the caller can detect level-ups.
 */
export async function addXp(
  discordId: string,
  guildId: string,
  username: string,
  xpAmount: number,
  calcLevelFn: (xp: number) => { level: number },
): Promise<{ oldLevel: number; newLevel: number; totalXp: number }> {
  const row = await getLevelData(discordId, guildId, username);
  const oldLevel = row.level;
  const newTotalXp = row.xp + xpAmount;
  const { level: newLevel } = calcLevelFn(newTotalXp);

  await db.update(levelsTable)
    .set({ xp: newTotalXp, level: newLevel, lastXpGain: new Date(), username })
    .where(and(eq(levelsTable.discordId, discordId), eq(levelsTable.guildId, guildId)));

  return { oldLevel, newLevel, totalXp: newTotalXp };
}

/**
 * Get the rank (1-based position by XP) of a user in a guild.
 */
export async function getRankPosition(discordId: string, guildId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(levelsTable)
    .where(and(
      eq(levelsTable.guildId, guildId),
      sql`${levelsTable.xp} > (
        SELECT xp FROM levels WHERE discord_id = ${discordId} AND guild_id = ${guildId} LIMIT 1
      )`,
    ));
  return (result[0]?.count ?? 0) + 1;
}
