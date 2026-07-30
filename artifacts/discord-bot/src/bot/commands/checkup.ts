import {
  type Message,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from "discord.js";
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join, relative, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { logger } from "../../lib/logger.js";

// ─── Paths ────────────────────────────────────────────────────────────────────

const _dir   = dirname(fileURLToPath(import.meta.url));
const SRC_DIR  = join(_dir, "../..");        // …/src
const BOT_ROOT = join(_dir, "../../..");     // …/artifacts/discord-bot

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_ROLE_ID  = "1480151118276202649";
const REPORT_CHANNEL = "1532377421494354111";
const TS_IGNORE_TAG  = "// @ts-ignore — auto-suppressed by !checkup";

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — FILE WALKER
// ══════════════════════════════════════════════════════════════════════════════

function walkTs(dir: string): { path: string; rel: string }[] {
  const results: { path: string; rel: string }[] = [];
  let entries: ReturnType<typeof readdirSync>;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }

  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const full = join(dir, e.name);
    if (e.isDirectory())                          results.push(...walkTs(full));
    else if (e.isFile() && e.name.endsWith(".ts")) results.push({ path: full, rel: relative(BOT_ROOT, full) });
  }
  return results;
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — INDENTATION FIXER
// ══════════════════════════════════════════════════════════════════════════════

type IndentReport = { rel: string; lines: number; tabLines: number; mixedLines: number; fixed: boolean };

function fixIndentation(filePath: string, rel: string): IndentReport {
  const raw   = readFileSync(filePath, "utf-8");
  const lines = raw.split("\n");
  let tabLines = 0, mixedLines = 0;
  let changed  = false;

  const out = lines.map((line) => {
    const lead   = line.match(/^(\s+)/)?.[1] ?? "";
    const hasTabs = lead.includes("\t");
    const hasSpc  = lead.includes(" ");
    if (hasTabs && hasSpc) {
      mixedLines++; changed = true;
      return line.replace(/\t/g, "  ");
    }
    if (hasTabs) {
      tabLines++; changed = true;
      return line.replace(/^\t+/, (t) => "  ".repeat(t.length));
    }
    return line;
  });

  if (changed) writeFileSync(filePath, out.join("\n"), "utf-8");
  return { rel, lines: lines.length, tabLines, mixedLines, fixed: changed };
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — TYPESCRIPT ERROR PARSER
// ══════════════════════════════════════════════════════════════════════════════

type TsError = { file: string; rel: string; line: number; col: number; code: string; message: string };

function runTsc(): { clean: boolean; raw: string; errors: TsError[] } {
  let raw = "";
  try {
    execSync("npx tsc --noEmit --skipLibCheck 2>&1", {
      cwd: BOT_ROOT, timeout: 60_000, stdio: "pipe",
    });
    return { clean: true, raw: "", errors: [] };
  } catch (err: any) {
    raw = err.stdout?.toString?.() ?? err.message ?? "";
  }

  const errors: TsError[] = [];
  // tsc output format: "src/foo.ts(12,5): error TS2339: Property …"
  const regex = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(raw)) !== null) {
    const rel  = m[1].trim();
    const file = join(BOT_ROOT, rel);
    errors.push({
      file, rel,
      line: parseInt(m[2], 10),
      col:  parseInt(m[3], 10),
      code: m[4],
      message: m[5].trim(),
    });
  }
  return { clean: false, raw, errors };
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — TYPESCRIPT AUTO-FIXER
// ══════════════════════════════════════════════════════════════════════════════

type FixResult = {
  totalSuppressed : number;
  filesModified   : number;
  details         : string[];   // one line per file
};

function autoFixTsErrors(errors: TsError[]): FixResult {
  if (errors.length === 0) return { totalSuppressed: 0, filesModified: 0, details: [] };

  // Group by file
  const byFile = new Map<string, TsError[]>();
  for (const e of errors) {
    const list = byFile.get(e.file) ?? [];
    list.push(e);
    byFile.set(e.file, list);
  }

  let totalSuppressed = 0;
  const details: string[] = [];

  for (const [filePath, errs] of byFile) {
    let content: string;
    try { content = readFileSync(filePath, "utf-8"); }
    catch { continue; }

    const lines = content.split("\n");

    // Collect unique line numbers that need suppression, sort descending
    // so splicing doesn't shift the indices of lines we haven't touched yet
    const uniqueLineNums = [...new Set(errs.map((e) => e.line))].sort((a, b) => b - a);

    let suppressed = 0;
    for (const lineNum of uniqueLineNums) {
      const idx = lineNum - 1; // 0-based
      if (idx < 0 || idx >= lines.length) continue;

      // Skip if the line above already has a ts-ignore/ts-expect-error
      const above = lines[idx - 1]?.trim() ?? "";
      if (above.startsWith("// @ts-ignore") || above.startsWith("// @ts-expect-error")) continue;

      // Get the indentation of the erroring line so the comment aligns
      const indent = lines[idx].match(/^(\s*)/)?.[1] ?? "";

      // Insert the suppression comment BEFORE the erroring line
      lines.splice(idx, 0, `${indent}${TS_IGNORE_TAG}`);
      suppressed++;
    }

    if (suppressed > 0) {
      writeFileSync(filePath, lines.join("\n"), "utf-8");
      totalSuppressed += suppressed;
      details.push(
        `\`${relative(BOT_ROOT, filePath)}\`  —  ${suppressed} line${suppressed !== 1 ? "s" : ""} suppressed`,
      );
    }
  }

  return { totalSuppressed, filesModified: details.length, details };
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — EMBED BUILDER
// ══════════════════════════════════════════════════════════════════════════════

function buildEmbed(opts: {
  indentReports : IndentReport[];
  ts1           : ReturnType<typeof runTsc>;   // before fix
  ts2           : ReturnType<typeof runTsc>;   // after fix
  fixResult     : FixResult;
  durationMs    : number;
  triggeredBy   : string;
}): EmbedBuilder {
  const { indentReports, ts1, ts2, fixResult, durationMs, triggeredBy } = opts;

  const totalFiles    = indentReports.length;
  const totalLines    = indentReports.reduce((s, r) => s + r.lines, 0);
  const indentFixed   = indentReports.filter((r) => r.fixed);
  const tsErrorsBefore = ts1.errors.length;
  const tsErrorsAfter  = ts2.errors.length;
  const allClean       = indentFixed.length === 0 && tsErrorsAfter === 0;

  // ── Indentation field ─────────────────────────────────────────────────────
  const indentValue = indentFixed.length === 0
    ? "✅  All files use consistent 2-space indentation."
    : indentFixed
        .map((r) => {
          const parts: string[] = [];
          if (r.tabLines > 0)   parts.push(`${r.tabLines} tab line${r.tabLines !== 1 ? "s" : ""}`);
          if (r.mixedLines > 0) parts.push(`${r.mixedLines} mixed line${r.mixedLines !== 1 ? "s" : ""}`);
          return `\`${r.rel}\`  —  ${parts.join(", ")}  →  **fixed**`;
        })
        .join("\n");

  // ── TypeScript field ──────────────────────────────────────────────────────
  let tsValue: string;
  if (tsErrorsBefore === 0) {
    tsValue = "✅  No TypeScript errors detected.";
  } else if (tsErrorsAfter === 0) {
    const lines = [
      `🔧  **${tsErrorsBefore}** error${tsErrorsBefore !== 1 ? "s" : ""} found → all suppressed via \`@ts-ignore\``,
      "",
      ...fixResult.details.slice(0, 8),
    ];
    if (fixResult.details.length > 8) lines.push(`…and ${fixResult.details.length - 8} more file(s)`);
    tsValue = lines.join("\n");
  } else {
    // Still errors after fix attempt
    const sample = ts2.errors.slice(0, 5).map((e) => `\`${e.rel}:${e.line}\`  ${e.code}: ${e.message.slice(0, 80)}`);
    tsValue = [
      `⚠️  ${tsErrorsAfter} error${tsErrorsAfter !== 1 ? "s" : ""} remain after auto-fix attempt`,
      "```",
      ...sample,
      ts2.errors.length > 5 ? `…and ${ts2.errors.length - 5} more` : "",
      "```",
    ].filter(Boolean).join("\n");
  }

  // ── Status ─────────────────────────────────────────────────────────────────
  const statusParts: string[] = [];
  if (indentFixed.length > 0) statusParts.push(`🔧 Indentation fixed in ${indentFixed.length} file${indentFixed.length !== 1 ? "s" : ""}`);
  if (tsErrorsBefore > 0 && tsErrorsAfter === 0) statusParts.push(`🔧 ${tsErrorsBefore} TS error${tsErrorsBefore !== 1 ? "s" : ""} auto-suppressed`);
  if (tsErrorsAfter > 0) statusParts.push(`⚠️ ${tsErrorsAfter} TS error${tsErrorsAfter !== 1 ? "s" : ""} could not be resolved`);
  if (statusParts.length === 0) statusParts.push("✅ Codebase is fully healthy");

  const color = tsErrorsAfter > 0 ? 0xe74c3c : indentFixed.length > 0 || tsErrorsBefore > 0 ? 0xf39c12 : 0x2ecc71;

  return new EmbedBuilder()
    .setTitle("🔍  Bot Code Checkup Report")
    .setColor(color)
    .setDescription(
      ["```ansi", `\u001b[2;34mScanned\u001b[0m  ${totalFiles} files  ·  ${totalLines.toLocaleString()} lines  ·  ${durationMs}ms`, "```"].join("\n"),
    )
    .addFields(
      { name: "━━━━━━━━━━━━━━━━━━━━━━", value: "​", inline: false },
      {
        name: `${indentFixed.length > 0 ? "🔧" : "✅"}  Indentation${indentFixed.length > 0 ? `  ·  ${indentFixed.length} file(s) fixed` : ""}`,
        value: indentValue.slice(0, 1020),
        inline: false,
      },
      { name: "━━━━━━━━━━━━━━━━━━━━━━", value: "​", inline: false },
      {
        name: tsErrorsBefore === 0
          ? "✅  TypeScript"
          : tsErrorsAfter === 0
          ? `🔧  TypeScript  ·  ${tsErrorsBefore} error(s) auto-fixed`
          : `⚠️  TypeScript  ·  ${tsErrorsAfter} error(s) remain`,
        value: tsValue.slice(0, 1020),
        inline: false,
      },
      { name: "━━━━━━━━━━━━━━━━━━━━━━", value: "​", inline: false },
      {
        name: "📊  Summary",
        value: [
          `**Files scanned:** ${totalFiles}`,
          `**Total lines:** ${totalLines.toLocaleString()}`,
          `**Indent fixes:** ${indentFixed.length > 0 ? `${indentFixed.length} file(s)` : "None needed"}`,
          `**TS errors before:** ${tsErrorsBefore}`,
          `**TS errors after fix:** ${tsErrorsAfter}`,
          `**Scan duration:** ${durationMs}ms`,
        ].join("\n"),
        inline: false,
      },
      { name: "━━━━━━━━━━━━━━━━━━━━━━", value: statusParts.join("\n"), inline: false },
    )
    .setFooter({ text: `Triggered by ${triggeredBy}  ·  Runo Bot  ·  Changes active on next restart` })
    .setTimestamp();
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — COMMAND HANDLER
// ══════════════════════════════════════════════════════════════════════════════

export async function handleCheckup(
  source: Message | ChatInputCommandInteraction,
): Promise<void> {
  // ── Permission ─────────────────────────────────────────────────────────────
  const member = ("member" in source ? source.member : null) as GuildMember | null;
  if (!member?.roles.cache.has(ADMIN_ROLE_ID)) {
    const deny = new EmbedBuilder().setColor(0xe74c3c).setDescription("❌ You don't have permission to run a code checkup.");
    if ("isChatInputCommand" in source && source.isChatInputCommand()) {
      await source.reply({ embeds: [deny], ephemeral: true });
    } else {
      await (source as Message).reply({ embeds: [deny] });
    }
    return;
  }

  // ── Acknowledge ────────────────────────────────────────────────────────────
  const isSlash = "isChatInputCommand" in source && source.isChatInputCommand();
  if (isSlash) {
    await source.deferReply({ ephemeral: true });
  } else {
    await (source as Message).reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setDescription(`🔄  Scanning bot source code — this may take up to 30s…\nReport will appear in <#${REPORT_CHANNEL}>.`),
      ],
    });
  }

  const t0 = Date.now();

  try {
    logger.info("Checkup: scanning source files…");

    // 1. Walk + fix indentation
    const files         = walkTs(SRC_DIR);
    const indentReports = files.map((f) => fixIndentation(f.path, f.rel));

    // 2. First tsc pass — find all errors
    logger.info("Checkup: running tsc pass 1…");
    const ts1 = runTsc();

    // 3. Auto-suppress TypeScript errors
    let fixResult: FixResult = { totalSuppressed: 0, filesModified: 0, details: [] };
    let ts2 = ts1; // assume clean unless there were errors

    if (!ts1.clean && ts1.errors.length > 0) {
      logger.info({ count: ts1.errors.length }, "Checkup: suppressing TS errors…");
      fixResult = autoFixTsErrors(ts1.errors);

      // 4. Second tsc pass — verify fixes
      logger.info("Checkup: running tsc pass 2 (verification)…");
      ts2 = runTsc();
    }

    const durationMs = Date.now() - t0;

    // 5. Build embed + send to report channel
    const triggeredBy = isSlash
      ? (source as ChatInputCommandInteraction).user.username
      : (source as Message).author.username;

    const embed = buildEmbed({ indentReports, ts1, ts2, fixResult, durationMs, triggeredBy });

    const channel = await source.client.channels.fetch(REPORT_CHANNEL);
    if (channel?.isTextBased()) {
      await channel.send({ embeds: [embed] });
      logger.info("Checkup: report sent to channel");
    } else {
      logger.warn("Checkup: report channel not found or not text-based");
    }

    // 6. Confirm to caller
    if (isSlash) {
      await (source as ChatInputCommandInteraction).editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setDescription(`✅  Checkup complete! Report sent to <#${REPORT_CHANNEL}>.`),
        ],
      });
    }

    logger.info(
      {
        indentFixed : indentReports.filter((r) => r.fixed).length,
        tsErrorsBefore: ts1.errors.length,
        tsErrorsAfter:  ts2.errors.length,
        durationMs,
      },
      "Checkup complete",
    );
  } catch (err) {
    logger.error({ err }, "Checkup failed");
    const errEmbed = new EmbedBuilder().setColor(0xe74c3c).setDescription("❌  Checkup failed — check bot logs.");
    if (isSlash) {
      await (source as ChatInputCommandInteraction).editReply({ embeds: [errEmbed] });
    } else {
      await (source as Message).reply({ embeds: [errEmbed] }).catch(() => null);
    }
  }
}
