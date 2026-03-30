const path = require("path");
const Database = require("better-sqlite3");
const { loadArticleIndex } = require("./articles-index");

const DB_PATH =
  process.env.ANALYTICS_DB_PATH ||
  path.join(__dirname, "..", "..", "backend", "analytics-events.db");

function parseArgs(argv) {
  const args = {
    limit: 200,
    userId: null
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--limit" && next) {
      args.limit = Math.max(1, Math.min(1000, Number(next) || 200));
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

function loadDbArticleIndex(db, ids) {
  const articleIds = [...ids].filter(
    (value) => typeof value === "string" && value.length > 0
  );
  const map = new Map();

  if (articleIds.length === 0) {
    return map;
  }

  const placeholders = articleIds.map(() => "?").join(", ");
  try {
    const rows = db
      .prepare(
        `
          SELECT
            article_id,
            title,
            topic_label,
            category
          FROM articles
          WHERE article_id IN (${placeholders})
        `
      )
      .all(...articleIds);

    for (const row of rows) {
      map.set(row.article_id, {
        title: row.title ?? null,
        topicLabel: row.topic_label ?? null,
        category: row.category ?? null
      });
    }
  } catch {
    // Ignore when articles table is unavailable.
  }

  return map;
}

function main() {
  const args = parseArgs(process.argv);
  const staticIndex = loadArticleIndex();
  const db = new Database(DB_PATH, { readonly: true });

  const conditions = ["c.event_type = 'article_open'"];
  const params = { limit: args.limit };
  if (args.userId) {
    conditions.push("c.user_id = @userId");
    params.userId = args.userId;
  }

  const rows = db
    .prepare(
      `
      SELECT
        c.timestamp AS click_at,
        c.user_id,
        c.article_id,
        c.request_id,
        c.position,
        c.variant_key,
        c.session_id,
        (
          SELECT json_extract(end_evt.properties_json, '$.appSessionId')
          FROM events end_evt
          WHERE end_evt.event_type = 'app_session_end'
            AND end_evt.user_id = c.user_id
            AND c.timestamp <= end_evt.timestamp
            AND c.timestamp >= (
              SELECT start_evt.timestamp
              FROM events start_evt
              WHERE start_evt.event_type = 'app_session_start'
                AND start_evt.user_id = c.user_id
                AND json_extract(start_evt.properties_json, '$.appSessionId') = json_extract(end_evt.properties_json, '$.appSessionId')
              ORDER BY start_evt.timestamp ASC
              LIMIT 1
            )
          ORDER BY end_evt.timestamp ASC
          LIMIT 1
        ) AS app_session_id,
        (
          SELECT start_evt.timestamp
          FROM events end_evt
          JOIN events start_evt
            ON start_evt.event_type = 'app_session_start'
           AND start_evt.user_id = end_evt.user_id
           AND json_extract(start_evt.properties_json, '$.appSessionId') = json_extract(end_evt.properties_json, '$.appSessionId')
          WHERE end_evt.event_type = 'app_session_end'
            AND end_evt.user_id = c.user_id
            AND c.timestamp <= end_evt.timestamp
            AND c.timestamp >= start_evt.timestamp
          ORDER BY end_evt.timestamp ASC
          LIMIT 1
        ) AS session_start_at,
        (
          SELECT end_evt.timestamp
          FROM events end_evt
          WHERE end_evt.event_type = 'app_session_end'
            AND end_evt.user_id = c.user_id
            AND c.timestamp <= end_evt.timestamp
            AND c.timestamp >= (
              SELECT start_evt.timestamp
              FROM events start_evt
              WHERE start_evt.event_type = 'app_session_start'
                AND start_evt.user_id = c.user_id
                AND json_extract(start_evt.properties_json, '$.appSessionId') = json_extract(end_evt.properties_json, '$.appSessionId')
              ORDER BY start_evt.timestamp ASC
              LIMIT 1
            )
          ORDER BY end_evt.timestamp ASC
          LIMIT 1
        ) AS session_end_at,
        (
          SELECT json_extract(end_evt.properties_json, '$.seconds')
          FROM events end_evt
          WHERE end_evt.event_type = 'app_session_end'
            AND end_evt.user_id = c.user_id
            AND c.timestamp <= end_evt.timestamp
            AND c.timestamp >= (
              SELECT start_evt.timestamp
              FROM events start_evt
              WHERE start_evt.event_type = 'app_session_start'
                AND start_evt.user_id = c.user_id
                AND json_extract(start_evt.properties_json, '$.appSessionId') = json_extract(end_evt.properties_json, '$.appSessionId')
              ORDER BY start_evt.timestamp ASC
              LIMIT 1
            )
          ORDER BY end_evt.timestamp ASC
          LIMIT 1
        ) AS session_seconds,
        (
          SELECT json_extract(rt.properties_json, '$.seconds')
          FROM events rt
          WHERE rt.event_type = 'read_time'
            AND rt.user_id = c.user_id
            AND (
              (rt.article_id = c.article_id)
              OR (rt.article_id IS NULL AND c.article_id IS NULL)
            )
            AND (
              (rt.request_id = c.request_id)
              OR (rt.request_id IS NULL AND c.request_id IS NULL)
            )
            AND rt.timestamp >= c.timestamp
          ORDER BY rt.timestamp ASC
          LIMIT 1
        ) AS read_time_seconds
      FROM events c
      WHERE ${conditions.join(" AND ")}
      ORDER BY c.timestamp DESC
      LIMIT @limit
    `
    )
    .all(params);

  if (rows.length === 0) {
    db.close();
    console.log("No article clicks found.");
    return;
  }

  const articleIds = new Set();
  for (const row of rows) {
    if (row.article_id) {
      articleIds.add(row.article_id);
    }
  }

  const dbIndex = loadDbArticleIndex(db, articleIds);
  db.close();

  const output = rows.map((row) => {
    const dbMeta = row.article_id ? dbIndex.get(row.article_id) : null;
    const staticMeta = row.article_id ? staticIndex.get(row.article_id) : null;
    const meta = dbMeta || staticMeta || null;

    return {
      click_at: row.click_at,
      user_id: row.user_id,
      app_session_id: row.app_session_id ?? null,
      session_start_at: row.session_start_at ?? null,
      session_end_at: row.session_end_at ?? null,
      session_seconds: row.session_seconds ?? null,
      article_id: row.article_id,
      title: meta?.title ?? null,
      topic: meta?.topicLabel ?? null,
      category: meta?.category ?? null,
      position: row.position,
      variant_key: row.variant_key,
      request_id: row.request_id,
      read_time_seconds: row.read_time_seconds ?? null,
      analytics_session_id: row.session_id
    };
  });

  console.table(output);
}

main();
