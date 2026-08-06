# Runo Bot

A Discord economy + UNO bot with Runos currency, gambling games, a shop, and multiplayer UNO.

## Features
- 💰 Economy: balance, daily, work, give, rob, bank (deposit/withdraw)
- 🎰 Gambling: slots, coinflip, blackjack, roulette, dice, scratch cards
- 🛒 Shop & inventory system with items that affect gameplay
- 🃏 Multiplayer UNO game (2–8 players)
- 🏆 Leaderboard (wallet + bank net worth)
- 🔐 Admin commands: /giverunos, /gamesetup, /update-embed-added, /update-embed-removed

## Setup

### Requirements
- Node.js 20+
- PostgreSQL database

### Environment Variables
```
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_app_id
DATABASE_URL=postgresql://user:password@host:5432/dbname
PORT=10000
```

### Run locally
```bash
npm install
npm run dev
```

## Deploy on Render

1. Fork or push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo — Render auto-detects `render.yaml`
4. Add your env vars: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DATABASE_URL`
5. Click Deploy

> **Keep the bot alive on Render free tier:** use [UptimeRobot](https://uptimerobot.com) to ping `/healthz` every 5 minutes.

## Commands

All commands work with both `!` prefix and `/` slash syntax.

| Command | Description |
|---|---|
| `!balance [@user]` | Check wallet & bank |
| `!daily` | Claim daily 500 Runos (24h cooldown) |
| `!work` | Earn 100–300 Runos (30m cooldown) |
| `!give @user amount` | Send Runos to someone |
| `!rob @user` | Steal Runos (1h cooldown) |
| `!deposit amount` | Put Runos in bank |
| `!withdraw amount` | Take Runos from bank |
| `!slots bet` | Spin the slots |
| `!coinflip bet heads/tails` | Coin flip |
| `!blackjack bet` | Blackjack vs dealer |
| `!roulette bet choice` | Roulette wheel |
| `!dice bet guess` | Dice roll (1–6) |
| `!scratch bet` | Scratch card |
| `!shop` | Browse items |
| `!buy item` | Buy an item |
| `!inventory` | View your items |
| `!leaderboard` | Top 10 richest players |
| `!uno` | Join/create UNO game |
| `!unostart` | Start UNO (host only) |
| `!unoplay card [color]` | Play a UNO card |
| `!unodraw` | Draw a card |
| `!unohand` | See your hand |
| `!unoleave` | Leave UNO game |
| `!unohelp` | UNO rules |
| `/giverunos @user amount` | Admin: give Runos |
| `/gamesetup #channel` | Admin: lock bot to channel |
| `/update-embed-added content` | Admin: post ✅ update |
| `/update-embed-removed content` | Admin: post ❌ update |
