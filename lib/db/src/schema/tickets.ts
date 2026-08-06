import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const ticketConfigTable = pgTable("ticket_config", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  ticketType: text("ticket_type").notNull(),
  staffRoleId: text("staff_role_id").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull().unique(),
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  ticketType: text("ticket_type").notNull(),
  status: text("status").notNull().default("open"), // 'open' | 'claimed' | 'closed'
  claimedBy: text("claimed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type TicketConfig = typeof ticketConfigTable.$inferSelect;
export type Ticket = typeof ticketsTable.$inferSelect;
