const path = require("path");
const Database = require("better-sqlite3");
const { loadArticleIndex } = require("./lib/articles-index");

const DB_PATH =
  process.env.ANALYTICS_DB_PATH ||
  path.join(__dirname, "analytics-events.db");

function parseProperties(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildArticleIndex(db, baseIndex, articleIdsSet) {
  const index = new Map(baseIndex);
  const articleIds = [...articleIdsSet].filter(
    (value) => typeof value === "string" && value.length > 0
  );

  if (articleIds.length === 0) {
    return index;
  }

  try {
    const placeholders = articleIds.map(() => "?").join(", ");
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
      index.set(row.article_id, {
        title: row.title ?? null,
        topicLabel: row.topic_label ?? null,
        category: row.category ?? null
      });
    }
  } catch {
    // If articles table is unavailable, keep base index only.
  }

  return index;
}

function buildFeedPreview(orderedIds, articleIndex, full = false) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return null;
  }

  const maxItems = full ? orderedIds.length : 2;
  const shown = orderedIds.slice(0, maxItems);
  const lines = shown.map((id, idx) => {
      const meta = articleIndex.get(id);
      const rawTitle = meta?.title ?? id;
      const title =
        full || rawTitle.length <= 64
          ? rawTitle
          : `${rawTitle.slice(0, 61).trimEnd()}...`;
      const topic = meta?.topicLabel ? ` [${meta.topicLabel}]` : "";
      return `${idx + 1}. ${title}${topic}`;
    });

  const remaining = full ? 0 : orderedIds.length - shown.length;
  if (remaining > 0) {
    lines.push(`(+${remaining} more)`);
  }

  return lines.join(" | ");
}

function parseArgs(argv) {
  const args = {
    limit: 20,
    userId: null,
    eventType: null,
    articleId: null,
    full: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--limit" && next) {
      args.limit = Math.max(1, Math.min(500, Number(next) || 20));
      i += 1;
      continue;
    }
    if (token === "--user" && next) {
      args.userId = next;
      i += 1;
      continue;
    }
    if (token === "--type" && next) {
      args.eventType = next;
      i += 1;
      continue;
    }
    if (token === "--article" && next) {
      args.articleId = next;
      i += 1;
      continue;
    }
    if (token === "--full") {
      args.full = true;
      continue;
    }
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const staticArticleIndex = loadArticleIndex();
  const db = new Database(DB_PATH, { readonly: true });

  const conditions = [];
  const params = { limit: args.limit };

  if (args.userId) {
    conditions.push("user_id = @userId");
    params.userId = args.userId;
  }
  if (args.eventType) {
    conditions.push("event_type = @eventType");
    params.eventType = args.eventType;
  }
  if (args.articleId) {
    conditions.push("article_id = @articleId");
    params.articleId = args.articleId;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `
    SELECT
      timestamp,
      event_type,
      user_id,
      article_id,
      variant_key,
      position,
      request_id,
      properties_json
    FROM events
    ${whereClause}
    ORDER BY timestamp DESC
    LIMIT @limit
  `;

  const rows = db.prepare(query).all(params);
  if (rows.length === 0) {
    db.close();
    console.log("No matching events.");
    return;
  }

  const parsedRows = rows.map((row) => ({
    ...row,
    properties: parseProperties(row.properties_json)
  }));

  const articleIds = new Set();
  for (const row of parsedRows) {
    if (typeof row.article_id === "string" && row.article_id.length > 0) {
      articleIds.add(row.article_id);
    }

    const orderedIds = toSafeArray(row.properties.orderedArticleIds);
    for (const articleId of orderedIds) {
      if (typeof articleId === "string" && articleId.length > 0) {
        articleIds.add(articleId);
      }
    }
  }

  const articleIndex = buildArticleIndex(db, staticArticleIndex, articleIds);
  db.close();

  const enrichedRows = parsedRows.map((row) => {
    const meta = row.article_id ? articleIndex.get(row.article_id) : null;
    const properties = row.properties;
    const orderedIds = toSafeArray(properties.orderedArticleIds);
    const rankScores = Array.isArray(properties.rankScores)
      ? properties.rankScores
      : null;

    return {
      timestamp: row.timestamp,
      event_type: row.event_type,
      user_id: row.user_id,
      article_id: row.article_id,
      title: meta?.title ?? null,
      topic: meta?.topicLabel ?? null,
      category: meta?.category ?? null,
      variant_key: row.variant_key,
      position: row.position,
      request_id: row.request_id,
      field: properties.field ?? null,
      value: properties.value ?? null,
      session_seconds: properties.seconds ?? null,
      app_session_id: properties.appSessionId ?? null,
      snapshot_id: properties.snapshotId ?? null,
      snapshot_date: properties.snapshotDate ?? null,
      feed_category: properties.category ?? null,
      result_count: properties.resultCount ?? null,
      ordered_article_ids: orderedIds.length > 0 ? orderedIds.join(">") : null,
      feed_preview: buildFeedPreview(orderedIds, articleIndex, args.full),
      rank_scores: rankScores ? JSON.stringify(rankScores) : null,
      source: properties.source ?? null
    };
  });

  if (args.eventType === "feed_response") {
    const feedRows = enrichedRows.map((row) => ({
      timestamp: row.timestamp,
      user_id: row.user_id,
      request_id: row.request_id,
      snapshot_id: row.snapshot_id,
      snapshot_date: row.snapshot_date,
      feed_category: row.feed_category,
      result_count: row.result_count,
      feed_preview: row.feed_preview
    }));
    if (args.full) {
      for (const row of feedRows) {
        const fullRow = enrichedRows.find(
          (item) =>
            item.request_id === row.request_id &&
            item.timestamp === row.timestamp &&
            item.user_id === row.user_id
        );
        row.ordered_article_ids = fullRow?.ordered_article_ids ?? null;
      }
    }
    console.table(feedRows);
    return;
  }

  console.table(enrichedRows);
}

main();
