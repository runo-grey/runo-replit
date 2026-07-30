import {
  type Message,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from "discord.js";
import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, relative } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { logger } from "../../lib/logger.js";

// ─── Paths ────────────────────────────────────────────────────────────────────

const _dir = dirname(fileURLToPath(import.meta.url));
// src/bot/commands → src/bot → src → artifacts/discord-bot
const SRC_DIR  = join(_dir, "../..");           // …/src
const BOT_ROOT = join(_dir, "../../..");        // …/artifacts/discord-bot

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_ROLE_ID   = "1480151118276202649";
const REPORT_CHANNEL  = "1532377421494354111";

// ─── File walker ──────────────────────────────────────────────────────────────

function walkTs(dir: string, root: string): { path: string; rel: string }[] {
  const results: { path: string; rel: string }[] = [];
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkTs(full, root));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      results.push({ path: full, rel: relative(root, full) });
    }
  }
  return results;
}

// ─── Indentation scanner + fixer ─────────────────────────────────────────────

type FileReport = {
  rel: string;
  lines: number;
  tabLines: number;
  mixedLines: number;
  fixed: boolean;
};

function scanAndFix(filePath: string, rel: string): FileReport {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split("\n");

  let tabLines = 0;
  let mixedLines = 0;
  const fixed: string[] = [];
  let changed = false;

  for (const line of lines) {
    const leading = line.match(/^(\s+)/)?.[1] ?? "";
    const hasTabs   = leading.includes("\t");
    const hasSpaces = leading.includes(" ");

    if (hasTabs && hasSpaces) {
      // Mixed — normalise: expand tabs (1 tab = 2 spaces) then clean
      mixedLines++;
      const expanded = line.replace(/\t/g, "  ");
      fixed.push(expanded);
      changed = true;
    } else if (hasTabs) {
      // Pure tabs → convert to 2-space per tab
      tabLines++;
      fixed.push(line.replace(/^\t+/, (t) => "  ".repeat(t.length)));
      changed = true;
    } else {
      fixed.push(line);
    }
  }

  if (changed) {
    writeFileSync(filePath, fixed.join("\n"), "utf-8");
  }

  return {
    rel,
    lines: lines.length,
    tabLines,
    mixedLines,
    fixed: changed,
  };
}

// ─── TypeScript check ─────────────────────────────────────────────────────────

type TsResult = { clean: boolean; errorCount: number; sample: string[] };

function runTscCheck(): TsResult {
  try {
    execSync("npx tsc --noEmit --skipLibCheck 2>&1", {
      cwd: BOT_ROOT,
      timeout: 45_000,
      stdio: "pipe",
    });
    return { clean: true, errorCount: 0, sample: [] };
  } catch (err: any) {
    const raw: string = err.stdout?.toString?.() ?? err.message ?? "";
    const errorLines = raw
      .split("\n")
      .filter((l) => /error TS\d+/.test(l))
      .map((l) => l.replace(BOT_ROOT + "/", "").trim()); // strip absolute path prefix
    return {
      clean: false,
      errorCount: errorLines.length,
      sample: errorLines.slice(0, 6),
    };
  }
}

// ─── Embed builder ────────────────────────────────────────────────────────────

function buildReportEmbed(
  reports: FileReport[],
  ts: TsResult,
  durationMs: number,
  triggeredBy: string,
): EmbedBuilder {
  const totalFiles = reports.length;
  const totalLines = reports.reduce((s, r) => s + r.lines, 0);
  const fixedFiles = reports.filter((r) => r.fixed);
  const allClean   = fixedFiles.length === 0 && ts.clean;

  // ── Indentation field value ─────────────────────────────────────────────
  let indentValue: string;
  if (fixedFiles.length === 0) {
    indentValue = "✅  All files use consistent 2-space indentation.";
  } else {
    const lines = fixedFiles.map((r) => {
      const issues: string[] = [];
      if (r.tabLines > 0)   issues.push(`${r.tabLines} tab-indent line${r.tabLines > 1 ? "s" : ""}`);
      if (r.mixedLines > 0) issues.push(`${r.mixedLines} mixed-indent line${r.mixedLines > 1 ? "s" : ""}`);
      return `\`${r.rel}\`  —  ${issues.join(", ")}  →  **fixed**`;
    });
    indentValue = lines.join("\n");
  }

  // ── TypeScript field value ──────────────────────────────────────────────
  let tsValue: string;
  if (ts.clean) {
    tsValue = "✅  No type errors detected.";
  } else {
    const sampleBlock = ts.sample.length
      ? "```\n" + ts.sample.join("\n") + (ts.errorCount > 6 ? `\n…and ${ts.errorCount - 6} more` : "") + "\n```"
      : `${ts.errorCount} error(s) detected.`;
    tsValue = `⚠️  **${ts.errorCount}** TypeScript error${ts.errorCount !== 1 ? "s" : ""}\n${sampleBlock}`;
  }

  // ── Status bar ──────────────────────────────────────────────────────────
  const statusLine = allClean
    ? "✅  Codebase is healthy — no issues found."
    : fixedFiles.length > 0 && ts.clean
    ? `🔧  Indentation fixed in ${fixedFiles.length} file${fixedFiles.length !== 1 ? "s" : ""}. TypeScript clean.`
    : !ts.clean && fixedFiles.length === 0
    ? `⚠️  TypeScript errors need manual attention.`
    : `⚠️  Indentation fixed in ${fixedFiles.length} file${fixedFiles.length !== 1 ? "s" : ""}. TypeScript errors remain.`;

  return new EmbedBuilder()
    .setTitle("🔍  Bot Code Checkup Report")
    .setColor(allClean ? 0x2ecc71 : fixedFiles.length > 0 && ts.clean ? 0xf39c12 : 0xe74c3c)
    .setDescription(
      [
        "```ansi",
        `\u001b[2;34mScanned\u001b[0m  ${totalFiles} files  ·  ${totalLines.toLocaleString()} lines  ·  ${durationMs}ms`,
        "```",
      ].join("\n"),
    )
    .addFields(
      {
        name: "━━━━━━━━━━━━━━━━━━━━━━",
        value: "​",
        inline: false,
      },
      {
        name: `${fixedFiles.length > 0 ? "🔧" : "✅"}  Indentation Check${fixedFiles.length > 0 ? `  ·  ${fixedFiles.length} file(s) fixed` : ""}`,
        value: indentValue.slice(0, 1020),
        inline: false,
      },
      {
        name: "━━━━━━━━━━━━━━━━━━━━━━",
        value: "​",
        inline: false,
      },
      {
        name: `${ts.clean ? "✅" : "⚠️"}  TypeScript Diagnostics${ts.clean ? "" : `  ·  ${ts.errorCount} error(s)`}`,
        value: tsValue.slice(0, 1020),
        inline: false,
      },
      {
        name: "━━━━━━━━━━━━━━━━━━━━━━",
        value: "​",
        inline: false,
      },
      {
        name: "📊  Summary",
        value: [
          `**Files scanned:** ${totalFiles}`,
          `**Total lines:** ${totalLines.toLocaleString()}`,
          `**Indent fixes:** ${fixedFiles.length > 0 ? `${fixedFiles.length} file(s) auto-fixed` : "None needed"}`,
          `**TS errors:** ${ts.clean ? "None" : ts.errorCount}`,
          `**Scan time:** ${durationMs}ms`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "━━━━━━━━━━━━━━━━━━━━━━",
        value: statusLine,
        inline: false,
      },
    )
    .setFooter({ text: `Triggered by ${triggeredBy}  ·  Runo Bot` })
    .setTimestamp();
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleCheckup(
  source: Message | ChatInputCommandInteraction,
): Promise<void> {
  // ── Permission check ──────────────────────────────────────────────────────
  const member = ("member" in source ? source.member : null) as GuildMember | null;
  if (!member?.roles.cache.has(ADMIN_ROLE_ID)) {
    const deny = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setDescription("❌ You don't have permission to run a code checkup.");
    if ("isChatInputCommand" in source && source.isChatInputCommand()) {
      await source.reply({ embeds: [deny], ephemeral: true });
    } else {
      await (source as Message).reply({ embeds: [deny] });
    }
    return;
  }

  // ── Acknowledge ───────────────────────────────────────────────────────────
  if ("isChatInputCommand" in source && source.isChatInputCommand()) {
    await source.deferReply({ ephemeral: true });
  } else {
    await (source as Message).reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setDescription(`🔄  Scanning bot source code… results will appear in <#${REPORT_CHANNEL}>.`),
      ],
    });
  }

  const startMs = Date.now();

  try {
    // ── Scan files ──────────────────────────────────────────────────────────
    logger.info("Starting code checkup scan…");
    const files   = walkTs(SRC_DIR, BOT_ROOT);
    const reports = files.map((f) => scanAndFix(f.path, f.rel));

    // ── TypeScript check ────────────────────────────────────────────────────
    logger.info("Running tsc check…");
    const ts = runTscCheck();

    const durationMs = Date.now() - startMs;

    // ── Build + send embed ──────────────────────────────────────────────────
    const triggeredBy =
      "isChatInputCommand" in source && source.isChatInputCommand()
        ? source.user.username
        : (source as Message).author.username;

    const embed = buildReportEmbed(reports, ts, durationMs, triggeredBy);

    const channel = await source.client.channels.fetch(REPORT_CHANNEL);
    if (channel?.isTextBased()) {
      await channel.send({ embeds: [embed] });
    }

    logger.info({ fixedFiles: reports.filter((r) => r.fixed).length, tsErrors: ts.errorCount }, "Checkup complete");

    // ── Confirm to caller ───────────────────────────────────────────────────
    if ("isChatInputCommand" in source && source.isChatInputCommand()) {
      await source.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setDescription(`✅  Checkup complete! Report sent to <#${REPORT_CHANNEL}>.`),
        ],
      });
    }
  } catch (err) {
    logger.error({ err }, "Checkup command failed");
    const errEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setDescription("❌  Checkup failed — check bot logs for details.");
    if ("isChatInputCommand" in source && source.isChatInputCommand()) {
      await source.editReply({ embeds: [errEmbed] });
    } else {
      await (source as Message).reply({ embeds: [errEmbed] }).catch(() => null);
    }
  }
}
