const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH =
  process.env.ANALYTICS_DB_PATH ||
  path.join(__dirname, "analytics-events.db");

function utcDayStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function parseArgs(argv) {
  const args = {
    date: utcDayStamp(),
    category: "All",
    limit: 5,
    articleId: null
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--date" && next) {
      args.date = next;
      i += 1;
      continue;
    }
    if (token === "--category" && next) {
      args.category = next;
      i += 1;
      continue;
    }
    if (token === "--limit" && next) {
      args.limit = Math.max(1, Math.min(50, Number(next) || 5));
      i += 1;
      continue;
    }
    if (token === "--article" && next) {
      args.articleId = next;
      i += 1;
      continue;
    }
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const db = new Database(DB_PATH, { readonly: true });
  const hasSnapshotTables =
    db
      .prepare(
        `
        SELECT COUNT(1) AS c
        FROM sqlite_master
        WHERE type = 'table'
          AND name IN ('snapshot_articles', 'snapshot_article_variants')
      `
      )
      .get().c === 2;

  if (!hasSnapshotTables) {
    db.close();
    console.log(
      "Snapshot tables are not initialized yet. Start `npm run analytics:server` once to run migrations, then retry."
    );
    return;
  }

  const snapshot = db
    .prepare(
      `
      SELECT
        snapshot_id,
        snapshot_date,
        category,
        limit_count,
        provider,
        created_at
      FROM feed_snapshots
      WHERE snapshot_date = @date
        AND category = @category
        AND limit_count = @limit
      ORDER BY created_at DESC
      LIMIT 1
    `
    )
    .get({
      date: args.date,
      category: args.category,
      limit: args.limit
    });

  if (!snapshot) {
    db.close();
    console.log("No matching snapshot found.");
    return;
  }

  const articles = db
    .prepare(
      `
      SELECT
        rank,
        article_id,
        title,
        topic_label,
        category,
        source_uri,
        source_article_uri,
        published_at
      FROM snapshot_articles
      WHERE snapshot_id = @snapshotId
      ORDER BY rank ASC
    `
    )
    .all({ snapshotId: snapshot.snapshot_id });

  console.log(
    `[snapshot] id=${snapshot.snapshot_id} date=${snapshot.snapshot_date} category=${snapshot.category} limit=${snapshot.limit_count} provider=${snapshot.provider} created_at=${snapshot.created_at}`
  );
  console.table(articles);

  if (args.articleId) {
    const variants = db
      .prepare(
        `
        SELECT
          variant_key,
          title,
          lead,
          rewrite_method,
          created_at
        FROM snapshot_article_variants
        WHERE snapshot_id = @snapshotId
          AND article_id = @articleId
        ORDER BY variant_key ASC
      `
      )
      .all({
        snapshotId: snapshot.snapshot_id,
        articleId: args.articleId
      });

    if (variants.length === 0) {
      console.log("No variants found for the requested article.");
    } else {
      console.log(`\n[variants] article_id=${args.articleId}`);
      console.table(variants);
    }
  }

  db.close();
}

main();
