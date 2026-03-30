const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH =
  process.env.ANALYTICS_DB_PATH ||
  path.join(__dirname, "..", "..", "backend", "analytics-events.db");

function main() {
  const db = new Database(DB_PATH, { readonly: true });

  const totals = db
    .prepare(
      `
      SELECT COUNT(*) AS total_events,
             COUNT(DISTINCT user_id) AS distinct_users,
             COUNT(DISTINCT request_id) AS distinct_requests,
             MIN(timestamp) AS first_timestamp,
             MAX(timestamp) AS last_timestamp
      FROM events
    `
    )
    .get();

  const byEventType = db
    .prepare(
      `
      SELECT event_type, COUNT(*) AS count
      FROM events
      GROUP BY event_type
      ORDER BY count DESC
    `
    )
    .all();

  const byUser = db
    .prepare(
      `
      SELECT user_id, COUNT(*) AS count
      FROM events
      GROUP BY user_id
      ORDER BY count DESC
    `
    )
    .all();

  const byEventTypeAndUser = db
    .prepare(
      `
      SELECT user_id, event_type, COUNT(*) AS count
      FROM events
      GROUP BY user_id, event_type
      ORDER BY user_id ASC, count DESC
    `
    )
    .all();

  db.close();

  console.log("\n[analytics-summary] totals");
  console.table([totals]);

  console.log("\n[analytics-summary] by event_type");
  console.table(byEventType);

  console.log("\n[analytics-summary] by user");
  console.table(byUser);

  console.log("\n[analytics-summary] by user + event_type");
  console.table(byEventTypeAndUser);
}

main();

