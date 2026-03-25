const path = require("path");
const Database = require("better-sqlite3");
const { loadArticleIndex } = require("./lib/articles-index");

const DB_PATH =
  process.env.ANALYTICS_DB_PATH ||
  path.join(__dirname, "analytics-events.db");

function parseArgs(argv) {
  const args = {
    limit: 20,
    userId: null,
    table: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--limit" && next) {
      args.limit = Math.max(1, Math.min(200, Number(next) || 20));
      i += 1;
      continue;
    }
    if (token === "--user" && next) {
      args.userId = next;
      i += 1;
      continue;
    }
    if (token === "--table") {
      args.table = true;
      continue;
    }
  }

  return args;
}

function parseProperties(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function describeTailorChange(field, value) {
  if (field === "factsOnly") {
    return value
      ? "turned Facts Only on (more neutral/factual wording)"
      : "turned Facts Only off";
  }

  if (field === "tone") {
    if (typeof value === "number") {
      if (value < 0) return `set tone to ${value} (more negative framing)`;
      if (value > 0) return `set tone to ${value} (more positive framing)`;
      return "set tone to 0 (neutral framing)";
    }
    return `updated tone to ${value}`;
  }

  if (field === "complexity") {
    if (typeof value === "number") {
      if (value < 0) return `set complexity to ${value} (simpler language)`;
      if (value > 0) return `set complexity to ${value} (more detailed language)`;
      return "set complexity to 0 (neutral complexity)";
    }
    return `updated complexity to ${value}`;
  }

  return `changed ${field} to ${value}`;
}

function buildNarrative(session, eventsInSession, getArticleMeta) {
  const feedRequests = eventsInSession.filter((e) => e.event_type === "feed_request");
  const impressions = eventsInSession.filter((e) => e.event_type === "impression");
  const articleOpen = eventsInSession.find((e) => e.event_type === "article_open");
  const tailorChanges = eventsInSession.filter((e) => e.event_type === "tailor_change");
  const readTimeCandidates = eventsInSession.filter((e) => e.event_type === "read_time");

  const parts = [];

  if (feedRequests.length > 0) {
    const categories = new Set(
      feedRequests
        .map((e) => parseProperties(e.properties_json).category)
        .filter((v) => typeof v === "string" && v.length > 0)
    );
    if (categories.size > 0) {
      parts.push(`opened ${Array.from(categories).join(", ")} feed`);
    } else {
      parts.push("opened feed");
    }
  }

  if (impressions.length > 0) {
    parts.push(`saw ${impressions.length} impressions (article cards)`);
  }

  if (articleOpen) {
    const meta = articleOpen.article_id
      ? getArticleMeta(articleOpen.article_id)
      : null;
    const title = meta?.title ?? articleOpen.article_id ?? "unknown article";
    const topic = meta?.topicLabel ?? "unknown topic";
    const pos = articleOpen.position != null ? ` at position ${articleOpen.position}` : "";
    parts.push(`clicked "${title}" [topic: ${topic}]${pos}`);
  }

  if (tailorChanges.length > 0) {
    const changeDescriptions = tailorChanges
      .map((row) => {
        const props = parseProperties(row.properties_json);
        return describeTailorChange(props.field, props.value);
      })
      .slice(-3);

    parts.push(`Tailor changes: ${changeDescriptions.join("; ")}`);
  }

  if (articleOpen) {
    const matchedReadTime = readTimeCandidates.find((row) => {
      const sameArticle =
        (row.article_id || null) === (articleOpen.article_id || null);
      const sameRequest =
        (row.request_id || null) === (articleOpen.request_id || null);
      const afterOpen = row.timestamp >= articleOpen.timestamp;
      return sameArticle && sameRequest && afterOpen;
    });

    if (matchedReadTime) {
      const props = parseProperties(matchedReadTime.properties_json);
      if (typeof props.seconds === "number") {
        parts.push(`read for ${props.seconds}s`);
      }
    }
  }

  if (parts.length === 0) {
    parts.push("no major tracked actions in this session");
  }

  return parts.join(", ");
}

function main() {
  const args = parseArgs(process.argv);
  const staticArticleIndex = loadArticleIndex();
  const db = new Database(DB_PATH, { readonly: true });
  const articleMetaStmt = db.prepare(
    `
      SELECT
        title,
        topic_label,
        category
      FROM articles
      WHERE article_id = @articleId
      LIMIT 1
    `
  );
  const articleMetaCache = new Map();

  function getArticleMeta(articleId) {
    if (!articleId) {
      return null;
    }

    if (articleMetaCache.has(articleId)) {
      return articleMetaCache.get(articleId);
    }

    const staticMeta = staticArticleIndex.get(articleId) ?? null;
    if (staticMeta) {
      articleMetaCache.set(articleId, staticMeta);
      return staticMeta;
    }

    let resolved = null;
    try {
      const row = articleMetaStmt.get({ articleId });
      if (row) {
        resolved = {
          title: row.title ?? null,
          topicLabel: row.topic_label ?? null,
          category: row.category ?? null
        };
      }
    } catch {
      resolved = null;
    }

    articleMetaCache.set(articleId, resolved);
    return resolved;
  }

  const conditions = ["e.event_type = 'app_session_end'"];
  const params = { limit: args.limit };

  if (args.userId) {
    conditions.push("e.user_id = @userId");
    params.userId = args.userId;
  }

  const sessions = db
    .prepare(
      `
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
    `
    )
    .all(params);

  if (sessions.length === 0) {
    db.close();
    console.log("No completed app sessions found.");
    return;
  }

  const rows = sessions.map((session) => {
    const eventsInSession = db
      .prepare(
        `
        SELECT
          timestamp,
          event_type,
          article_id,
          request_id,
          position,
          properties_json
        FROM events
        WHERE user_id = @userId
          AND timestamp >= @startAt
          AND timestamp <= @endAt
        ORDER BY timestamp ASC
      `
      )
      .all({
        userId: session.user_id,
        startAt: session.session_start_at,
        endAt: session.session_end_at
      });

    return {
      session_start_at: session.session_start_at,
      session_end_at: session.session_end_at,
      user_id: session.user_id,
      app_session_id: session.app_session_id,
      seconds: session.seconds,
      narrative: buildNarrative(session, eventsInSession, getArticleMeta)
    };
  });

  db.close();

  if (args.table) {
    console.table(rows);
    return;
  }

  rows.forEach((row, index) => {
    console.log(`\nSession ${index + 1}`);
    console.log(`- user: ${row.user_id}`);
    console.log(`- app_session_id: ${row.app_session_id}`);
    console.log(`- start: ${row.session_start_at ?? "unknown"}`);
    console.log(`- end: ${row.session_end_at}`);
    console.log(`- seconds: ${row.seconds}`);
    console.log(`- narrative: ${row.narrative}`);
  });
}

main();
