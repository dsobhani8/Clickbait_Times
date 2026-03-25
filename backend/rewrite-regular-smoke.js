const path = require("path");
const Database = require("better-sqlite3");
const {
  isToneLlmEnabled,
  rewriteRegularVariantForArticle
} = require("./rewrite-tone-llm");
const { buildRegularBodyPrompt } = require("./rewrite-prompts");

const DB_PATH =
  process.env.ANALYTICS_DB_PATH ||
  path.join(__dirname, "analytics-events.db");

function parseArgs(argv) {
  const args = {
    snapshotId: null,
    articleId: null,
    printPrompt: false,
    maxChars: 1800,
    fullBody: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--snapshot-id" && next) {
      args.snapshotId = Number(next);
      i += 1;
      continue;
    }
    if (token === "--article-id" && next) {
      args.articleId = next;
      i += 1;
      continue;
    }
    if (token === "--print-prompt") {
      args.printPrompt = true;
      continue;
    }
    if (token === "--max-chars" && next) {
      const value = Number(next);
      if (Number.isFinite(value)) {
        args.maxChars = Math.max(200, Math.min(20000, Math.round(value)));
      }
      i += 1;
      continue;
    }
    if (token === "--full-body") {
      args.fullBody = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
  }

  return args;
}

function parseBodyJson(bodyJson) {
  if (typeof bodyJson !== "string" || bodyJson.length === 0) return [];
  try {
    const parsed = JSON.parse(bodyJson);
    if (Array.isArray(parsed)) {
      return parsed.filter((entry) => typeof entry === "string");
    }
  } catch {
    return [];
  }
  return [];
}

function countWords(text) {
  if (typeof text !== "string") return 0;
  const tokens = text.trim().match(/\S+/g);
  return Array.isArray(tokens) ? tokens.length : 0;
}

function printHelp() {
  console.log(
    [
      "Usage:",
      "  node backend/rewrite-regular-smoke.js [--snapshot-id <id>] [--article-id <id>] [--print-prompt] [--max-chars <n>] [--full-body]",
      "",
      "Defaults:",
      "  - Uses latest snapshot if --snapshot-id is omitted.",
      "  - Uses first ranked article in that snapshot if --article-id is omitted.",
      "  - Body side-by-side preview prints first 1800 chars per side.",
      "  - Use --full-body to print full body side-by-side (can be very long)."
    ].join("\n")
  );
}

function padRight(text, width) {
  const value = typeof text === "string" ? text : "";
  if (value.length >= width) return value;
  return value + " ".repeat(width - value.length);
}

function wrapText(text, width) {
  const normalized = (typeof text === "string" ? text : "")
    .replace(/\r/g, "")
    .replace(/\t/g, "  ");
  const lines = normalized.split("\n");
  const output = [];

  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      output.push("");
      continue;
    }

    let current = "";
    for (const word of words) {
      if (!current) {
        current = word;
        continue;
      }
      if ((current + " " + word).length <= width) {
        current += " " + word;
      } else {
        output.push(current);
        current = word;
      }
    }
    if (current) output.push(current);
  }

  return output;
}

function printSideBySide({ leftHeader, rightHeader, leftText, rightText }) {
  const totalWidth = Math.max(120, process.stdout.columns || 160);
  const gutter = " | ";
  const colWidth = Math.max(40, Math.floor((totalWidth - gutter.length) / 2));

  console.log(`${padRight(leftHeader, colWidth)}${gutter}${rightHeader}`);
  console.log(`${"-".repeat(colWidth)}${gutter}${"-".repeat(colWidth)}`);

  const leftLines = wrapText(leftText, colWidth);
  const rightLines = wrapText(rightText, colWidth);
  const rows = Math.max(leftLines.length, rightLines.length);

  for (let i = 0; i < rows; i += 1) {
    const left = leftLines[i] || "";
    const right = rightLines[i] || "";
    console.log(`${padRight(left, colWidth)}${gutter}${right}`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const db = new Database(DB_PATH, { readonly: true });

  const hasSnapshotTables =
    db
      .prepare(
        `
        SELECT COUNT(1) AS c
        FROM sqlite_master
        WHERE type = 'table'
          AND name IN ('feed_snapshots', 'snapshot_articles')
      `
      )
      .get().c === 2;

  if (!hasSnapshotTables) {
    db.close();
    throw new Error(
      "Snapshot tables are not initialized yet. Start `npm run analytics:server` once, then retry."
    );
  }

  let snapshotId = Number.isFinite(args.snapshotId) ? args.snapshotId : null;
  if (!snapshotId) {
    const latest = db
      .prepare(
        `
        SELECT snapshot_id
        FROM feed_snapshots
        ORDER BY created_at DESC, snapshot_id DESC
        LIMIT 1
      `
      )
      .get();
    snapshotId = latest?.snapshot_id ?? null;
  }

  if (!snapshotId) {
    db.close();
    throw new Error("No snapshots found in database.");
  }

  const row = args.articleId
    ? db
        .prepare(
          `
          SELECT
            snapshot_id,
            article_id,
            rank,
            title,
            lead,
            body_json,
            category,
            topic_label
          FROM snapshot_articles
          WHERE snapshot_id = @snapshotId
            AND article_id = @articleId
          LIMIT 1
        `
        )
        .get({ snapshotId, articleId: args.articleId })
    : db
        .prepare(
          `
          SELECT
            snapshot_id,
            article_id,
            rank,
            title,
            lead,
            body_json,
            category,
            topic_label
          FROM snapshot_articles
          WHERE snapshot_id = @snapshotId
          ORDER BY rank ASC
          LIMIT 1
        `
        )
        .get({ snapshotId });

  db.close();

  if (!row) {
    throw new Error(
      `No article found for snapshot_id=${snapshotId}${args.articleId ? ` article_id=${args.articleId}` : ""}.`
    );
  }

  const article = {
    id: row.article_id,
    title: row.title,
    lead: row.lead || "",
    body: parseBodyJson(row.body_json)
  };

  const originalBodyText = article.body.join("\n\n");
  const originalTitle = article.title || "";
  const originalLead = article.lead || "";

  if (args.printPrompt) {
    const prompt = buildRegularBodyPrompt({
      articleInput: {
        title: article.title,
        lead: article.lead,
        body: article.body
      }
    });
    console.log("--- regular prompt (full) ---");
    console.log(prompt);
    console.log("--- end prompt ---\n");
  }

  const startedAt = Date.now();
  const { variant, rewrittenBodyText, rewriteMethod } =
    await rewriteRegularVariantForArticle(article);
  const latencyMs = Date.now() - startedAt;
  const rewrittenTitle = variant?.title || "";
  const rewrittenLead = variant?.lead || "";

  console.log(
    `[regular-smoke] snapshotId=${snapshotId} articleId=${article.id} rank=${row.rank}`
  );
  console.log(
    `[regular-smoke] rewriteMode=${process.env.REWRITE_MODE || "rule_based"} toneLlmEnabled=${isToneLlmEnabled()} method=${rewriteMethod} latencyMs=${latencyMs}`
  );
  console.log(
    `[regular-smoke] words original=${countWords(originalBodyText)} rewritten=${countWords(rewrittenBodyText)}`
  );

  console.log("\n=== side-by-side: original vs regular rewrite ===");
  printSideBySide({
    leftHeader: `ORIGINAL TITLE (words=${countWords(originalTitle)})`,
    rightHeader: `REGULAR TITLE (words=${countWords(rewrittenTitle)})`,
    leftText: originalTitle,
    rightText: rewrittenTitle
  });
  console.log("");
  printSideBySide({
    leftHeader: `ORIGINAL LEAD (words=${countWords(originalLead)})`,
    rightHeader: `REGULAR LEAD (words=${countWords(rewrittenLead)})`,
    leftText: originalLead,
    rightText: rewrittenLead
  });
  console.log("");
  const leftBodyText = args.fullBody
    ? originalBodyText
    : originalBodyText.slice(0, args.maxChars);
  const rightBodyText = args.fullBody
    ? rewrittenBodyText || ""
    : (rewrittenBodyText || "").slice(0, args.maxChars);
  const leftBodyHeader = args.fullBody
    ? `ORIGINAL BODY FULL (words=${countWords(originalBodyText)})`
    : `ORIGINAL BODY PREVIEW (words=${countWords(originalBodyText)}, chars=${args.maxChars})`;
  const rightBodyHeader = args.fullBody
    ? `REGULAR BODY FULL (words=${countWords(rewrittenBodyText)})`
    : `REGULAR BODY PREVIEW (words=${countWords(rewrittenBodyText)}, chars=${args.maxChars})`;
  printSideBySide({
    leftHeader: leftBodyHeader,
    rightHeader: rightBodyHeader,
    leftText: leftBodyText,
    rightText: rightBodyText
  });
}

main().catch((error) => {
  console.error("[regular-smoke] error", error);
  process.exit(1);
});
