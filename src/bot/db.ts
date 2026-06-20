import { db, usersTable, inventoryTable, guildSettingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import type { User, Inventory, GuildSettings } from "@workspace/db";

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
