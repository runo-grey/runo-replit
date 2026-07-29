# Runo Bot

A Discord economy + UNO bot with Runos currency, gambling games, a shop, XP leveling, and multiplayer UNO.

## Run & Operate

- `pnpm --filter runo-bot run dev` — run the Discord bot (port 10000)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm install` — install all workspace packages

## Stack

- pnpm workspaces, Node.js 20+, TypeScript 5.x
- Discord: discord.js v14
- DB: PostgreSQL + Drizzle ORM (`lib/db`)
- Rank cards: `@napi-rs/canvas`
- HTTP keep-alive: Express 5 (`/healthz` endpoint for UptimeRobot)

## Where things live

- Bot source: `artifacts/discord-bot/src/bot/`
- Commands: `artifacts/discord-bot/src/bot/commands/`
- XP logic: `artifacts/discord-bot/src/bot/xp.ts`
- DB functions: `artifacts/discord-bot/src/bot/db.ts`
- Shared DB schema: `lib/db/src/schema/economy.ts`
- Logger: `artifacts/discord-bot/src/lib/logger.ts`

## Environment variables needed

| Key | Description |
|---|---|
| `DISCORD_BOT_TOKEN` | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Application / client ID |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | HTTP port (default 10000) |
| `AUTOMOD_WEBHOOK_URL` | Optional — webhook for automod logs |
| `AUDIT_LOGS_WEBHOOK_URL` | Optional — webhook for audit logs |

## DB Tables

- `economy_users` — wallets, bank, cooldowns
- `economy_inventory` — item ownership
- `guild_settings` — per-guild config (game channel, log channels)
- `automod_warnings` — warning counts per user per guild
- `levels` — XP, level, last XP gain per user per guild

## Architecture decisions

- Bot reads `DISCORD_BOT_TOKEN` (falls back to `DISCORD_TOKEN`) so Render deployments can use either name.
- XP cooldowns are stored in-memory (Map) — resets on restart, intentional to keep DB load low.
- Level formula: `5n² + 50n + 100` XP needed per level (MEE6 compatible).
- Rank card is generated with `@napi-rs/canvas` (pre-built Linux x64 binary, no libcairo needed).
- `@workspace/db` is the single source of truth for all table definitions; the bot's old local `src/schema/` is no longer used.

## Deploy on Render

See `artifacts/discord-bot/render.yaml` — connect repo, add env vars, deploy.

## User preferences

_Populate as you build._
