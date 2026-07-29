import {
  pgTable,
  text,
  serial,
  bigint,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("economy_users", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  balance: bigint("balance", { mode: "number" }).notNull().default(0),
  bank: bigint("bank", { mode: "number" }).notNull().default(0),
  lastDaily: timestamp("last_daily", { withTimezone: true }),
  lastWork: timestamp("last_work", { withTimezone: true }),
  lastRob: timestamp("last_rob", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const inventoryTable = pgTable("economy_inventory", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  itemId: text("item_id").notNull(),
  quantity: bigint("quantity", { mode: "number" }).notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const guildSettingsTable = pgTable("guild_settings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  gameChannelId: text("game_channel_id"),
  automodLogChannelId: text("automod_log_channel_id"),
  auditLogChannelId: text("audit_log_channel_id"),
  rankChannelId: text("rank_channel_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const automodWarningsTable = pgTable("automod_warnings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  discordId: text("discord_id").notNull(),
  username: text("username").notNull(),
  count: integer("count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const levelsTable = pgTable("levels", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull(),
  guildId: text("guild_id").notNull(),
  username: text("username").notNull(),
  xp: bigint("xp", { mode: "number" }).notNull().default(0),
  level: integer("level").notNull().default(0),
  lastXpGain: timestamp("last_xp_gain", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ─── Inferred types ──────────────────────────────────────────────────────────

export type User = typeof usersTable.$inferSelect;
export type Inventory = typeof inventoryTable.$inferSelect;
export type GuildSettings = typeof guildSettingsTable.$inferSelect;
export type AutomodWarning = typeof automodWarningsTable.$inferSelect;
export type Level = typeof levelsTable.$inferSelect;

// ─── Insert schemas ───────────────────────────────────────────────────────────

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;

export const insertInventorySchema = createInsertSchema(inventoryTable).omit({ id: true, createdAt: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;

export const insertGuildSettingsSchema = createInsertSchema(guildSettingsTable).omit({ id: true, updatedAt: true });
export type InsertGuildSettings = z.infer<typeof insertGuildSettingsSchema>;

export const insertLevelSchema = createInsertSchema(levelsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLevel = z.infer<typeof insertLevelSchema>;
