export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  emoji: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: "fishing_rod",
    name: "Fishing Rod",
    description: "Used to go fishing for extra Runos",
    price: 500,
    emoji: "🎣",
  },
  {
    id: "pickaxe",
    name: "Pickaxe",
    description: "Mine for extra Runos when working",
    price: 800,
    emoji: "⛏️",
  },
  {
    id: "lucky_charm",
    name: "Lucky Charm",
    description: "Slightly improves gambling odds",
    price: 1500,
    emoji: "🍀",
  },
  {
    id: "shield",
    name: "Shield",
    description: "Protects 20% of your wallet from robbery",
    price: 1200,
    emoji: "🛡️",
  },
  {
    id: "briefcase",
    name: "Briefcase",
    description: "Increases work earnings by 25%",
    price: 2000,
    emoji: "💼",
  },
  {
    id: "gem",
    name: "Gem",
    description: "A rare gem. Worth a lot if sold.",
    price: 5000,
    emoji: "💎",
  },
];
