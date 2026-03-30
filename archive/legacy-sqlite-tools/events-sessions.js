const path = require("path");
const Database = require("better-sqlite3");

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
  const db = new Database(DB_PATH, { readonly: true });

  const conditions = ["event_type = 'app_session_end'"];
  const params = { limit: args.limit };

  if (args.userId) {
    conditions.push("user_id = @userId");
    params.userId = args.userId;
  }

  const query = `
    SELECT
      e.timestamp AS session_end_at,
      e.user_id,
      json_extract(e.properties_json, '$.appSessionId') AS app_session_id,
      json_extract(e.properties_json, '$.seconds') AS seconds,
      (
        SELECT s.timestamp
        FROM events s
        WHERE s.event_type = 'app_session_start'
          AND s.user_id = e.user_id
          AND json_extract(s.properties_json, '$.appSessionId') = json_extract(e.properties_json, '$.appSessionId')
        ORDER BY s.timestamp ASC
        LIMIT 1
      ) AS session_start_at
    FROM events e
    WHERE ${conditions.join(" AND ")}
    ORDER BY e.timestamp DESC
    LIMIT @limit
  `;

  const rows = db.prepare(query).all(params);
  db.close();

  if (rows.length === 0) {
    console.log("No app_session_end events found.");
    return;
  }

  console.table(rows);
}

main();

