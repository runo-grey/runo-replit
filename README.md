# 🃏 Runo Bot

A Discord economy and gambling bot with Runos currency and multiplayer UNO!

## Features
- 💰 Economy: balance, daily, work, deposit, withdraw, give, rob
- 🎰 Games: slots, coinflip, blackjack, roulette, dice, scratch card
- 🃏 **UNO**: Full multiplayer UNO (2–8 players)
- 🏪 Shop & Inventory system
- 🏆 Leaderboard

## Commands

### Prefix (`!`) and Slash (`/`) both work

| Command | Description |
|---------|-------------|
| `!balance` | Check wallet & bank |
| `!daily` | Claim daily 500 Runos |
| `!work` | Work for Runos (30m cooldown) |
| `!deposit <amount>` | Move Runos to bank |
| `!withdraw <amount>` | Move Runos to wallet |
| `!give @user <amount>` | Give Runos to someone |
| `!rob @user` | Rob someone (1h cooldown) |
| `!slots <bet>` | Spin the slots |
| `!coinflip <bet> heads/tails` | Flip a coin |
| `!blackjack <bet>` | Play blackjack |
| `!roulette <bet> <on>` | Play roulette |
| `!dice <bet> high/low/seven/doubles` | Roll dice |
| `!scratch <bet>` | Buy a scratch card |
| `!shop` | Browse item shop |
| `!buy <item>` | Buy an item |
| `!inventory` | View your items |
| `!leaderboard` | Top 10 richest |
| `!uno` | Create/join UNO game |
| `!unostart` | Start UNO (host only) |
| `!unoplay <card>` | Play a card in UNO |
| `!unodraw` | Draw a card in UNO |
| `!unohand` | See your UNO hand |
| `!unoleave` | Leave UNO game |
| `!unohelp` | How to play UNO |
| `/gamesetup channel` | Set bot channel (admin) |

## Deploy on Render

1. Fork this repo
2. Go to [render.com](https://render.com) → New Web Service → Connect GitHub
3. Select this repo — Render auto-reads `render.yaml`
4. Add env vars in Render dashboard:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DATABASE_URL`
5. Deploy!

### Keep it awake (UptimeRobot)
Render free tier sleeps after 15 min. Set up [UptimeRobot](https://uptimerobot.com):
- Monitor type: **HTTP(s)**
- URL: `https://your-app.onrender.com/healthz`
- Interval: **5 minutes**

This keeps the web service alive so the bot stays connected.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Application ID from Discord Developer Portal |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Auto-set by Render (default 10000) |

## Database

Requires PostgreSQL. The bot auto-creates tables on first run via Drizzle ORM.
Use any free Postgres provider: [Neon](https://neon.tech), [Supabase](https://supabase.com), etc.
