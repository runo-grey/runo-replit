import { db, ticketConfigTable, ticketsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export async function getTicketStaffRole(guildId: string, ticketType: string): Promise<string | null> {
  const result = await db.select().from(ticketConfigTable)
    .where(and(eq(ticketConfigTable.guildId, guildId), eq(ticketConfigTable.ticketType, ticketType)))
    .limit(1);
  return result[0]?.staffRoleId ?? null;
}

export async function setTicketStaffRole(guildId: string, ticketType: string, staffRoleId: string): Promise<void> {
  const existing = await db.select().from(ticketConfigTable)
    .where(and(eq(ticketConfigTable.guildId, guildId), eq(ticketConfigTable.ticketType, ticketType)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(ticketConfigTable).set({ staffRoleId }).where(eq(ticketConfigTable.id, existing[0].id));
  } else {
    await db.insert(ticketConfigTable).values({ guildId, ticketType, staffRoleId });
  }
}

export async function createTicketRecord(
  channelId: string, guildId: string, userId: string, username: string, ticketType: string,
) {
  const [ticket] = await db.insert(ticketsTable)
    .values({ channelId, guildId, userId, username, ticketType, status: "open" })
    .returning();
  return ticket;
}

export async function getTicketByChannel(channelId: string) {
  const result = await db.select().from(ticketsTable).where(eq(ticketsTable.channelId, channelId)).limit(1);
  return result[0] ?? null;
}

export async function getUserOpenTicket(guildId: string, userId: string, ticketType: string) {
  const result = await db.select().from(ticketsTable)
    .where(and(
      eq(ticketsTable.guildId, guildId),
      eq(ticketsTable.userId, userId),
      eq(ticketsTable.ticketType, ticketType),
    )).limit(1);
  return result[0] ?? null;
}

export async function claimTicket(channelId: string, claimedBy: string): Promise<void> {
  await db.update(ticketsTable).set({ status: "claimed", claimedBy }).where(eq(ticketsTable.channelId, channelId));
}

export async function deleteTicketRecord(channelId: string): Promise<void> {
  await db.delete(ticketsTable).where(eq(ticketsTable.channelId, channelId));
}
