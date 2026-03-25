const path = require("path");
const Database = require("better-sqlite3");
const { loadArticleIndex } = require("./lib/articles-index");

const DB_PATH =
  process.env.ANALYTICS_DB_PATH ||
  path.join(__dirname, "analytics-events.db");

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

  const conditions = ["event_type = 'article_open'"];
  const params = { limit: args.limit };

  if (args.userId) {
    conditions.push("user_id = @userId");
    params.userId = args.userId;
  }

  const query = `
    SELECT
      timestamp,
      user_id,
      article_id,
      request_id,
      position,
      variant_key,
      (
        SELECT json_extract(rt.properties_json, '$.seconds')
        FROM events rt
        WHERE rt.event_type = 'read_time'
          AND rt.user_id = events.user_id
          AND (
            (rt.article_id = events.article_id)
            OR (rt.article_id IS NULL AND events.article_id IS NULL)
          )
          AND (
            (rt.request_id = events.request_id)
            OR (rt.request_id IS NULL AND events.request_id IS NULL)
          )
          AND rt.timestamp >= events.timestamp
        ORDER BY rt.timestamp ASC
        LIMIT 1
      ) AS read_time_seconds,
      (
        SELECT rt.timestamp
        FROM events rt
        WHERE rt.event_type = 'read_time'
          AND rt.user_id = events.user_id
          AND (
            (rt.article_id = events.article_id)
            OR (rt.article_id IS NULL AND events.article_id IS NULL)
          )
          AND (
            (rt.request_id = events.request_id)
            OR (rt.request_id IS NULL AND events.request_id IS NULL)
          )
          AND rt.timestamp >= events.timestamp
        ORDER BY rt.timestamp ASC
        LIMIT 1
      ) AS read_time_timestamp
    FROM events
    WHERE ${conditions.join(" AND ")}
    ORDER BY timestamp DESC
    LIMIT @limit
  `;

  const rows = db.prepare(query).all(params);
  db.close();

  if (rows.length === 0) {
    console.log("No article_open (click) events found.");
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
      position: row.position,
      variant_key: row.variant_key,
      request_id: row.request_id,
      read_time_seconds: row.read_time_seconds,
      read_time_timestamp: row.read_time_timestamp
    };
  });

  console.table(enrichedRows);
}

main();
