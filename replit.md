# Runo Bot

A Discord economy + UNO bot with XP levelling, gambling mini-games, automod, and audit logging.

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

- `artifacts/discord-bot/src/bot/` — all bot logic (commands, XP, automod, etc.)
- `artifacts/discord-bot/src/bot/commands/` — one file per command handler
- `lib/db/src/schema/economy.ts` — all DB table definitions (source of truth)
- GitHub source: https://github.com/runo-grey/runo-replit

## Architecture decisions

- Bot uses both prefix commands (`!`) and slash commands (35 registered)
- Economy tables: `economy_users`, `economy_inventory`, `guild_settings`, `automod_warnings`, `levels`
- XP gain is in-memory with cooldown; all economy data persisted in Postgres via Drizzle ORM
- Bot + Express health server run together in `artifacts/discord-bot` (port 10000)

## Deploy on Render

- Economy: balance, bank, daily, work, give, rob, leaderboard
- Gambling: slots, coinflip, blackjack, roulette, dice, scratch
- Games: UNO (multi-player in-channel)
- XP & Levels: per-guild XP with cooldown, level-up announcements, role rewards
- Admin: automod logging, audit logs, game channel restriction, rank channel setup

## User preferences

- GitHub repo: https://github.com/runo-grey/runo-replit (public)

## Gotchas

- Run `pnpm --filter @workspace/db run push` after any schema change in `lib/db/src/schema/economy.ts`
- Bot token env var is `DISCORD_BOT_TOKEN`; the code also accepts `DISCORD_TOKEN` as fallback
- Restart the "Discord Bot" workflow after code changes

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
