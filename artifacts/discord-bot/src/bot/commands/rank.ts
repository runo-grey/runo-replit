import { type Message, type ChatInputCommandInteraction, AttachmentBuilder } from "discord.js";
import { getLevelData, getRankPosition } from "../db.js";
import { calcLevel } from "../xp.js";
import { errorEmbed } from "../embeds.js";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import path from "path";

// ─── Rank Card Generator ───────────────────────────────────────────────────────

const CARD_W = 934;
const CARD_H = 282;
const AVATAR_SIZE = 160;
const AVATAR_X = 36;
const AVATAR_Y = (CARD_H - AVATAR_SIZE) / 2;
const AVATAR_CX = AVATAR_X + AVATAR_SIZE / 2;
const AVATAR_CY = CARD_H / 2;

async function buildRankCard(opts: {
  username: string;
  displayName: string;
  avatarUrl: string;
  level: number;
  currentXp: number;
  xpForNext: number;
  totalXp: number;
  rank: number;
}): Promise<Buffer> {
  const canvas = createCanvas(CARD_W, CARD_H);
  const ctx = canvas.getContext("2d");

  // ── Background ────────────────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bg.addColorStop(0, "#0d0d1f");
  bg.addColorStop(0.5, "#13132a");
  bg.addColorStop(1, "#0a0a18");
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, CARD_W, CARD_H, 24);
  ctx.fill();

  // ── Decorative side strip ────────────────────────────────────────────────
  const strip = ctx.createLinearGradient(0, 0, 0, CARD_H);
  strip.addColorStop(0, "#9b59b6");
  strip.addColorStop(1, "#ffd700");
  ctx.fillStyle = strip;
  roundRect(ctx, 0, 0, 8, CARD_H, [24, 0, 0, 24]);
  ctx.fill();

  // ── Avatar shadow ────────────────────────────────────────────────────────
  ctx.shadowColor = "#9b59b680";
  ctx.shadowBlur = 24;
  ctx.strokeStyle = "#ffd700";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_SIZE / 2 + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ── Avatar image ─────────────────────────────────────────────────────────
  try {
    const res = await fetch(opts.avatarUrl + "?size=256");
    const buf = Buffer.from(await res.arrayBuffer());
    const avatar = await loadImage(buf);
    ctx.save();
    ctx.beginPath();
    ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, AVATAR_X, AVATAR_Y, AVATAR_SIZE, AVATAR_SIZE);
    ctx.restore();
  } catch {
    // fallback circle if avatar fetch fails
    ctx.fillStyle = "#2d2d4e";
    ctx.beginPath();
    ctx.arc(AVATAR_CX, AVATAR_CY, AVATAR_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Level badge ──────────────────────────────────────────────────────────
  const badgeX = AVATAR_CX - 28;
  const badgeY = AVATAR_Y + AVATAR_SIZE - 24;
  ctx.fillStyle = "#ffd700";
  roundRect(ctx, badgeX, badgeY, 56, 26, 13);
  ctx.fill();
  ctx.fillStyle = "#0d0d1f";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`LVL ${opts.level}`, AVATAR_CX, badgeY + 17);

  // ── Text area ────────────────────────────────────────────────────────────
  const textX = 230;

  // Rank badge (top right)
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff40";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("RANK", CARD_W - 30, 55);
  const rankGrad = ctx.createLinearGradient(CARD_W - 130, 0, CARD_W - 30, 0);
  rankGrad.addColorStop(0, "#9b59b6");
  rankGrad.addColorStop(1, "#ffd700");
  ctx.fillStyle = rankGrad;
  ctx.font = "bold 42px sans-serif";
  ctx.fillText(`#${opts.rank}`, CARD_W - 30, 95);
  ctx.textAlign = "left";

  // Display name
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold 34px sans-serif`;
  const displayName = opts.displayName.slice(0, 22);
  ctx.fillText(displayName, textX, 100);

  // Username tag (smaller, muted)
  if (opts.username !== opts.displayName) {
    ctx.fillStyle = "#8888aa";
    ctx.font = "18px sans-serif";
    ctx.fillText(`@${opts.username}`, textX, 126);
  }

  // XP progress bar background
  const barX = textX;
  const barY = 152;
  const barW = CARD_W - textX - 140;
  const barH = 24;
  ctx.fillStyle = "#1e1e3e";
  roundRect(ctx, barX, barY, barW, barH, 12);
  ctx.fill();

  // XP progress fill
  const progress = opts.xpForNext > 0 ? Math.min(opts.currentXp / opts.xpForNext, 1) : 0;
  if (progress > 0) {
    const fillW = Math.max(barW * progress, barH); // at least a pill
    const fill = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    fill.addColorStop(0, "#7c3aed");
    fill.addColorStop(0.5, "#a855f7");
    fill.addColorStop(1, "#ffd700");
    ctx.fillStyle = fill;
    roundRect(ctx, barX, barY, fillW, barH, 12);
    ctx.fill();

    // Shine on bar
    const shine = ctx.createLinearGradient(barX, barY, barX, barY + barH);
    shine.addColorStop(0, "rgba(255,255,255,0.15)");
    shine.addColorStop(0.5, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    roundRect(ctx, barX, barY, fillW, barH / 2, [12, 12, 0, 0]);
    ctx.fill();
  }

  // XP text
  ctx.fillStyle = "#aaaacc";
  ctx.font = "16px sans-serif";
  ctx.fillText(
    `${opts.currentXp.toLocaleString()} / ${opts.xpForNext.toLocaleString()} XP`,
    barX,
    barY + barH + 22,
  );

  // Total XP (right-aligned below bar)
  ctx.fillStyle = "#666688";
  ctx.font = "15px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`Total: ${opts.totalXp.toLocaleString()} XP`, barX + barW, barY + barH + 22);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/png");
}

// ─── Polyfill for roundRect ───────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
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

// ─── Command handler ──────────────────────────────────────────────────────────

export async function handleRank(
  source: Message | ChatInputCommandInteraction,
  targetId?: string,
  targetUsername?: string,
  targetDisplayName?: string,
  targetAvatarUrl?: string,
): Promise<void> {
  const discordId = targetId ?? ("author" in source ? source.author.id : source.user.id);
  const username = targetUsername ?? ("author" in source ? source.author.username : source.user.username);
  const displayName = targetDisplayName ?? username;
  const guildId = "guildId" in source ? source.guildId ?? "dm" : source.guildId ?? "dm";

  const avatarUrl =
    targetAvatarUrl ??
    ("author" in source
      ? source.author.displayAvatarURL({ extension: "png" })
      : source.user.displayAvatarURL({ extension: "png" }));

  if ("deferReply" in source) {
    await source.deferReply();
  }

  const data = await getLevelData(discordId, guildId, username);
  const rank = await getRankPosition(discordId, guildId);
  const { level, currentXp, xpForNext } = calcLevel(data.xp);

  const buffer = await buildRankCard({
    username,
    displayName,
    avatarUrl,
    level,
    currentXp,
    xpForNext,
    totalXp: data.xp,
    rank,
  });

  const attachment = new AttachmentBuilder(buffer, { name: "rank.png" });

  if ("deferReply" in source) {
    await source.editReply({ files: [attachment] });
  } else {
    await (source as Message).reply({ files: [attachment] });
  }
}
