import {
  type Message,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { Colors, errorEmbed } from "../embeds.js";

// ─── Types ───────────────────────────────────────────────────────────────────

type CardColor = "red" | "yellow" | "green" | "blue";
type WildColor = "wild";
type AnyColor = CardColor | WildColor;
type CardValue =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "skip" | "reverse" | "draw2" | "wild" | "wilddraw4";

interface Card {
  color: AnyColor;
  value: CardValue;
}

interface UnoPlayer {
  id: string;
  username: string;
  hand: Card[];
  saidUno: boolean;
}

interface UnoGame {
  channelId: string;
  hostId: string;
  players: UnoPlayer[];
  deck: Card[];
  discard: Card[];
  currentIndex: number;
  direction: 1 | -1;
  phase: "waiting" | "playing" | "ended";
  pendingDraw: number;
  currentColor: CardColor;
}

// ─── In-Memory Store (per channel) ───────────────────────────────────────────

const games = new Map<string, UnoGame>();

// ─── Card Helpers ─────────────────────────────────────────────────────────────

const COLOR_EMOJI: Record<CardColor | WildColor, string> = {
  red:    "🔴",
  yellow: "🟡",
  green:  "🟢",
  blue:   "🔵",
  wild:   "🌈",
};

const EMBED_COLOR: Record<CardColor, number> = {
  red:    0xE74C3C,
  yellow: 0xF1C40F,
  green:  0x2ECC71,
  blue:   0x3498DB,
};

function cardLabel(card: Card): string {
  const e = COLOR_EMOJI[card.color];
  switch (card.value) {
    case "skip":      return `${e}⛔`;
    case "reverse":   return `${e}🔄`;
    case "draw2":     return `${e}+2`;
    case "wild":      return "🌈Wild";
    case "wilddraw4": return "🌈+4";
    default:          return `${e}${card.value}`;
  }
}

function handText(hand: Card[]): string {
  if (hand.length === 0) return "*(empty)*";
  return hand.map((c, i) => `\`${i + 1}\` ${cardLabel(c)}`).join("  ");
}

function makeDeck(): Card[] {
  const colors: CardColor[] = ["red", "yellow", "green", "blue"];
  const deck: Card[] = [];

  for (const color of colors) {
    deck.push({ color, value: "0" });
    for (let i = 0; i < 2; i++) {
      for (const v of ["1","2","3","4","5","6","7","8","9","skip","reverse","draw2"] as CardValue[]) {
        deck.push({ color, value: v });
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: "wild", value: "wild" });
    deck.push({ color: "wild", value: "wilddraw4" });
  }
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function drawCard(game: UnoGame): Card | undefined {
  if (game.deck.length === 0) {
    if (game.discard.length <= 1) return undefined;
    const top = game.discard.pop()!;
    game.deck = shuffle(game.discard);
    game.discard = [top];
  }
  return game.deck.pop();
}

function canPlay(card: Card, topCard: Card, currentColor: CardColor): boolean {
  if (card.color === "wild") return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

function nextIndex(game: UnoGame, skip = false): number {
  let idx = game.currentIndex + game.direction;
  idx = ((idx % game.players.length) + game.players.length) % game.players.length;
  if (skip) {
    idx = idx + game.direction;
    idx = ((idx % game.players.length) + game.players.length) % game.players.length;
  }
  return idx;
}

// ─── Embed Builders ───────────────────────────────────────────────────────────

function gameStateEmbed(game: UnoGame, extra?: string): EmbedBuilder {
  const top = game.discard[game.discard.length - 1];
  const current = game.players[game.currentIndex];
  const embedColor = EMBED_COLOR[game.currentColor] ?? Colors.purple;

  const orderStr = game.players
    .map((p, i) => {
      const arrow = i === game.currentIndex ? "▶️ " : "　";
      const unoTag = p.hand.length === 1 ? " 🔔**UNO!**" : "";
      return `${arrow}**${p.username}** — ${p.hand.length} card(s)${unoTag}`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(embedColor)
    .setTitle("🃏 Runo UNO")
    .addFields(
      { name: "Top Card", value: cardLabel(top), inline: true },
      { name: "Current Color", value: `${COLOR_EMOJI[game.currentColor]} ${game.currentColor.toUpperCase()}`, inline: true },
      { name: "Turn", value: `**${current.username}**`, inline: true },
      { name: "Players", value: orderStr },
    )
    .setFooter({ text: `🃏 Deck: ${game.deck.length} cards left  •  Type !unohand to see your hand` });

  if (extra) embed.setDescription(extra);
  if (game.pendingDraw > 0) {
    embed.addFields({ name: "⚠️ Stacked Draw", value: `Next player must draw **${game.pendingDraw}** cards or stack another!` });
  }
  return embed;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseColor(s: string): CardColor | null {
  const m: Record<string, CardColor> = { r: "red", red: "red", y: "yellow", yellow: "yellow", g: "green", green: "green", b: "blue", blue: "blue" };
  return m[s.toLowerCase()] ?? null;
}

function parseCardInput(input: string, hand: Card[]): { card: Card; chosenColor?: CardColor } | { error: string } {
  const parts = input.trim().toLowerCase().split(/\s+/);

  // Allow numeric index e.g. "3"
  const numIdx = parseInt(parts[0], 10);
  if (!isNaN(numIdx)) {
    const card = hand[numIdx - 1];
    if (!card) return { error: `No card at position ${numIdx}. You have ${hand.length} cards.` };
    let chosenColor: CardColor | undefined;
    if (card.color === "wild") {
      chosenColor = parseColor(parts[1] ?? "") ?? undefined;
      if (!chosenColor) return { error: "Wild card played — pick a color: `red`, `yellow`, `green`, or `blue`.\nExample: `!unoplay 3 red`" };
    }
    return { card, chosenColor };
  }

  // Alias shortcuts
  const colorMap: Record<string, CardColor> = { r: "red", y: "yellow", g: "green", b: "blue" };
  const valueAliases: Record<string, CardValue> = {
    s: "skip", skip: "skip",
    rev: "reverse", reverse: "reverse", r: "reverse",
    draw2: "draw2", "+2": "draw2", d2: "draw2",
    wild: "wild", w: "wild",
    wilddraw4: "wilddraw4", "wild4": "wilddraw4", "+4": "wilddraw4", wd4: "wilddraw4", "wild+4": "wilddraw4",
  };

  let color: AnyColor | null = null;
  let value: CardValue | null = null;
  let chosenColor: CardColor | undefined;

  const first = parts[0];

  // e.g. "wild4" "wd4" "+4"
  if (["wild", "w", "wd4", "wilddraw4", "wild4", "+4", "wild+4"].includes(first)) {
    color = "wild";
    value = first === "wild" || first === "w" ? "wild" : "wilddraw4";
    chosenColor = parseColor(parts[1] ?? "") ?? undefined;
    if (!chosenColor) return { error: "Wild card — pick a color: `red`, `yellow`, `green`, or `blue`.\nExample: `!unoplay wild red`" };
  } else {
    // try "r5", "rskip", "grev"
    const colorChar = first[0];
    const rest = first.slice(1);
    const shortColor = colorMap[colorChar] ?? null;

    if (shortColor && rest) {
      color = shortColor;
      value = (valueAliases[rest] ?? (["0","1","2","3","4","5","6","7","8","9"].includes(rest) ? rest as CardValue : null));
    } else {
      // try "red 5", "red skip", etc.
      color = parseColor(first) as AnyColor | null;
      if (color && color !== "wild") {
        const second = parts[1] ?? "";
        value = valueAliases[second] ?? (["0","1","2","3","4","5","6","7","8","9"].includes(second) ? second as CardValue : null);
      }
    }
  }

  if (!color || !value) {
    return { error: "Couldn't understand that card. Examples:\n`!unoplay r5` `!unoplay yellow skip` `!unoplay wild red` `!unoplay 3` (by position)" };
  }

  const idx = hand.findIndex(c => c.color === color && c.value === value);
  if (idx === -1) {
    const sought = `${color} ${value}`;
    return { error: `You don't have **${sought}** in your hand. Use \`!unohand\` to see your cards.` };
  }

  return { card: hand[idx], chosenColor };
}

// ─── Command Handlers ─────────────────────────────────────────────────────────

type Source = Message | ChatInputCommandInteraction;
function userId(src: Source) { return "author" in src ? src.author.id : src.user.id; }
function userName(src: Source) { return "author" in src ? src.author.username : src.user.username; }
function channelId(src: Source) { return src.channelId; }

async function reply(src: Source, options: Parameters<Source["reply"]>[0]) {
  if ("replied" in src && (src.replied || src.deferred)) {
    return (src as ChatInputCommandInteraction).editReply(options as never);
  }
  return src.reply(options as never);
}

// !uno / /uno — create or join
export async function handleUno(src: Source): Promise<void> {
  const uid = userId(src);
  const uname = userName(src);
  const cid = channelId(src);

  let game = games.get(cid);

  if (!game) {
    // Create new game
    game = {
      channelId: cid,
      hostId: uid,
      players: [{ id: uid, username: uname, hand: [], saidUno: false }],
      deck: shuffle(makeDeck()),
      discard: [],
      currentIndex: 0,
      direction: 1,
      phase: "waiting",
      pendingDraw: 0,
      currentColor: "red",
    };
    games.set(cid, game);

    const embed = new EmbedBuilder()
      .setColor(Colors.purple)
      .setTitle("🃏 UNO Game Created!")
      .setDescription(`**${uname}** started a game of UNO!\n\nOthers can join with \`!uno\`\nHost starts with \`!unostart\` (2–8 players)`)
      .addFields({ name: "Players (1/8)", value: `• ${uname} *(host)*` })
      .setFooter({ text: "Type /unohelp to learn how to play" });
    await reply(src, { embeds: [embed] });
    return;
  }

  if (game.phase !== "waiting") {
    await reply(src, { embeds: [errorEmbed("A game is already in progress in this channel!")] });
    return;
  }

  if (game.players.find(p => p.id === uid)) {
    await reply(src, { embeds: [errorEmbed("You're already in this game!")] });
    return;
  }

  if (game.players.length >= 8) {
    await reply(src, { embeds: [errorEmbed("This game is full (8 players max).")] });
    return;
  }

  game.players.push({ id: uid, username: uname, hand: [], saidUno: false });

  const embed = new EmbedBuilder()
    .setColor(Colors.teal)
    .setTitle("🃏 Player Joined!")
    .setDescription(`**${uname}** joined the UNO game!`)
    .addFields({
      name: `Players (${game.players.length}/8)`,
      value: game.players.map((p, i) => `• ${p.username}${i === 0 ? " *(host)*" : ""}`).join("\n"),
    })
    .setFooter({ text: `Host: ${game.players[0].username} — type !unostart to begin` });
  await reply(src, { embeds: [embed] });
}

// !unostart / /unostart
export async function handleUnoStart(src: Source): Promise<void> {
  const uid = userId(src);
  const cid = channelId(src);
  const game = games.get(cid);

  if (!game) {
    await reply(src, { embeds: [errorEmbed("No UNO game in this channel. Start one with `!uno`.")] });
    return;
  }
  if (game.phase !== "waiting") {
    await reply(src, { embeds: [errorEmbed("The game has already started!")] });
    return;
  }
  if (game.hostId !== uid) {
    await reply(src, { embeds: [errorEmbed("Only the host can start the game.")] });
    return;
  }
  if (game.players.length < 2) {
    await reply(src, { embeds: [errorEmbed("Need at least **2 players** to start. Others join with `!uno`.")] });
    return;
  }

  // Deal 7 cards each
  for (const player of game.players) {
    for (let i = 0; i < 7; i++) {
      const c = drawCard(game);
      if (c) player.hand.push(c);
    }
  }

  // First discard — must be a number card
  let firstCard = drawCard(game);
  while (firstCard && firstCard.color === "wild") {
    game.deck.unshift(firstCard);
    firstCard = drawCard(game);
  }
  if (!firstCard) firstCard = { color: "red", value: "5" };
  game.discard.push(firstCard);
  game.currentColor = firstCard.color as CardColor;
  game.phase = "playing";

  const handInstructions = game.players.map(p => `**${p.username}**: use \`!unohand\` to see your hand privately`).join("\n");

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR[game.currentColor])
    .setTitle("🃏 UNO — Game Started!")
    .setDescription(`Each player got **7 cards**. First card: **${cardLabel(firstCard)}**\n\n${handInstructions}`)
    .addFields(
      { name: "How to play a card", value: "`!unoplay red 5` or `!unoplay 3` (by position)" },
      { name: "How to draw", value: "`!unodraw`" },
    )
    .setFooter({ text: "Use !unohand to see your cards privately!" });

  await reply(src, { embeds: [embed] });

  // Post game state
  const stateEmbed = gameStateEmbed(game, `▶️ **${game.players[0].username}** goes first!`);
  await (src.channel?.send({ embeds: [stateEmbed] }) ?? Promise.resolve());
}

// !unohand / /unohand
export async function handleUnoHand(src: Source): Promise<void> {
  const uid = userId(src);
  const cid = channelId(src);
  const game = games.get(cid);

  if (!game || game.phase !== "playing") {
    await reply(src, { embeds: [errorEmbed("No UNO game running in this channel.")] });
    return;
  }

  const player = game.players.find(p => p.id === uid);
  if (!player) {
    await reply(src, { embeds: [errorEmbed("You're not in this game.")] });
    return;
  }

  const top = game.discard[game.discard.length - 1];
  const embed = new EmbedBuilder()
    .setColor(Colors.dark)
    .setTitle(`🃏 Your Hand — ${player.hand.length} card(s)`)
    .setDescription(handText(player.hand))
    .addFields({ name: "Top Card", value: cardLabel(top), inline: true }, { name: "Current Color", value: `${COLOR_EMOJI[game.currentColor]} ${game.currentColor}`, inline: true })
    .setFooter({ text: "Play: !unoplay <card or position>   •   Draw: !unodraw" });

  // For slash, send ephemeral; for prefix, just reply (only shows in channel)
  if ("replied" in src) {
    await (src as ChatInputCommandInteraction).reply({ embeds: [embed], ephemeral: true });
  } else {
    await (src as Message).reply({ embeds: [embed] });
  }
}

// !unoplay <card> / /unoplay card:<card>
export async function handleUnoPlay(src: Source, input: string): Promise<void> {
  const uid = userId(src);
  const uname = userName(src);
  const cid = channelId(src);
  const game = games.get(cid);

  if (!game || game.phase !== "playing") {
    await reply(src, { embeds: [errorEmbed("No UNO game running in this channel.")] });
    return;
  }

  const player = game.players.find(p => p.id === uid);
  if (!player) {
    await reply(src, { embeds: [errorEmbed("You're not in this game.")] });
    return;
  }

  if (game.players[game.currentIndex].id !== uid) {
    const current = game.players[game.currentIndex];
    await reply(src, { embeds: [errorEmbed(`It's **${current.username}**'s turn, not yours!`)] });
    return;
  }

  if (!input.trim()) {
    await reply(src, { embeds: [errorEmbed("Specify a card to play.\nExample: `!unoplay red 5` or `!unoplay 3`")] });
    return;
  }

  const parsed = parseCardInput(input, player.hand);
  if ("error" in parsed) {
    await reply(src, { embeds: [errorEmbed(parsed.error)] });
    return;
  }

  const { card, chosenColor } = parsed;
  const top = game.discard[game.discard.length - 1];

  // Handle stacked draw — can only play matching draw card or must draw
  if (game.pendingDraw > 0) {
    const isStackable =
      (card.value === "draw2" && top.value === "draw2") ||
      (card.value === "wilddraw4" && top.value === "wilddraw4") ||
      (card.value === "wilddraw4");
    if (!isStackable) {
      await reply(src, { embeds: [errorEmbed(`You must stack a draw card or \`!unodraw\` to take **${game.pendingDraw}** cards!`)] });
      return;
    }
  } else if (!canPlay(card, top, game.currentColor)) {
    await reply(src, { embeds: [errorEmbed(`Can't play **${cardLabel(card)}**! Must match color **${game.currentColor}** or value **${top.value}**.`)] });
    return;
  }

  // Remove card from hand
  const idx = player.hand.indexOf(card);
  player.hand.splice(idx, 1);
  game.discard.push(card);
  player.saidUno = false;

  // Check win
  if (player.hand.length === 0) {
    game.phase = "ended";
    games.delete(cid);
    const embed = new EmbedBuilder()
      .setColor(Colors.gold)
      .setTitle("🏆 UNO — We Have a Winner!")
      .setDescription(`🎉 **${uname}** played their last card and wins!\n\n${cardLabel(card)}`)
      .setFooter({ text: "Start a new game with !uno" })
      .setTimestamp();
    await reply(src, { embeds: [embed] });
    return;
  }

  // UNO alert
  const unoAlert = player.hand.length === 1 ? `\n\n🔔 **${uname}** has **UNO!**` : "";

  // Apply card effects
  let skipNext = false;
  let actionDesc = "";

  if (card.color === "wild") {
    game.currentColor = chosenColor!;
    if (card.value === "wilddraw4") {
      game.pendingDraw += 4;
      actionDesc = `🌈 Wild +4! Color → **${game.currentColor}**. Next player draws ${game.pendingDraw} or stacks!`;
    } else {
      actionDesc = `🌈 Wild! Color changed → **${game.currentColor}**`;
    }
  } else {
    game.currentColor = card.color as CardColor;
    switch (card.value) {
      case "skip":
        skipNext = true;
        actionDesc = `⛔ Skip! **${game.players[nextIndex(game)].username}** is skipped.`;
        break;
      case "reverse":
        game.direction = (game.direction === 1 ? -1 : 1) as 1 | -1;
        if (game.players.length === 2) { skipNext = true; actionDesc = `🔄 Reverse! (2 players = skip)`; }
        else actionDesc = `🔄 Reverse! Turn order flipped.`;
        break;
      case "draw2":
        game.pendingDraw += 2;
        actionDesc = `+2! Next player draws ${game.pendingDraw} cards or stacks!`;
        break;
    }
  }

  game.currentIndex = nextIndex(game, skipNext);

  // If next player must draw and didn't stack — handled on their !unodraw
  const nextPlayer = game.players[game.currentIndex];
  const description = `**${uname}** played **${cardLabel(card)}**!${actionDesc ? `\n${actionDesc}` : ""}${unoAlert}`;
  const stateEmbed = gameStateEmbed(game, description);
  await reply(src, { embeds: [stateEmbed] });
}

// !unodraw / /unodraw
export async function handleUnoDraw(src: Source): Promise<void> {
  const uid = userId(src);
  const uname = userName(src);
  const cid = channelId(src);
  const game = games.get(cid);

  if (!game || game.phase !== "playing") {
    await reply(src, { embeds: [errorEmbed("No UNO game running in this channel.")] });
    return;
  }

  const player = game.players.find(p => p.id === uid);
  if (!player) {
    await reply(src, { embeds: [errorEmbed("You're not in this game.")] });
    return;
  }

  if (game.players[game.currentIndex].id !== uid) {
    await reply(src, { embeds: [errorEmbed(`It's **${game.players[game.currentIndex].username}**'s turn!`)] });
    return;
  }

  const count = game.pendingDraw > 0 ? game.pendingDraw : 1;
  game.pendingDraw = 0;

  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    const c = drawCard(game);
    if (c) { player.hand.push(c); drawn.push(c); }
  }

  // Advance turn
  game.currentIndex = nextIndex(game);

  const embed = new EmbedBuilder()
    .setColor(Colors.orange)
    .setTitle(`🃏 ${uname} drew ${drawn.length} card(s)`)
    .setDescription(`**${uname}** drew **${drawn.length}** card(s). Use \`!unohand\` to see your hand.\n\nNow **${game.players[game.currentIndex].username}**'s turn.`)
    .setFooter({ text: `${uname} now has ${player.hand.length} card(s)` });

  await reply(src, { embeds: [embed] });
}

// !unoleave / /unoleave
export async function handleUnoLeave(src: Source): Promise<void> {
  const uid = userId(src);
  const uname = userName(src);
  const cid = channelId(src);
  const game = games.get(cid);

  if (!game) {
    await reply(src, { embeds: [errorEmbed("No UNO game in this channel.")] });
    return;
  }

  const idx = game.players.findIndex(p => p.id === uid);
  if (idx === -1) {
    await reply(src, { embeds: [errorEmbed("You're not in this game.")] });
    return;
  }

  // Return hand to deck
  game.deck.push(...game.players[idx].hand);
  game.deck = shuffle(game.deck);
  game.players.splice(idx, 1);

  if (game.players.length < 2) {
    games.delete(cid);
    const embed = new EmbedBuilder()
      .setColor(Colors.red)
      .setTitle("🃏 UNO Game Ended")
      .setDescription(`**${uname}** left. Not enough players — game over.\n\nStart a new game with \`!uno\`.`);
    await reply(src, { embeds: [embed] });
    return;
  }

  // Fix index if needed
  if (game.currentIndex >= game.players.length) game.currentIndex = 0;

  const embed = new EmbedBuilder()
    .setColor(Colors.orange)
    .setTitle(`🃏 ${uname} left the game`)
    .setDescription(`**${game.players.length}** player(s) remaining.\nIt's now **${game.players[game.currentIndex].username}**'s turn.`);
  await reply(src, { embeds: [embed] });
}

// /unohelp — how to play embed (also !unohelp)
export async function handleUnoHelp(src: Source): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(Colors.purple)
    .setTitle("🃏 How to Play Runo UNO")
    .setDescription("UNO is a multiplayer card game. Be the **first to empty your hand** to win!\n\u200b")
    .addFields(
      {
        name: "🚀 Starting a Game",
        value: [
          "`!uno` — Create a game or join one in this channel",
          "`!unostart` — Host starts when 2–8 players are ready",
        ].join("\n"),
      },
      {
        name: "🃏 Playing",
        value: [
          "`!unohand` — See your cards (only you can see this)",
          "`!unoplay red 5` — Play a Red 5",
          "`!unoplay 3` — Play card at position 3 in your hand",
          "`!unoplay wild red` — Play Wild and choose Red",
          "`!unoplay wd4 blue` — Play Wild Draw 4 and choose Blue",
          "`!unodraw` — Draw a card (or accept stacked draw penalty)",
          "`!unoleave` — Leave the game",
        ].join("\n"),
      },
      {
        name: "🎴 Card Shortcuts",
        value: [
          "`r5` = Red 5  •  `y skip` = Yellow Skip",
          "`g rev` = Green Reverse  •  `b +2` = Blue Draw 2",
          "`wild red` = Wild  •  `wd4 blue` = Wild Draw 4",
        ].join("\n"),
      },
      {
        name: "⚡ Special Cards",
        value: [
          "⛔ **Skip** — next player loses their turn",
          "🔄 **Reverse** — flip turn order (= skip in 2-player)",
          "**+2** — next player draws 2 (or stacks another +2!)",
          "🌈 **Wild** — change the color to anything",
          "🌈 **+4** — change color + next player draws 4 (stackable!)",
        ].join("\n"),
      },
      {
        name: "📋 Rules",
        value: [
          "• Match the **color** or **number/symbol** of the top card",
          "• Wild cards can always be played",
          "• You can stack +2 on +2 and +4 on +4 (or +4 on +2!)",
          "• When you have 1 card left the bot shows **🔔 UNO!**",
          "• First player to play all cards wins! 🏆",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Runo Bot • Runo UNO" })
    .setTimestamp();

  if ("replied" in src) {
    await (src as ChatInputCommandInteraction).reply({ embeds: [embed] });
  } else {
    await (src as Message).reply({ embeds: [embed] });
  }
}
