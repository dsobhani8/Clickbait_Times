const path = require("path");
const Database = require("better-sqlite3");
const { loadArticleIndex } = require("./articles-index");

const DB_PATH =
  process.env.ANALYTICS_DB_PATH ||
  path.join(__dirname, "..", "..", "backend", "analytics-events.db");

function parseArgs(argv) {
  const args = {
    limit: 50,
    userId: null
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--limit" && next) {
      args.limit = Math.max(1, Math.min(500, Number(next) || 50));
      i += 1;
      continue;
    }
    if (token === "--user" && next) {
      args.userId = next;
      i += 1;
      continue;
    }
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const articleIndex = loadArticleIndex();
  const db = new Database(DB_PATH, { readonly: true });

  const where = ["event_type = 'tailor_change'"];
  const params = { limit: args.limit };

  if (args.userId) {
    where.push("user_id = @userId");
    params.userId = args.userId;
  }

  const query = `
    SELECT
      timestamp,
      user_id,
      article_id,
      request_id,
      variant_key,
      json_extract(properties_json, '$.field') AS field,
      json_extract(properties_json, '$.value') AS value
    FROM events
    WHERE ${where.join(" AND ")}
    ORDER BY timestamp DESC
    LIMIT @limit
  `;

  const rows = db.prepare(query).all(params);
  db.close();

  if (rows.length === 0) {
    console.log("No tailor_change events found.");
    return;
  }

  const enrichedRows = rows.map((row) => {
    const meta = row.article_id ? articleIndex.get(row.article_id) : null;
    return {
      timestamp: row.timestamp,
      user_id: row.user_id,
      article_id: row.article_id,
      title: meta?.title ?? null,
      topic: meta?.topicLabel ?? null,
      category: meta?.category ?? null,
      request_id: row.request_id,
      variant_key: row.variant_key,
      field: row.field,
      value: row.value
    };
  });

  console.table(enrichedRows);
}

main();
