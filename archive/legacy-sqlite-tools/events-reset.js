const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH =
  process.env.ANALYTICS_DB_PATH ||
  path.join(__dirname, "..", "..", "backend", "analytics-events.db");

function main() {
  const db = new Database(DB_PATH);
  const result = db.prepare("DELETE FROM events").run();
  db.close();

  console.log(
    `[analytics-reset] cleared events table. deleted_rows=${result.changes} db=${DB_PATH}`
  );
}

main();

