# 🃏 Runo Bot

A Discord economy and gambling bot with Runos currency, multiplayer UNO, and admin tools!

## Features
- 💰 Economy: balance, daily, work, deposit, withdraw, give, rob
- 🎰 Games: slots, coinflip, blackjack, roulette, dice, scratch card
- 🃏 **Multiplayer UNO** (2–8 players, winner earns 2000 Runos!)
- 🏪 Shop & Inventory system
- 🏆 Leaderboard
- 🔐 Admin `/giverunos` command (role-restricted)

## Commands

| Command | Description |
|---------|-------------|
| `!balance` | Check wallet & bank |
| `!daily` | Claim daily 500 Runos |
| `!work` | Work for Runos (30m cooldown) |
| `!deposit / !withdraw` | Move Runos between wallet and bank |
| `!give @user <amount>` | Give Runos to someone |
| `!rob @user` | Rob someone (1h cooldown) |
| `!slots / !coinflip / !blackjack` | Gambling games |
| `!roulette / !dice / !scratch` | More gambling games |
| `!uno` | Create/join UNO game |
| `!unostart` | Start UNO (host only) |
| `!unoplay <card>` | Play a card |
| `!unodraw` | Draw a card |
| `!unohand` | See your hand privately |
| `!unoleave` | Leave UNO game |
| `!unohelp` / `/unohelp` | How to play UNO |
| `/giverunos @user <amount>` | **Admin**: give Runos (restricted role) |
| `/gamesetup channel` | Set bot channel (admin) |
| `/update-embed-added <content>` | **Admin**: post ✅ Added changelog |
| `/update-embed-removed <content>` | **Admin**: post ❌ Removed changelog |
| `/update-embed-updated <content>` | **Admin**: post 🔄 Updated changelog |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Application ID |
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | *(Optional)* HTTP server port — omit on Wispbyte |

---

## Deploy on Wispbyte

1. Go to [wispbyte.com](https://wispbyte.com) and create a new bot project
2. Connect this GitHub repo or upload the files
3. Set the **start command** to: `npm start`
4. Add env vars in the Wispbyte dashboard:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DATABASE_URL`
   - *(do **not** set `PORT` — the bot runs without an HTTP server on Wispbyte)*
5. Deploy!

> **Note:** You need an external PostgreSQL database (e.g. [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway](https://railway.app)) since Wispbyte doesn't provide one.

---

## Deploy on Render

1. Fork this repo
2. [render.com](https://render.com) → New Web Service → Connect GitHub → pick this repo
3. Render auto-reads `render.yaml`
4. Add env vars: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DATABASE_URL`
5. Deploy!

### Keep awake with UptimeRobot
- Monitor type: **HTTP(s)**
- URL: `https://your-app.onrender.com/healthz`
- Interval: **5 minutes**
