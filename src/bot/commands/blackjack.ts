import { type Message, type ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { getOrCreateUser, updateBalance } from "../db.js";
import { Colors, errorEmbed, formatCoins } from "../embeds.js";

const SUITS = ["♠️", "♥️", "♦️", "♣️"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

interface Card { rank: string; suit: string; }

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return deck.sort(() => Math.random() - 0.5);
}

function cardValue(rank: string): number {
  if (["J", "Q", "K"].includes(rank)) return 10;
  if (rank === "A") return 11;
  return parseInt(rank, 10);
}

function handValue(hand: Card[]): number {
  let total = hand.reduce((sum, c) => sum + cardValue(c.rank), 0);
  let aces = hand.filter(c => c.rank === "A").length;
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function formatHand(hand: Card[]): string {
  return hand.map(c => `\`${c.rank}${c.suit}\``).join(" ");
}

export async function handleBlackjack(
  source: Message | ChatInputCommandInteraction,
  betStr: string,
): Promise<void> {
  const discordId = "author" in source ? source.author.id : source.user.id;
  const username = "author" in source ? source.author.username : source.user.username;

  const user = await getOrCreateUser(discordId, username);
  const bet = parseInt(betStr, 10);

  if (isNaN(bet) || bet <= 0) {
    await source.reply({ embeds: [errorEmbed("Please provide a valid bet amount.")] });
    return;
  }
  if (bet > user.balance) {
    await source.reply({ embeds: [errorEmbed(`You don't have enough coins! You have ${formatCoins(user.balance)}.`)] });
    return;
  }
  if (bet < 10) {
    await source.reply({ embeds: [errorEmbed("Minimum bet is 🪙 **10** coins.")] });
    return;
  }

  const deck = createDeck();
  const playerHand: Card[] = [deck.pop()!, deck.pop()!];
  const dealerHand: Card[] = [deck.pop()!, deck.pop()!];

  // Dealer draws until 17+
  while (handValue(dealerHand) < 17) dealerHand.push(deck.pop()!);

  const playerVal = handValue(playerHand);
  const dealerVal = handValue(dealerHand);

  let outcome: "win" | "lose" | "push" | "blackjack";
  if (playerVal > 21) outcome = "lose";
  else if (playerVal === 21 && playerHand.length === 2) outcome = "blackjack";
  else if (dealerVal > 21 || playerVal > dealerVal) outcome = "win";
  else if (playerVal === dealerVal) outcome = "push";
  else outcome = "lose";

  let winnings = 0;
  let resultText = "";
  let color = Colors.blue;

  switch (outcome) {
    case "blackjack":
      winnings = Math.floor(bet * 1.5);
      await updateBalance(discordId, winnings);
      resultText = `**BLACKJACK!** You win ${formatCoins(winnings)}!`;
      color = Colors.purple;
      break;
    case "win":
      winnings = bet;
      await updateBalance(discordId, winnings);
      resultText = `You win! +${formatCoins(winnings)}`;
      color = Colors.green;
      break;
    case "push":
      resultText = "It's a tie! Your bet is returned.";
      color = Colors.blue;
      break;
    case "lose":
      await updateBalance(discordId, -bet);
      resultText = `You lose. -${formatCoins(bet)}`;
      color = Colors.red;
      break;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle("🃏 Blackjack")
    .addFields(
      { name: `Your Hand (${playerVal})`, value: formatHand(playerHand), inline: false },
      { name: `Dealer Hand (${dealerVal})`, value: formatHand(dealerHand), inline: false },
    )
    .setDescription(resultText)
    .setTimestamp();

  await source.reply({ embeds: [embed] });
}
