import {
  type Message,
  type ButtonInteraction,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { getXpLeaderboard, getXpLeaderboardTotal } from "../db.js";
import { calcLevel } from "../xp.js";
import { logger } from "../../lib/logger.js";

// ─── Constants ────────────────────────────────────────────────────────────────

export const XP_LB_CHANNEL = "1514980713718612038";
const PAGE_SIZE = 10;

const W = 960;
const HEADER_H = 92;
const ROW_H = 60;
const FOOTER_H = 24;
const H = HEADER_H + PAGE_SIZE * ROW_H + FOOTER_H; // 92 + 600 + 24 = 716

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundRect(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  x: number, y: number, w: number, h: number,
  r: number | [number, number, number, number],
): void {
  const [tl, tr, br, bl] = typeof r === "number" ? [r, r, r, r] : r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}

const RANK_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"] as const;

// ─── Canvas builder ───────────────────────────────────────────────────────────

type Entry = {
  discordId: string;
  username: string;
  xp: number;
  displayName: string;
  avatarUrl: string | null;
};

async function buildLeaderboardImage(
  entries: Entry[],
  page: number,
  totalPages: number,
): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // ── Full background ───────────────────────────────────────────────────────
  ctx.fillStyle = "#030306";
  ctx.fillRect(0, 0, W, H);

  // Subtle scanline overlay
  ctx.fillStyle = "rgba(255,255,255,0.012)";
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 1);
  }

  // Radial center glow
  const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
  glow.addColorStop(0, "rgba(80,20,140,0.12)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Header ────────────────────────────────────────────────────────────────
  const hBg = ctx.createLinearGradient(0, 0, W, HEADER_H);
  hBg.addColorStop(0, "#0e0320");
  hBg.addColorStop(0.6, "#0a0618");
  hBg.addColorStop(1, "#050308");
  ctx.fillStyle = hBg;
  ctx.fillRect(0, 0, W, HEADER_H);

  // Left accent bar (gold → purple)
  const accentBar = ctx.createLinearGradient(0, 0, 0, HEADER_H);
  accentBar.addColorStop(0, "#FFD700");
  accentBar.addColorStop(1, "#7c3aed");
  ctx.fillStyle = accentBar;
  ctx.fillRect(0, 0, 6, HEADER_H);

  // Title
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText("XP LEADERBOARD", 26, 45);

  ctx.fillStyle = "#6655aa";
  ctx.font = "14px sans-serif";
  ctx.fillText("Earn XP by chatting  \u00B7  Updated live", 26, 70);

  // Page indicator
  ctx.textAlign = "right";
  ctx.fillStyle = "#7766cc";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(`PAGE ${page + 1} / ${totalPages}`, W - 22, 52);

  // Header bottom separator (gold → purple → fade)
  const sep = ctx.createLinearGradient(0, 0, W, 0);
  sep.addColorStop(0, "#FFD700");
  sep.addColorStop(0.4, "#7c3aed");
  sep.addColorStop(1, "rgba(4,3,6,0)");
  ctx.strokeStyle = sep;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H - 1);
  ctx.lineTo(W, HEADER_H - 1);
  ctx.stroke();

  // ── Avatar fetch ──────────────────────────────────────────────────────────
  const avatarImages = await Promise.all(
    entries.map(async (e) => {
      if (!e.avatarUrl) return null;
      try {
        const res = await fetch(`${e.avatarUrl}?size=64`);
        const buf = Buffer.from(await res.arrayBuffer());
        return await loadImage(buf);
      } catch {
        return null;
      }
    }),
  );

  // ── Rows ──────────────────────────────────────────────────────────────────
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const rank = page * PAGE_SIZE + i + 1;
    const rowY = HEADER_H + i * ROW_H;
    const cy = rowY + ROW_H / 2; // vertical center of row

    // Row tint
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.022)";
      ctx.fillRect(0, rowY, W, ROW_H);
    }

    // Top-3 left accent stripe
    if (rank <= 3) {
      ctx.fillStyle = RANK_COLORS[rank - 1];
      ctx.fillRect(0, rowY + 6, 3, ROW_H - 12);
    }

    // ── Rank badge ─────────────────────────────────────────────────────────
    const rankColor = rank <= 3 ? RANK_COLORS[rank - 1] : "#44446a";

    if (rank <= 3) {
      // Circle badge for top 3
      ctx.shadowColor = rankColor;
      ctx.shadowBlur = 8;
      ctx.fillStyle = rankColor + "22";
      ctx.beginPath();
      ctx.arc(36, cy, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = rankColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(36, cy, 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = rankColor;
    ctx.font = rank <= 3 ? "bold 20px sans-serif" : "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`#${rank}`, 36, cy + 6);

    // ── Avatar ─────────────────────────────────────────────────────────────
    const avCX = 96;
    const avR = 22;

    // Ring for top-3
    if (rank <= 3) {
      ctx.shadowColor = rankColor;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = rankColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(avCX, cy, avR + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (avatarImages[i]) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(avCX, cy, avR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImages[i]!, avCX - avR, cy - avR, avR * 2, avR * 2);
      ctx.restore();
    } else {
      // Fallback: gradient circle with initial
      const avFall = ctx.createRadialGradient(avCX, cy, 0, avCX, cy, avR);
      avFall.addColorStop(0, "#1a1040");
      avFall.addColorStop(1, "#0d0820");
      ctx.fillStyle = avFall;
      ctx.beginPath();
      ctx.arc(avCX, cy, avR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rankColor;
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText((entry.displayName[0] ?? entry.username[0] ?? "?").toUpperCase(), avCX, cy + 6);
    }

    // ── Name + tag ─────────────────────────────────────────────────────────
    const nameX = 130;

    ctx.textAlign = "left";
    ctx.fillStyle = rank <= 3 ? "#ffffff" : "#d8d8f0";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(entry.displayName.slice(0, 22), nameX, cy - 4);

    ctx.fillStyle = "#3e3e6a";
    ctx.font = "12px sans-serif";
    ctx.fillText(`@${entry.username.slice(0, 22)}`, nameX, cy + 14);

    // ── Level badge ────────────────────────────────────────────────────────
    const { level } = calcLevel(entry.xp);
    const lvlX = 358;
    const lvlBadgeW = 64;
    const lvlBadgeH = 22;

    const lvlBg = ctx.createLinearGradient(lvlX, 0, lvlX + lvlBadgeW, 0);
    lvlBg.addColorStop(0, "#1a0830");
    lvlBg.addColorStop(1, "#2a0f45");
    ctx.fillStyle = lvlBg;
    roundRect(ctx, lvlX, cy - lvlBadgeH / 2, lvlBadgeW, lvlBadgeH, 11);
    ctx.fill();

    ctx.strokeStyle = "#7c3aed44";
    ctx.lineWidth = 1;
    roundRect(ctx, lvlX, cy - lvlBadgeH / 2, lvlBadgeW, lvlBadgeH, 11);
    ctx.stroke();

    ctx.fillStyle = "#a855f7";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`LVL ${level}`, lvlX + lvlBadgeW / 2, cy + 5);

    // ── XP progress bar ────────────────────────────────────────────────────
    const barX = 440;
    const barW = 320;
    const barH = 10;
    const barY = cy - barH / 2;

    // Track
    ctx.fillStyle = "#0d0d1e";
    roundRect(ctx, barX, barY, barW, barH, 5);
    ctx.fill();

    ctx.strokeStyle = "#1a1a30";
    ctx.lineWidth = 1;
    roundRect(ctx, barX, barY, barW, barH, 5);
    ctx.stroke();

    // Fill
    const { currentXp, xpForNext } = calcLevel(entry.xp);
    const progress = xpForNext > 0 ? Math.min(currentXp / xpForNext, 1) : 1;
    if (progress > 0) {
      const fillW = Math.max(barW * progress, barH);
      const barFill = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      barFill.addColorStop(0, "#4a0d7a");
      barFill.addColorStop(0.6, "#7c3aed");
      barFill.addColorStop(1, rank <= 3 ? RANK_COLORS[rank - 1] : "#c084fc");
      ctx.fillStyle = barFill;
      roundRect(ctx, barX, barY, fillW, barH, 5);
      ctx.fill();

      // Shine
      const shine = ctx.createLinearGradient(barX, barY, barX, barY + barH);
      shine.addColorStop(0, "rgba(255,255,255,0.18)");
      shine.addColorStop(0.5, "rgba(255,255,255,0)");
      ctx.fillStyle = shine;
      roundRect(ctx, barX, barY, fillW, barH / 2, [5, 5, 0, 0]);
      ctx.fill();
    }

    // XP label under bar
    ctx.fillStyle = "#33334e";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${currentXp.toLocaleString()} / ${xpForNext.toLocaleString()} XP`, barX, barY + barH + 13);

    // ── Total XP ───────────────────────────────────────────────────────────
    ctx.textAlign = "right";
    ctx.fillStyle = rank <= 3 ? RANK_COLORS[rank - 1] : "#5555aa";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(`${entry.xp.toLocaleString()}`, W - 20, cy - 3);

    ctx.fillStyle = "#33334e";
    ctx.font = "11px sans-serif";
    ctx.fillText("total xp", W - 20, cy + 13);

    // ── Row separator ──────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, rowY + ROW_H);
    ctx.lineTo(W - 8, rowY + ROW_H);
    ctx.stroke();
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = HEADER_H + PAGE_SIZE * ROW_H;
  ctx.fillStyle = "#050308";
  ctx.fillRect(0, footerY, W, FOOTER_H);

  // Footer separator
  const footSep = ctx.createLinearGradient(0, 0, W, 0);
  footSep.addColorStop(0, "rgba(4,3,6,0)");
  footSep.addColorStop(0.5, "#7c3aed66");
  footSep.addColorStop(1, "rgba(4,3,6,0)");
  ctx.strokeStyle = footSep;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, footerY);
  ctx.lineTo(W, footerY);
  ctx.stroke();

  ctx.fillStyle = "#222240";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("RUNO  \u00B7  Server XP Rankings  \u00B7  Earn XP by chatting in any channel", W / 2, footerY + 16);

  return canvas.toBuffer("image/png");
}

// ─── Shared helper: fetch data + resolve members + build reply ────────────────

async function buildPage(
  guild: NonNullable<Message["guild"]>,
  guildId: string,
  page: number,
) {
  const total = await getXpLeaderboardTotal(guildId);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));

  const entries = await getXpLeaderboard(guildId, PAGE_SIZE, safePage * PAGE_SIZE);

  // Resolve display names + avatar URLs per member
  const memberData = new Map<string, { displayName: string; avatarUrl: string }>();
  for (const e of entries) {
    try {
      const member = await guild.members.fetch(e.discordId);
      memberData.set(e.discordId, {
        displayName: member.displayName,
        avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 64 }),
      });
    } catch { /* not in guild or fetch failed — use DB username */ }
  }

  const enriched: Entry[] = entries.map((e) => ({
    ...e,
    displayName: memberData.get(e.discordId)?.displayName ?? e.username,
    avatarUrl: memberData.get(e.discordId)?.avatarUrl ?? null,
  }));

  const buf = await buildLeaderboardImage(enriched, safePage, totalPages);
  const attachment = new AttachmentBuilder(buf, { name: "leaderboard.png" });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`lb_xp_p_${safePage - 1}_${guildId}`)
      .setLabel("◀  Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage === 0),
    new ButtonBuilder()
      .setCustomId(`lb_xp_p_${safePage + 1}_${guildId}`)
      .setLabel("Next  ▶")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(safePage >= totalPages - 1),
  );

  return { attachment, components: [row] };
}

// ─── Public handlers ──────────────────────────────────────────────────────────

export async function handleXpLeaderboard(source: Message, page = 0): Promise<void> {
  const { guildId, guild } = source;
  if (!guildId || !guild) return;

  try {
    const { attachment, components } = await buildPage(guild, guildId, page);
    await source.reply({ files: [attachment], components });
  } catch (err) {
    logger.error({ err }, "XP leaderboard error");
    await source.reply("❌ Failed to generate the leaderboard.").catch(() => null);
  }
}

export async function handleXpLeaderboardButton(interaction: ButtonInteraction): Promise<void> {
  // customId format: lb_xp_p_{page}_{guildId}
  const parts = interaction.customId.split("_");
  const page = parseInt(parts[3] ?? "0", 10);
  const guildId = parts[4];
  const guild = interaction.guild;
  if (!guild || !guildId || isNaN(page)) return;

  await interaction.deferUpdate();
  try {
    const { attachment, components } = await buildPage(guild, guildId, page);
    await interaction.editReply({ files: [attachment], components });
  } catch (err) {
    logger.error({ err }, "XP leaderboard button error");
  }
}
