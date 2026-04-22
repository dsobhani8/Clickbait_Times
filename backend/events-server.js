const express = require("express");
const cors = require("cors");
const path = require("path");
const Database = require("better-sqlite3");
const { Pool } = require("pg");
const { fetchNewsApiArticles } = require("./newsapi-client");
const {
  FEED_SELECTOR_CANDIDATES_PER_TOPIC,
  FEED_SELECTOR_ENABLED,
  FEED_SELECTOR_FRESH_ONLY,
  FEED_SELECTOR_METHOD,
  FEED_SELECTOR_MODEL,
  selectFeedArticlesForTopic
} = require("./feed-selector");
const { buildVariants } = require("./rewrite-variants");
const {
  ALL_VARIANT_KEYS,
  LLM_VARIANT_KEYS,
  buildDefaultVariantMethodMap
} = require("./rewrite-specs");
const {
  currentRewriteMethod,
  isToneLlmEnabled,
  OPENAI_MODEL,
  OPENAI_TEMPERATURE,
  REWRITE_MAX_ATTEMPTS,
  REWRITE_PIPELINE,
  REWRITE_TIMEOUT_MS,
  REWRITE_MODE,
  TONE_LLM_PENDING_METHOD,
  rewriteVariantForArticle,
  RULE_REWRITE_METHOD,
  TONE_LLM_METHOD
} = require("./rewrite-tone-llm");
const {
  VALID_ARMS,
  getClickbaitExperimentAssignment
} = require("./experiments");
const { normalizeProlificPid } = require("./participant-identity");
const {
  TOPIC_CLASSIFIER_METHOD,
  TOPIC_CLASSIFIER_MODEL,
  TOPIC_CLASSIFIER_ENABLED,
  TOPIC_CLASSIFIER_BATCH_SIZE,
  TOPIC_DEFAULT_FILTERS_CSV,
  TOPIC_NONE,
  classifyArticlesMetadataBatch,
  normalizeTopic,
  parseTopicListCsv
} = require("./topic-classifier");

const PORT = Number(process.env.PORT || process.env.ANALYTICS_SERVER_PORT || 8787);
const DB_PATH =
  process.env.ANALYTICS_DB_PATH ||
  path.join(__dirname, "analytics-events.db");
const SUPABASE_DB_URL = (process.env.SUPABASE_DB_URL || "").trim();
const POSTGRES_ENABLED = SUPABASE_DB_URL.length > 0;
const SCHEMA_VERSION = 1;
const NEWSAPI_AI_KEY = process.env.NEWSAPI_AI_KEY || "";
const NEWSAPI_AI_SOURCE_URI = process.env.NEWSAPI_AI_SOURCE_URI || "";
const NEWSAPI_AI_SOURCE_KEYWORD =
  process.env.NEWSAPI_AI_SOURCE_KEYWORD || "Associated Press";
const FEED_CACHE_TTL_MS_RAW = Number(process.env.FEED_CACHE_TTL_MS || 5 * 60 * 1000);
const FEED_CACHE_TTL_MS = Number.isFinite(FEED_CACHE_TTL_MS_RAW)
  ? Math.max(1000, FEED_CACHE_TTL_MS_RAW)
  : 5 * 60 * 1000;
const FEED_TOPIC_TARGETS = Object.freeze(
  parseTopicListCsv(process.env.FEED_TOPIC_FILTERS || TOPIC_DEFAULT_FILTERS_CSV)
);
const FEED_FETCH_MULTIPLIER_RAW = Number(process.env.FEED_FETCH_MULTIPLIER || 8);
const FEED_FETCH_MULTIPLIER = Number.isFinite(FEED_FETCH_MULTIPLIER_RAW)
  ? Math.max(2, Math.min(20, Math.round(FEED_FETCH_MULTIPLIER_RAW)))
  : 8;
const FEED_FETCH_MIN_RAW = Number(process.env.FEED_FETCH_MIN || 30);
const FEED_FETCH_MIN = Number.isFinite(FEED_FETCH_MIN_RAW)
  ? Math.max(10, Math.min(200, Math.round(FEED_FETCH_MIN_RAW)))
  : 30;
const FEED_FETCH_PAGE_LIMIT_MAX = 100;
const FEED_FETCH_MAX_PAGES_RAW = Number(process.env.FEED_FETCH_MAX_PAGES || 6);
const FEED_FETCH_MAX_PAGES = Number.isFinite(FEED_FETCH_MAX_PAGES_RAW)
  ? Math.max(1, Math.min(20, Math.round(FEED_FETCH_MAX_PAGES_RAW)))
  : 6;
const FEED_PER_TOPIC_TARGET_RAW = Number(
  process.env.FEED_PER_TOPIC_TARGET || 3
);
const FEED_PER_TOPIC_TARGET = Number.isFinite(FEED_PER_TOPIC_TARGET_RAW)
  ? Math.max(1, Math.min(10, Math.round(FEED_PER_TOPIC_TARGET_RAW)))
  : 3;
const FEED_MIN_WORDS_RAW = Number(process.env.FEED_MIN_WORDS || 100);
const FEED_MIN_WORDS = Number.isFinite(FEED_MIN_WORDS_RAW)
  ? Math.max(0, Math.min(5000, Math.round(FEED_MIN_WORDS_RAW)))
  : 100;
const FEED_MAX_WORDS_RAW = Number(process.env.FEED_MAX_WORDS || 1500);
const FEED_MAX_WORDS = Number.isFinite(FEED_MAX_WORDS_RAW)
  ? Math.max(FEED_MIN_WORDS, Math.min(20000, Math.round(FEED_MAX_WORDS_RAW)))
  : Math.max(FEED_MIN_WORDS, 1500);
const FEED_FRESH_ARTICLE_MAX_AGE_HOURS_RAW = Number(
  process.env.FEED_FRESH_ARTICLE_MAX_AGE_HOURS || 48
);
const FEED_FRESH_ARTICLE_MAX_AGE_HOURS = Number.isFinite(
  FEED_FRESH_ARTICLE_MAX_AGE_HOURS_RAW
)
  ? Math.max(1, Math.min(24 * 30, Math.round(FEED_FRESH_ARTICLE_MAX_AGE_HOURS_RAW)))
  : 48;
const FEED_FRESH_ARTICLE_MAX_AGE_MS =
  FEED_FRESH_ARTICLE_MAX_AGE_HOURS * 60 * 60 * 1000;
const FEED_WAIT_FOR_REWRITE =
  String(process.env.FEED_WAIT_FOR_REWRITE || "1").trim() !== "0";
const DAILY_REFRESH_ENABLED =
  String(process.env.DAILY_REFRESH_ENABLED || "0").trim() === "1";
const DAILY_REFRESH_CATEGORY =
  (process.env.DAILY_REFRESH_CATEGORY || "All").trim() || "All";
const DAILY_REFRESH_LIMIT_RAW = Number(process.env.DAILY_REFRESH_LIMIT || 0);
const DAILY_REFRESH_LIMIT = Number.isFinite(DAILY_REFRESH_LIMIT_RAW)
  ? Math.max(0, Math.min(50, Math.round(DAILY_REFRESH_LIMIT_RAW)))
  : 0;
const DAILY_REFRESH_INTERVAL_MS_RAW = Number(
  process.env.DAILY_REFRESH_INTERVAL_MS || 5 * 60 * 1000
);
const DAILY_REFRESH_INTERVAL_MS = Number.isFinite(DAILY_REFRESH_INTERVAL_MS_RAW)
  ? Math.max(30_000, DAILY_REFRESH_INTERVAL_MS_RAW)
  : 5 * 60 * 1000;
const PIPELINE_ADMIN_TOKEN = (process.env.PIPELINE_ADMIN_TOKEN || "").trim();
const REWRITE_JOB_STALE_RUNNING_MINUTES_RAW = Number(
  process.env.REWRITE_JOB_STALE_RUNNING_MINUTES || 20
);
const REWRITE_JOB_STALE_RUNNING_MINUTES = Number.isFinite(
  REWRITE_JOB_STALE_RUNNING_MINUTES_RAW
)
  ? Math.max(1, Math.min(240, Math.round(REWRITE_JOB_STALE_RUNNING_MINUTES_RAW)))
  : 20;
const SNAPSHOT_STATUS_BUILDING = "building";
const SNAPSHOT_STATUS_READY = "ready";
const SNAPSHOT_STATUS_FAILED = "failed";
const REWRITE_JOB_STATUS_PENDING = "pending";
const REWRITE_JOB_STATUS_RUNNING = "running";
const REWRITE_JOB_STATUS_SUCCEEDED = "succeeded";
const REWRITE_JOB_STATUS_FAILED = "failed";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const pgPool = POSTGRES_ENABLED
  ? new Pool({
      connectionString: SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    event_id TEXT PRIMARY KEY,
    schema_version INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    surface TEXT,
    request_id TEXT,
    article_id TEXT,
    variant_key TEXT,
    position INTEGER,
    properties_json TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
  CREATE INDEX IF NOT EXISTS idx_events_user_timestamp ON events(user_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON events(event_type, timestamp);
  CREATE INDEX IF NOT EXISTS idx_events_article_timestamp ON events(article_id, timestamp);
  CREATE TABLE IF NOT EXISTS articles (
    article_id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT,
    topic_label TEXT,
    topic_tag TEXT,
    published_minutes_ago INTEGER,
    lead TEXT,
    body_json TEXT,
    image TEXT,
    source_name TEXT,
    source_uri TEXT,
    source_article_uri TEXT,
    published_at TEXT,
    metadata_json TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS feed_snapshots (
    snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TEXT NOT NULL,
    category TEXT NOT NULL,
    limit_count INTEGER NOT NULL,
    provider TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'building',
    started_at TEXT,
    completed_at TEXT,
    published_at TEXT,
    error_message TEXT,
    UNIQUE(snapshot_date, category, limit_count, provider)
  );
  CREATE TABLE IF NOT EXISTS feed_snapshot_items (
    snapshot_id INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    article_id TEXT NOT NULL,
    PRIMARY KEY (snapshot_id, rank),
    FOREIGN KEY(snapshot_id) REFERENCES feed_snapshots(snapshot_id),
    FOREIGN KEY(article_id) REFERENCES articles(article_id)
  );
  CREATE TABLE IF NOT EXISTS snapshot_articles (
    snapshot_id INTEGER NOT NULL,
    snapshot_date TEXT NOT NULL,
    article_id TEXT NOT NULL,
    rank INTEGER NOT NULL,
    title TEXT NOT NULL,
    lead TEXT,
    body_json TEXT,
    category TEXT,
    topic_label TEXT,
    topic_tag TEXT,
    image TEXT,
    source_name TEXT,
    source_uri TEXT,
    source_article_uri TEXT,
    published_at TEXT,
    captured_at TEXT NOT NULL,
    PRIMARY KEY (snapshot_id, article_id),
    FOREIGN KEY(snapshot_id) REFERENCES feed_snapshots(snapshot_id)
  );
  CREATE TABLE IF NOT EXISTS snapshot_article_variants (
    snapshot_id INTEGER NOT NULL,
    snapshot_date TEXT NOT NULL,
    article_id TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    title TEXT NOT NULL,
    lead TEXT,
    body_json TEXT,
    rewrite_method TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (snapshot_id, article_id, variant_key),
    FOREIGN KEY(snapshot_id) REFERENCES feed_snapshots(snapshot_id)
  );
  CREATE TABLE IF NOT EXISTS current_snapshots (
    category TEXT NOT NULL,
    limit_count INTEGER NOT NULL,
    provider TEXT NOT NULL,
    snapshot_id INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (category, limit_count, provider),
    FOREIGN KEY(snapshot_id) REFERENCES feed_snapshots(snapshot_id)
  );
  CREATE TABLE IF NOT EXISTS rewrite_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL,
    article_id TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(snapshot_id, article_id, variant_key),
    FOREIGN KEY(snapshot_id) REFERENCES feed_snapshots(snapshot_id)
  );
  CREATE INDEX IF NOT EXISTS idx_rewrite_jobs_status_snapshot
    ON rewrite_jobs(status, snapshot_id);
  CREATE TABLE IF NOT EXISTS topic_classification_audit_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    snapshot_date TEXT,
    category TEXT,
    limit_count INTEGER,
    provider TEXT NOT NULL,
    source_uri TEXT,
    classifier_method TEXT,
    classifier_model TEXT,
    classifier_batch_size INTEGER,
    feed_per_topic_target INTEGER,
    fresh_article_max_age_hours INTEGER,
    pages_fetched INTEGER,
    fetched_count INTEGER,
    audited_count INTEGER,
    eligible_count INTEGER,
    selected_count INTEGER,
    snapshot_id INTEGER,
    status TEXT NOT NULL,
    error_message TEXT,
    metadata_json TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_topic_audit_runs_created
    ON topic_classification_audit_runs(created_at DESC, id DESC);
  CREATE TABLE IF NOT EXISTS topic_classification_audit_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    provider_rank INTEGER NOT NULL,
    article_id TEXT,
    title TEXT NOT NULL,
    lead TEXT,
    published_at TEXT,
    word_count INTEGER,
    length_ok INTEGER NOT NULL,
    is_fresh INTEGER NOT NULL,
    classified_topic TEXT,
    topic_tag TEXT,
    eligible_for_feed INTEGER NOT NULL,
    selected_for_snapshot INTEGER NOT NULL,
    skip_reason TEXT,
    classifier_status TEXT,
    fallback_used INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT,
    FOREIGN KEY(run_id) REFERENCES topic_classification_audit_runs(id)
  );
  CREATE INDEX IF NOT EXISTS idx_topic_audit_items_run_rank
    ON topic_classification_audit_items(run_id, provider_rank);
  CREATE TABLE IF NOT EXISTS participant_accounts (
    prolific_pid TEXT PRIMARY KEY,
    auth_user_id TEXT NOT NULL UNIQUE,
    login_email TEXT NOT NULL UNIQUE,
    experiment_arm TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    password_issued_at TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_participant_accounts_auth_user
    ON participant_accounts(auth_user_id);
`);

function ensureColumn(tableName, columnDefinition) {
  try {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes("duplicate column name")) {
      throw error;
    }
  }
}

ensureColumn("articles", "topic_tag TEXT");
ensureColumn("snapshot_articles", "topic_tag TEXT");
ensureColumn("feed_snapshots", "status TEXT");
ensureColumn("feed_snapshots", "started_at TEXT");
ensureColumn("feed_snapshots", "completed_at TEXT");
ensureColumn("feed_snapshots", "published_at TEXT");
ensureColumn("feed_snapshots", "error_message TEXT");
db.exec(`
  UPDATE feed_snapshots
  SET status = 'ready'
  WHERE status IS NULL OR trim(status) = '';
  UPDATE feed_snapshots
  SET published_at = COALESCE(published_at, created_at)
  WHERE status = 'ready' AND (published_at IS NULL OR trim(published_at) = '');
`);

async function pgQuery(sql, params = [], client = null) {
  if (!POSTGRES_ENABLED || !pgPool) {
    throw new Error("Postgres is not enabled.");
  }
  if (client) {
    return client.query(sql, params);
  }
  return pgPool.query(sql, params);
}

async function getParticipantAccountByAuthUserId(authUserId) {
  if (typeof authUserId !== "string" || authUserId.trim().length === 0) {
    return null;
  }
  const normalizedAuthUserId = authUserId.trim();
  if (!POSTGRES_ENABLED) {
    const row = db
      .prepare(
        `
          SELECT
            prolific_pid,
            auth_user_id,
            login_email,
            experiment_arm,
            status,
            password_issued_at,
            metadata_json,
            created_at,
            updated_at
          FROM participant_accounts
          WHERE auth_user_id = @authUserId
          LIMIT 1
        `
      )
      .get({ authUserId: normalizedAuthUserId });
    if (!row) {
      return null;
    }
    return {
      prolificPid: row.prolific_pid,
      authUserId: row.auth_user_id,
      loginEmail: row.login_email,
      experimentArm: row.experiment_arm,
      status: row.status,
      passwordIssuedAt: row.password_issued_at,
      metadata:
        typeof row.metadata_json === "string" && row.metadata_json.length > 0
          ? JSON.parse(row.metadata_json)
          : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  const result = await pgQuery(
    `
      SELECT
        prolific_pid,
        auth_user_id,
        login_email,
        experiment_arm,
        status,
        password_issued_at,
        metadata_json,
        created_at,
        updated_at
      FROM participant_accounts
      WHERE auth_user_id = $1
      LIMIT 1
    `,
    [normalizedAuthUserId]
  );
  const row = Array.isArray(result.rows) && result.rows.length > 0 ? result.rows[0] : null;
  if (!row) {
    return null;
  }
  return {
    prolificPid: row.prolific_pid,
    authUserId: row.auth_user_id,
    loginEmail: row.login_email,
    experimentArm: row.experiment_arm,
    status: row.status,
    passwordIssuedAt: row.password_issued_at,
    metadata:
      typeof row.metadata_json === "string" && row.metadata_json.length > 0
        ? JSON.parse(row.metadata_json)
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function ensurePostgresSchema() {
  if (!POSTGRES_ENABLED || !pgPool) {
    return;
  }

  await pgQuery(`
    CREATE TABLE IF NOT EXISTS events (
      event_id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      surface TEXT,
      request_id TEXT,
      article_id TEXT,
      variant_key TEXT,
      position INTEGER,
      properties_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_user_timestamp ON events(user_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_type_timestamp ON events(event_type, timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_article_timestamp ON events(article_id, timestamp);
    CREATE TABLE IF NOT EXISTS articles (
      article_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT,
      topic_label TEXT,
      topic_tag TEXT,
      published_minutes_ago INTEGER,
      lead TEXT,
      body_json TEXT,
      image TEXT,
      source_name TEXT,
      source_uri TEXT,
      source_article_uri TEXT,
      published_at TEXT,
      metadata_json TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feed_snapshots (
      snapshot_id BIGSERIAL PRIMARY KEY,
      snapshot_date TEXT NOT NULL,
      category TEXT NOT NULL,
      limit_count INTEGER NOT NULL,
      provider TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'building',
      started_at TEXT,
      completed_at TEXT,
      published_at TEXT,
      error_message TEXT,
      UNIQUE(snapshot_date, category, limit_count, provider)
    );
    CREATE TABLE IF NOT EXISTS feed_snapshot_items (
      snapshot_id BIGINT NOT NULL,
      rank INTEGER NOT NULL,
      article_id TEXT NOT NULL,
      PRIMARY KEY (snapshot_id, rank)
    );
    CREATE TABLE IF NOT EXISTS snapshot_articles (
      snapshot_id BIGINT NOT NULL,
      snapshot_date TEXT NOT NULL,
      article_id TEXT NOT NULL,
      rank INTEGER NOT NULL,
      title TEXT NOT NULL,
      lead TEXT,
      body_json TEXT,
      category TEXT,
      topic_label TEXT,
      topic_tag TEXT,
      image TEXT,
      source_name TEXT,
      source_uri TEXT,
      source_article_uri TEXT,
      published_at TEXT,
      captured_at TEXT NOT NULL,
      PRIMARY KEY (snapshot_id, article_id)
    );
    CREATE TABLE IF NOT EXISTS snapshot_article_variants (
      snapshot_id BIGINT NOT NULL,
      snapshot_date TEXT NOT NULL,
      article_id TEXT NOT NULL,
      variant_key TEXT NOT NULL,
      title TEXT NOT NULL,
      lead TEXT,
      body_json TEXT,
      rewrite_method TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (snapshot_id, article_id, variant_key)
    );
    CREATE TABLE IF NOT EXISTS current_snapshots (
      category TEXT NOT NULL,
      limit_count INTEGER NOT NULL,
      provider TEXT NOT NULL,
      snapshot_id BIGINT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (category, limit_count, provider)
    );
    CREATE TABLE IF NOT EXISTS rewrite_jobs (
      id BIGSERIAL PRIMARY KEY,
      snapshot_id BIGINT NOT NULL,
      article_id TEXT NOT NULL,
      variant_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      last_error TEXT,
      started_at TEXT,
      finished_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (snapshot_id, article_id, variant_key)
    );
    CREATE INDEX IF NOT EXISTS idx_rewrite_jobs_status_snapshot
      ON rewrite_jobs(status, snapshot_id);
    CREATE TABLE IF NOT EXISTS topic_classification_audit_runs (
      id BIGSERIAL PRIMARY KEY,
      created_at TEXT NOT NULL,
      snapshot_date TEXT,
      category TEXT,
      limit_count INTEGER,
      provider TEXT NOT NULL,
      source_uri TEXT,
      classifier_method TEXT,
      classifier_model TEXT,
      classifier_batch_size INTEGER,
      feed_per_topic_target INTEGER,
      fresh_article_max_age_hours INTEGER,
      pages_fetched INTEGER,
      fetched_count INTEGER,
      audited_count INTEGER,
      eligible_count INTEGER,
      selected_count INTEGER,
      snapshot_id BIGINT,
      status TEXT NOT NULL,
      error_message TEXT,
      metadata_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_topic_audit_runs_created
      ON topic_classification_audit_runs(created_at DESC, id DESC);
    CREATE TABLE IF NOT EXISTS topic_classification_audit_items (
      id BIGSERIAL PRIMARY KEY,
      run_id BIGINT NOT NULL REFERENCES topic_classification_audit_runs(id),
      provider_rank INTEGER NOT NULL,
      article_id TEXT,
      title TEXT NOT NULL,
      lead TEXT,
      published_at TEXT,
      word_count INTEGER,
      length_ok BOOLEAN NOT NULL,
      is_fresh BOOLEAN NOT NULL,
      classified_topic TEXT,
      topic_tag TEXT,
      eligible_for_feed BOOLEAN NOT NULL,
      selected_for_snapshot BOOLEAN NOT NULL,
      skip_reason TEXT,
      classifier_status TEXT,
      fallback_used BOOLEAN NOT NULL DEFAULT false,
      metadata_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_topic_audit_items_run_rank
      ON topic_classification_audit_items(run_id, provider_rank);
    CREATE TABLE IF NOT EXISTS participant_accounts (
      prolific_pid TEXT PRIMARY KEY,
      auth_user_id TEXT NOT NULL UNIQUE,
      login_email TEXT NOT NULL UNIQUE,
      experiment_arm TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      password_issued_at TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_participant_accounts_auth_user
      ON participant_accounts(auth_user_id);
  `);

  await pgQuery(`
    ALTER TABLE feed_snapshots ADD COLUMN IF NOT EXISTS status TEXT;
    ALTER TABLE feed_snapshots ADD COLUMN IF NOT EXISTS started_at TEXT;
    ALTER TABLE feed_snapshots ADD COLUMN IF NOT EXISTS completed_at TEXT;
    ALTER TABLE feed_snapshots ADD COLUMN IF NOT EXISTS published_at TEXT;
    ALTER TABLE feed_snapshots ADD COLUMN IF NOT EXISTS error_message TEXT;
    UPDATE feed_snapshots
    SET status = 'ready'
    WHERE status IS NULL OR btrim(status) = '';
    UPDATE feed_snapshots
    SET published_at = COALESCE(published_at, created_at)
    WHERE status = 'ready' AND (published_at IS NULL OR btrim(published_at) = '');
  `);
}

const insertEventStmt = db.prepare(`
  INSERT OR IGNORE INTO events (
    event_id,
    schema_version,
    event_type,
    timestamp,
    user_id,
    session_id,
    surface,
    request_id,
    article_id,
    variant_key,
    position,
    properties_json
  ) VALUES (
    @eventId,
    @schemaVersion,
    @eventType,
    @timestamp,
    @userId,
    @sessionId,
    @surface,
    @requestId,
    @articleId,
    @variantKey,
    @position,
    @propertiesJson
  );
`);

const articleCache = new Map();
const feedCache = new Map();
const rewriteJobsInFlight = new Set();
let dailyRefreshInFlight = false;
let dailyRefreshLastSuccessDate = null;
let dailyRefreshLastAttemptAt = null;

const findDailySnapshotStmt = db.prepare(`
  SELECT
    fs.snapshot_id,
    fs.snapshot_date,
    fs.category,
    fs.limit_count,
    fs.provider,
    fs.created_at,
    fs.status,
    fs.started_at,
    fs.completed_at,
    fs.published_at,
    fs.error_message
  FROM feed_snapshots fs
  WHERE fs.snapshot_date = @snapshotDate
    AND fs.category = @category
    AND fs.limit_count = @limitCount
    AND fs.provider = @provider
  LIMIT 1
`);

const findLatestSnapshotForCategoryStmt = db.prepare(`
  SELECT
    fs.snapshot_id
  FROM feed_snapshots fs
  WHERE fs.category = @category
    AND fs.provider = @provider
    AND fs.snapshot_date = @snapshotDate
    AND fs.limit_count = @limitCount
  ORDER BY fs.snapshot_date DESC, fs.created_at DESC, fs.snapshot_id DESC
  LIMIT 1
`);

const findSnapshotByIdStmt = db.prepare(`
  SELECT
    fs.snapshot_id,
    fs.snapshot_date,
    fs.category,
    fs.limit_count,
    fs.provider,
    fs.created_at,
    fs.status,
    fs.started_at,
    fs.completed_at,
    fs.published_at,
    fs.error_message
  FROM feed_snapshots fs
  WHERE fs.snapshot_id = @snapshotId
  LIMIT 1
`);

const listSnapshotsByDateStmt = db.prepare(`
  SELECT
    fs.snapshot_id,
    fs.snapshot_date,
    fs.category,
    fs.limit_count,
    fs.provider,
    fs.created_at,
    fs.status,
    fs.published_at,
    (
      SELECT COUNT(*)
      FROM snapshot_articles sa
      WHERE sa.snapshot_id = fs.snapshot_id
    ) AS article_count
  FROM feed_snapshots fs
  WHERE fs.snapshot_date = @snapshotDate
  ORDER BY fs.created_at DESC, fs.snapshot_id DESC
`);

const listDailySnapshotArticlesStmt = db.prepare(`
  SELECT
    sa.rank,
    sa.article_id,
    sa.category,
    sa.title,
    sa.topic_label,
    sa.topic_tag,
    sa.lead,
    sa.body_json,
    sa.image,
    sa.source_name,
    sa.source_uri,
    sa.source_article_uri,
    sa.published_at
  FROM snapshot_articles sa
  WHERE sa.snapshot_id = @snapshotId
  ORDER BY sa.rank ASC
`);

const listSnapshotVariantsBySnapshotStmt = db.prepare(`
  SELECT
    article_id,
    variant_key,
    title,
    lead,
    body_json
  FROM snapshot_article_variants
  WHERE snapshot_id = @snapshotId
`);

const upsertArticleStmt = db.prepare(`
  INSERT INTO articles (
    article_id,
    provider,
    title,
    category,
    topic_label,
    topic_tag,
    published_minutes_ago,
    lead,
    body_json,
    image,
    source_name,
    source_uri,
    source_article_uri,
    published_at,
    metadata_json,
    updated_at
  ) VALUES (
    @articleId,
    @provider,
    @title,
    @category,
    @topicLabel,
    @topicTag,
    @publishedMinutesAgo,
    @lead,
    @bodyJson,
    @image,
    @sourceName,
    @sourceUri,
    @sourceArticleUri,
    @publishedAt,
    @metadataJson,
    @updatedAt
  )
  ON CONFLICT(article_id) DO UPDATE SET
    provider = excluded.provider,
    title = excluded.title,
    category = excluded.category,
    topic_label = excluded.topic_label,
    topic_tag = excluded.topic_tag,
    published_minutes_ago = excluded.published_minutes_ago,
    lead = excluded.lead,
    body_json = excluded.body_json,
    image = excluded.image,
    source_name = excluded.source_name,
    source_uri = excluded.source_uri,
    source_article_uri = excluded.source_article_uri,
    published_at = excluded.published_at,
    metadata_json = excluded.metadata_json,
    updated_at = excluded.updated_at
`);

const upsertSnapshotStmt = db.prepare(`
  INSERT INTO feed_snapshots (
    snapshot_date,
    category,
    limit_count,
    provider,
    created_at,
    status,
    started_at,
    completed_at,
    published_at,
    error_message
  ) VALUES (
    @snapshotDate,
    @category,
    @limitCount,
    @provider,
    @createdAt,
    @status,
    @startedAt,
    @completedAt,
    @publishedAt,
    @errorMessage
  )
  ON CONFLICT(snapshot_date, category, limit_count, provider) DO UPDATE SET
    created_at = excluded.created_at,
    status = excluded.status,
    started_at = excluded.started_at,
    completed_at = excluded.completed_at,
    published_at = excluded.published_at,
    error_message = excluded.error_message
  RETURNING snapshot_id
`);

const deleteSnapshotItemsStmt = db.prepare(`
  DELETE FROM feed_snapshot_items
  WHERE snapshot_id = @snapshotId
`);

const insertSnapshotItemStmt = db.prepare(`
  INSERT INTO feed_snapshot_items (
    snapshot_id,
    rank,
    article_id
  ) VALUES (
    @snapshotId,
    @rank,
    @articleId
  )
`);

const deleteSnapshotArticlesStmt = db.prepare(`
  DELETE FROM snapshot_articles
  WHERE snapshot_id = @snapshotId
`);

const insertSnapshotArticleStmt = db.prepare(`
  INSERT INTO snapshot_articles (
    snapshot_id,
    snapshot_date,
    article_id,
    rank,
    title,
    lead,
    body_json,
    category,
    topic_label,
    topic_tag,
    image,
    source_name,
    source_uri,
    source_article_uri,
    published_at,
    captured_at
  ) VALUES (
    @snapshotId,
    @snapshotDate,
    @articleId,
    @rank,
    @title,
    @lead,
    @bodyJson,
    @category,
    @topicLabel,
    @topicTag,
    @image,
    @sourceName,
    @sourceUri,
    @sourceArticleUri,
    @publishedAt,
    @capturedAt
  )
`);

const deleteSnapshotVariantsStmt = db.prepare(`
  DELETE FROM snapshot_article_variants
  WHERE snapshot_id = @snapshotId
`);

const insertSnapshotVariantStmt = db.prepare(`
  INSERT INTO snapshot_article_variants (
    snapshot_id,
    snapshot_date,
    article_id,
    variant_key,
    title,
    lead,
    body_json,
    rewrite_method,
    created_at
  ) VALUES (
    @snapshotId,
    @snapshotDate,
    @articleId,
    @variantKey,
    @title,
    @lead,
    @bodyJson,
    @rewriteMethod,
    @createdAt
  )
  ON CONFLICT(snapshot_id, article_id, variant_key) DO UPDATE SET
    title = excluded.title,
    lead = excluded.lead,
    body_json = excluded.body_json,
    rewrite_method = excluded.rewrite_method,
    created_at = excluded.created_at
`);

const markSnapshotVariantMethodStmt = db.prepare(`
  UPDATE snapshot_article_variants
  SET rewrite_method = @rewriteMethod,
      created_at = @createdAt
  WHERE snapshot_id = @snapshotId
    AND variant_key = @variantKey
`);

const findArticleByIdStmt = db.prepare(`
  SELECT
    article_id,
    category,
    title,
    topic_label,
    topic_tag,
    published_minutes_ago,
    lead,
    body_json,
    image,
    source_name,
    source_uri,
    source_article_uri,
    published_at,
    metadata_json
  FROM articles
  WHERE article_id = @articleId
  LIMIT 1
`);

const findSnapshotArticleBySnapshotIdStmt = db.prepare(`
  SELECT
    fs.snapshot_id,
    fs.snapshot_date,
    sa.article_id,
    sa.category,
    sa.title,
    sa.topic_label,
    sa.topic_tag,
    sa.lead,
    sa.body_json,
    sa.image,
    sa.source_name,
    sa.source_uri,
    sa.source_article_uri,
    sa.published_at
  FROM snapshot_articles sa
  JOIN feed_snapshots fs ON fs.snapshot_id = sa.snapshot_id
  WHERE sa.snapshot_id = @snapshotId
    AND sa.article_id = @articleId
  LIMIT 1
`);

const findSnapshotArticleBySnapshotDateStmt = db.prepare(`
  SELECT
    fs.snapshot_id,
    fs.snapshot_date,
    sa.article_id,
    sa.category,
    sa.title,
    sa.topic_label,
    sa.topic_tag,
    sa.lead,
    sa.body_json,
    sa.image,
    sa.source_name,
    sa.source_uri,
    sa.source_article_uri,
    sa.published_at
  FROM snapshot_articles sa
  JOIN feed_snapshots fs ON fs.snapshot_id = sa.snapshot_id
  WHERE fs.snapshot_date = @snapshotDate
    AND sa.article_id = @articleId
  ORDER BY fs.created_at DESC
  LIMIT 1
`);

const findLatestSnapshotArticleByIdStmt = db.prepare(`
  SELECT
    fs.snapshot_id,
    fs.snapshot_date,
    sa.article_id,
    sa.category,
    sa.title,
    sa.topic_label,
    sa.topic_tag,
    sa.lead,
    sa.body_json,
    sa.image,
    sa.source_name,
    sa.source_uri,
    sa.source_article_uri,
    sa.published_at
  FROM snapshot_articles sa
  JOIN feed_snapshots fs ON fs.snapshot_id = sa.snapshot_id
  WHERE sa.article_id = @articleId
  ORDER BY fs.snapshot_date DESC, fs.created_at DESC
  LIMIT 1
`);

const listVariantsForSnapshotArticleStmt = db.prepare(`
  SELECT
    variant_key,
    title,
    lead,
    body_json,
    rewrite_method,
    created_at
  FROM snapshot_article_variants
  WHERE snapshot_id = @snapshotId
    AND article_id = @articleId
`);

const insertTopicAuditRunStmt = db.prepare(`
  INSERT INTO topic_classification_audit_runs (
    created_at,
    snapshot_date,
    category,
    limit_count,
    provider,
    source_uri,
    classifier_method,
    classifier_model,
    classifier_batch_size,
    feed_per_topic_target,
    fresh_article_max_age_hours,
    pages_fetched,
    fetched_count,
    audited_count,
    eligible_count,
    selected_count,
    snapshot_id,
    status,
    error_message,
    metadata_json
  ) VALUES (
    @createdAt,
    @snapshotDate,
    @category,
    @limitCount,
    @provider,
    @sourceUri,
    @classifierMethod,
    @classifierModel,
    @classifierBatchSize,
    @feedPerTopicTarget,
    @freshArticleMaxAgeHours,
    @pagesFetched,
    @fetchedCount,
    @auditedCount,
    @eligibleCount,
    @selectedCount,
    @snapshotId,
    @status,
    @errorMessage,
    @metadataJson
  )
`);

const insertTopicAuditItemStmt = db.prepare(`
  INSERT INTO topic_classification_audit_items (
    run_id,
    provider_rank,
    article_id,
    title,
    lead,
    published_at,
    word_count,
    length_ok,
    is_fresh,
    classified_topic,
    topic_tag,
    eligible_for_feed,
    selected_for_snapshot,
    skip_reason,
    classifier_status,
    fallback_used,
    metadata_json
  ) VALUES (
    @runId,
    @providerRank,
    @articleId,
    @title,
    @lead,
    @publishedAt,
    @wordCount,
    @lengthOk,
    @isFresh,
    @classifiedTopic,
    @topicTag,
    @eligibleForFeed,
    @selectedForSnapshot,
    @skipReason,
    @classifierStatus,
    @fallbackUsed,
    @metadataJson
  )
`);

const listTopicAuditRunsStmt = db.prepare(`
  SELECT
    id,
    created_at,
    snapshot_date,
    category,
    limit_count,
    provider,
    source_uri,
    classifier_method,
    classifier_model,
    classifier_batch_size,
    feed_per_topic_target,
    fresh_article_max_age_hours,
    pages_fetched,
    fetched_count,
    audited_count,
    eligible_count,
    selected_count,
    snapshot_id,
    status,
    error_message,
    metadata_json
  FROM topic_classification_audit_runs
  ORDER BY created_at DESC, id DESC
  LIMIT @limit
`);

const findTopicAuditRunByIdStmt = db.prepare(`
  SELECT
    id,
    created_at,
    snapshot_date,
    category,
    limit_count,
    provider,
    source_uri,
    classifier_method,
    classifier_model,
    classifier_batch_size,
    feed_per_topic_target,
    fresh_article_max_age_hours,
    pages_fetched,
    fetched_count,
    audited_count,
    eligible_count,
    selected_count,
    snapshot_id,
    status,
    error_message,
    metadata_json
  FROM topic_classification_audit_runs
  WHERE id = @runId
  LIMIT 1
`);

const findTopicAuditRunBySnapshotIdStmt = db.prepare(`
  SELECT
    id,
    created_at,
    snapshot_date,
    category,
    limit_count,
    provider,
    source_uri,
    classifier_method,
    classifier_model,
    classifier_batch_size,
    feed_per_topic_target,
    fresh_article_max_age_hours,
    pages_fetched,
    fetched_count,
    audited_count,
    eligible_count,
    selected_count,
    snapshot_id,
    status,
    error_message,
    metadata_json
  FROM topic_classification_audit_runs
  WHERE snapshot_id = @snapshotId
  ORDER BY created_at DESC, id DESC
  LIMIT 1
`);

const listTopicAuditItemsStmt = db.prepare(`
  SELECT
    id,
    run_id,
    provider_rank,
    article_id,
    title,
    lead,
    published_at,
    word_count,
    length_ok,
    is_fresh,
    classified_topic,
    topic_tag,
    eligible_for_feed,
    selected_for_snapshot,
    skip_reason,
    classifier_status,
    fallback_used,
    metadata_json
  FROM topic_classification_audit_items
  WHERE run_id = @runId
  ORDER BY provider_rank ASC, id ASC
`);

const listEventsBase = `
  SELECT
    event_id,
    schema_version,
    event_type,
    timestamp,
    user_id,
    session_id,
    surface,
    request_id,
    article_id,
    variant_key,
    position,
    properties_json
  FROM events
`;

function isRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function validateEvent(event) {
  if (!isRecord(event)) return "event must be an object";
  if (typeof event.eventId !== "string" || !event.eventId) return "eventId is required";
  if (event.schemaVersion !== SCHEMA_VERSION) return "schemaVersion mismatch";
  if (typeof event.eventType !== "string" || !event.eventType) return "eventType is required";
  if (typeof event.timestamp !== "string" || !event.timestamp) return "timestamp is required";
  if (typeof event.userId !== "string" || !event.userId) return "userId is required";
  if (typeof event.sessionId !== "string" || !event.sessionId) return "sessionId is required";

  if (event.position != null && !Number.isFinite(event.position)) {
    return "position must be a number when provided";
  }

  if (
    event.properties != null &&
    !isRecord(event.properties)
  ) {
    return "properties must be an object when provided";
  }

  return null;
}

function utcDayStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function normalizeRequestedCategory(value) {
  const category =
    typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : "All";
  if (category.toLowerCase() === "general") {
    return "All";
  }
  return category;
}

function resolveRequestedTopicTargets(category) {
  if (!Array.isArray(FEED_TOPIC_TARGETS) || FEED_TOPIC_TARGETS.length === 0) {
    return [];
  }

  if (typeof category === "string" && category !== "All") {
    const normalized = normalizeTopic(category);
    if (FEED_TOPIC_TARGETS.includes(normalized)) {
      return [normalized];
    }
  }

  return [...FEED_TOPIC_TARGETS];
}

function resolveDefaultFeedLimit(category) {
  const requestedTopicTargets = resolveRequestedTopicTargets(category);
  const isTopicBalancedRequest =
    category === "All" &&
    Array.isArray(requestedTopicTargets) &&
    requestedTopicTargets.length > 1;
  return isTopicBalancedRequest
    ? FEED_PER_TOPIC_TARGET * requestedTopicTargets.length
    : FEED_PER_TOPIC_TARGET;
}

function buildCountsByTopic(articles, topicTargets) {
  const counts = {};
  if (Array.isArray(topicTargets)) {
    for (const topic of topicTargets) {
      if (typeof topic === "string" && topic.length > 0) {
        counts[topic] = 0;
      }
    }
  }

  if (!Array.isArray(articles)) {
    return counts;
  }

  for (const article of articles) {
    const topic =
      typeof article?.category === "string" && article.category.length > 0
        ? article.category
        : null;
    if (!topic) continue;
    if (!Object.prototype.hasOwnProperty.call(counts, topic)) {
      counts[topic] = 0;
    }
    counts[topic] += 1;
  }

  return counts;
}

function evaluateTopicCompleteness(topicTargets, countsByTopic, perTopicTarget) {
  if (!Array.isArray(topicTargets) || topicTargets.length === 0) {
    return true;
  }
  for (const topic of topicTargets) {
    const count = Number(countsByTopic?.[topic] || 0);
    if (count < perTopicTarget) {
      return false;
    }
  }
  return true;
}

function countWordsInText(value) {
  if (typeof value !== "string") {
    return 0;
  }
  const matches = value.match(/\b[\w'-]+\b/g);
  return Array.isArray(matches) ? matches.length : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function countArticleWords(article) {
  if (!article) {
    return 0;
  }

  if (Array.isArray(article.body)) {
    const text = article.body
      .filter((entry) => typeof entry === "string")
      .join(" ");
    const bodyWords = countWordsInText(text);
    if (bodyWords > 0) {
      return bodyWords;
    }
  }

  const leadWords = countWordsInText(article.lead);
  if (leadWords > 0) {
    return leadWords;
  }

  return countWordsInText(article.title);
}

function isWithinArticleWordBounds(article) {
  const count = countArticleWords(article);
  return count >= FEED_MIN_WORDS && count <= FEED_MAX_WORDS;
}

function getArticlePublishedMs(article) {
  const publishedAt =
    typeof article?.publishedAt === "string" && article.publishedAt.length > 0
      ? article.publishedAt
      : null;
  const publishedMs = publishedAt ? Date.parse(publishedAt) : NaN;
  if (Number.isFinite(publishedMs) && publishedMs > 0) {
    return publishedMs;
  }

  const minutesAgo = Number(article?.publishedMinutesAgo);
  if (Number.isFinite(minutesAgo) && minutesAgo >= 0) {
    return Date.now() - minutesAgo * 60 * 1000;
  }

  return NaN;
}

function isFreshEnoughArticle(article, nowMs = Date.now()) {
  const publishedMs = getArticlePublishedMs(article);
  if (!Number.isFinite(publishedMs) || publishedMs <= 0) {
    return false;
  }

  const ageMs = Math.max(0, nowMs - publishedMs);
  return ageMs <= FEED_FRESH_ARTICLE_MAX_AGE_MS;
}

function articleAuditKey(article) {
  if (typeof article?.id === "string" && article.id.length > 0) {
    return article.id;
  }
  return `${article?.title || ""}::${article?.publishedAt || ""}`;
}

function optionalString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function buildTopicAuditItemMetadata(article, options = {}) {
  const metadata = {};
  if (!options.includeOriginalArticle) {
    return metadata;
  }

  const body = Array.isArray(article?.body)
    ? article.body.filter((entry) => typeof entry === "string" && entry.length > 0)
    : [];

  metadata.originalArticle = {
    title: optionalString(article?.title) || "",
    lead: optionalString(article?.lead),
    body,
    image: optionalString(article?.image),
    source: {
      name: optionalString(article?.source?.name),
      uri: optionalString(article?.source?.uri),
      articleUri: optionalString(article?.source?.articleUri)
    },
    publishedAt: optionalString(article?.publishedAt)
  };

  return metadata;
}

function parseJsonRecord(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return {};
  }
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toBoolean(value) {
  return value === true || value === 1 || value === "1";
}

function rowToTopicAuditRun(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    createdAt: row.created_at,
    snapshotDate: row.snapshot_date,
    category: row.category,
    limitCount: Number(row.limit_count || 0),
    provider: row.provider,
    sourceUri: row.source_uri,
    classifierMethod: row.classifier_method,
    classifierModel: row.classifier_model,
    classifierBatchSize: Number(row.classifier_batch_size || 0),
    feedPerTopicTarget: Number(row.feed_per_topic_target || 0),
    freshArticleMaxAgeHours: Number(row.fresh_article_max_age_hours || 0),
    pagesFetched: Number(row.pages_fetched || 0),
    fetchedCount: Number(row.fetched_count || 0),
    auditedCount: Number(row.audited_count || 0),
    eligibleCount: Number(row.eligible_count || 0),
    selectedCount: Number(row.selected_count || 0),
    snapshotId:
      Number.isFinite(Number(row.snapshot_id)) && Number(row.snapshot_id) > 0
        ? Number(row.snapshot_id)
        : null,
    status: row.status,
    errorMessage: row.error_message,
    metadata: parseJsonRecord(row.metadata_json)
  };
}

function rowToTopicAuditItem(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    runId: Number(row.run_id),
    position: Number(row.provider_rank || 0),
    providerRank: Number(row.provider_rank || 0),
    articleId: row.article_id,
    title: row.title,
    lead: row.lead,
    publishedAt: row.published_at,
    wordCount: Number(row.word_count || 0),
    lengthOk: toBoolean(row.length_ok),
    isFresh: toBoolean(row.is_fresh),
    classification: {
      topic: row.classified_topic || TOPIC_NONE,
      tag: row.topic_tag || null
    },
    eligibleForFeed: toBoolean(row.eligible_for_feed),
    selectedForSnapshot: toBoolean(row.selected_for_snapshot),
    skipReason: row.skip_reason || "",
    classifierStatus: row.classifier_status || "",
    fallbackUsed: toBoolean(row.fallback_used),
    metadata: parseJsonRecord(row.metadata_json)
  };
}

function buildTopicAuditOriginalsExport({
  run,
  articles,
  currentSnapshot = null,
  includeWordCountItems = false
}) {
  const items = Array.isArray(articles) ? articles : [];
  const filteredItems = includeWordCountItems
    ? items
    : items.filter((item) => item.lengthOk);
  const exportedArticles = filteredItems.map((item) => {
    const metadata = isRecord(item.metadata) ? item.metadata : {};
    const originalArticle = isRecord(metadata.originalArticle)
      ? metadata.originalArticle
      : {};
    const body = Array.isArray(originalArticle.body)
      ? originalArticle.body.filter(
          (entry) => typeof entry === "string" && entry.length > 0
        )
      : [];
    const bodyText =
      typeof originalArticle.bodyText === "string" &&
      originalArticle.bodyText.length > 0
        ? originalArticle.bodyText
        : body.join("\n\n");

    return {
      auditItemId: item.id,
      providerRank: item.providerRank,
      articleId: item.articleId,
      original: {
        title: item.title || originalArticle.title || "",
        lead: item.lead || originalArticle.lead || "",
        body,
        bodyText,
        image: originalArticle.image || null,
        source: isRecord(originalArticle.source)
          ? {
              name: originalArticle.source.name || null,
              uri: originalArticle.source.uri || null,
              articleUri: originalArticle.source.articleUri || null
            }
          : null,
        publishedAt: item.publishedAt || originalArticle.publishedAt || null
      },
      bodyAvailable: body.length > 0 || bodyText.length > 0,
      topicClassification: item.classification,
      feedSelector: {
        eligibleForFeed: item.eligibleForFeed,
        selectedForSnapshot: item.selectedForSnapshot,
        status: item.skipReason || "",
        selectorCandidate: metadata.selectorCandidate ?? null,
        selectorReason: metadata.feedSelectorReason || null
      },
      auditMetadata: {
        wordCount: item.wordCount,
        lengthOk: item.lengthOk,
        isFresh: item.isFresh,
        classifierStatus: item.classifierStatus,
        fallbackUsed: item.fallbackUsed
      }
    };
  });

  const bodyAvailableCount = exportedArticles.filter(
    (article) => article.bodyAvailable
  ).length;

  return {
    ok: true,
    exportedAt: new Date().toISOString(),
    run,
    currentSnapshot,
    includedWordCountFailures: includeWordCountItems,
    excludedWordCountFailureCount: includeWordCountItems
      ? 0
      : items.filter((item) => !item.lengthOk).length,
    bodyAvailableCount,
    bodyMissingCount: exportedArticles.length - bodyAvailableCount,
    note:
      bodyAvailableCount === 0
        ? "This audit run does not include full article bodies. Rebuild with auditBody=1 and an admin token, then export again."
        : undefined,
    articles: exportedArticles
  };
}

function rowToArticle(row) {
  let body = [];
  try {
    const parsed = row.body_json ? JSON.parse(row.body_json) : [];
    if (Array.isArray(parsed)) {
      body = parsed.filter((value) => typeof value === "string");
    }
  } catch {
    body = [];
  }
  let metadata = {};
  try {
    metadata =
      row && typeof row.metadata_json === "string" && row.metadata_json.length > 0
        ? JSON.parse(row.metadata_json)
        : {};
  } catch {
    metadata = {};
  }

  const publishedAt =
    typeof row.published_at === "string" ? row.published_at : null;
  const publishedMs = publishedAt ? Date.parse(publishedAt) : NaN;
  const publishedMinutesAgo =
    Number.isFinite(publishedMs) && publishedMs > 0
      ? Math.max(1, Math.round((Date.now() - publishedMs) / 60000))
      : Number.isFinite(row.published_minutes_ago) && row.published_minutes_ago >= 0
        ? row.published_minutes_ago
        : 60;
  const topicTag =
    typeof row.topic_tag === "string" && row.topic_tag.trim().length > 0
      ? row.topic_tag.trim()
      : typeof metadata?.topicTag === "string" && metadata.topicTag.trim().length > 0
        ? metadata.topicTag.trim()
        : null;

  return {
    id: row.article_id,
    category: row.category || "General",
    title: row.title,
    topicLabel: row.topic_label || "General",
    topicTag,
    publishedMinutesAgo,
    lead: row.lead || "",
    body: body.length > 0 ? body : ["No body content available."],
    image:
      row.image ||
      "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1400&q=80",
    source: {
      name: row.source_name || null,
      uri: row.source_uri || null,
      articleUri: row.source_article_uri || null
    },
    publishedAt
  };
}

function rowToVariant(row) {
  let body = [];
  try {
    const parsed = row.body_json ? JSON.parse(row.body_json) : [];
    if (Array.isArray(parsed)) {
      body = parsed.filter((value) => typeof value === "string");
    }
  } catch {
    body = [];
  }

  return {
    title: row.title || "",
    lead: row.lead || "",
    body
  };
}

async function listDailySnapshotArticleRows(snapshotId) {
  if (!POSTGRES_ENABLED) {
    return listDailySnapshotArticlesStmt.all({ snapshotId });
  }
  const result = await pgQuery(
    `
      SELECT
        sa.rank,
        sa.article_id,
        sa.category,
        sa.title,
        sa.topic_label,
        sa.topic_tag,
        sa.lead,
        sa.body_json,
        sa.image,
        sa.source_name,
        sa.source_uri,
        sa.source_article_uri,
        sa.published_at
      FROM snapshot_articles sa
      WHERE sa.snapshot_id = $1
      ORDER BY sa.rank ASC
    `,
    [snapshotId]
  );
  return result.rows;
}

async function listSnapshotVariantRowsBySnapshot(snapshotId) {
  if (!POSTGRES_ENABLED) {
    return listSnapshotVariantsBySnapshotStmt.all({ snapshotId });
  }
  const result = await pgQuery(
    `
      SELECT
        article_id,
        variant_key,
        title,
        lead,
        body_json
      FROM snapshot_article_variants
      WHERE snapshot_id = $1
    `,
    [snapshotId]
  );
  return result.rows;
}

async function listSnapshotVariantRowsByArticle(snapshotId, articleId) {
  if (!POSTGRES_ENABLED) {
    return listVariantsForSnapshotArticleStmt.all({
      snapshotId,
      articleId
    });
  }
  const result = await pgQuery(
    `
      SELECT
        variant_key,
        title,
        lead,
        body_json,
        rewrite_method,
        created_at
      FROM snapshot_article_variants
      WHERE snapshot_id = $1
        AND article_id = $2
    `,
    [snapshotId, articleId]
  );
  return result.rows;
}

async function getVariantBundleForSnapshotArticle(snapshotId, articleId) {
  const rows = await listSnapshotVariantRowsByArticle(snapshotId, articleId);

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const variants = {};
  const variantMeta = {};
  for (const row of rows) {
    if (typeof row.variant_key !== "string" || row.variant_key.length === 0) {
      continue;
    }
    variants[row.variant_key] = rowToVariant(row);
    variantMeta[row.variant_key] = {
      rewriteMethod:
        typeof row.rewrite_method === "string" && row.rewrite_method.length > 0
          ? row.rewrite_method
          : null,
      createdAt:
        typeof row.created_at === "string" && row.created_at.length > 0
          ? row.created_at
          : null
    };
  }

  return {
    variants,
    variantMeta
  };
}

async function getVariantsForSnapshotArticle(snapshotId, articleId) {
  const bundle = await getVariantBundleForSnapshotArticle(snapshotId, articleId);
  return bundle ? bundle.variants : null;
}

async function getDailySnapshot({ snapshotDate, category, limitCount, provider }) {
  let snapshot = null;
  if (!POSTGRES_ENABLED) {
    snapshot = findDailySnapshotStmt.get({
      snapshotDate,
      category,
      limitCount,
      provider
    });
  } else {
    const result = await pgQuery(
      `
        SELECT
          fs.snapshot_id,
          fs.snapshot_date,
          fs.category,
          fs.limit_count,
          fs.provider,
          fs.created_at,
          fs.status,
          fs.started_at,
          fs.completed_at,
          fs.published_at,
          fs.error_message
        FROM feed_snapshots fs
        WHERE fs.snapshot_date = $1
          AND fs.category = $2
          AND fs.limit_count = $3
          AND fs.provider = $4
        LIMIT 1
      `,
      [snapshotDate, category, limitCount, provider]
    );
    snapshot = result.rows[0] || null;
  }
  if (!snapshot) {
    return null;
  }

  const rows = await listDailySnapshotArticleRows(snapshot.snapshot_id);
  const variantsByArticleId = new Map();
  const variantRows = await listSnapshotVariantRowsBySnapshot(snapshot.snapshot_id);
  for (const row of variantRows) {
    if (!variantsByArticleId.has(row.article_id)) {
      variantsByArticleId.set(row.article_id, {});
    }
    const entry = variantsByArticleId.get(row.article_id);
    entry[row.variant_key] = rowToVariant(row);
  }

  const articles = rows.map((row) => ({
    ...rowToArticle(row),
    variants: variantsByArticleId.get(row.article_id) || null
  }));
  const categories = Array.from(
    new Set(
      articles
        .map((article) => article.category)
        .filter((value) => typeof value === "string" && value.length > 0)
    )
  );

  return {
    snapshotId: Number(snapshot.snapshot_id),
    snapshotDate: snapshot.snapshot_date,
    category: snapshot.category,
    limitCount: snapshot.limit_count,
    provider: snapshot.provider,
    createdAt: snapshot.created_at,
    status:
      typeof snapshot.status === "string" && snapshot.status.length > 0
        ? snapshot.status
        : SNAPSHOT_STATUS_READY,
    publishedAt:
      typeof snapshot.published_at === "string" && snapshot.published_at.length > 0
        ? snapshot.published_at
        : null,
    startedAt:
      typeof snapshot.started_at === "string" && snapshot.started_at.length > 0
        ? snapshot.started_at
        : null,
    completedAt:
      typeof snapshot.completed_at === "string" && snapshot.completed_at.length > 0
        ? snapshot.completed_at
        : null,
    errorMessage:
      typeof snapshot.error_message === "string" && snapshot.error_message.length > 0
        ? snapshot.error_message
        : null,
    categories,
    articles
  };
}

async function getLatestSnapshotForCategory({
  category,
  provider,
  snapshotDate,
  limitCount
}) {
  let row = null;
  if (!POSTGRES_ENABLED) {
    row = findLatestSnapshotForCategoryStmt.get({
      category,
      provider,
      snapshotDate,
      limitCount
    });
  } else {
    const result = await pgQuery(
      `
        SELECT
          fs.snapshot_id
        FROM feed_snapshots fs
        WHERE fs.category = $1
          AND fs.provider = $2
          AND fs.snapshot_date = $3
          AND fs.limit_count = $4
        ORDER BY fs.snapshot_date DESC, fs.created_at DESC, fs.snapshot_id DESC
        LIMIT 1
      `,
      [category, provider, snapshotDate, limitCount]
    );
    row = result.rows[0] || null;
  }
  if (!row || !Number.isFinite(Number(row.snapshot_id))) {
    return null;
  }
  return getSnapshotById(Number(row.snapshot_id));
}

async function getSnapshotById(snapshotId) {
  let snapshot = null;
  if (!POSTGRES_ENABLED) {
    snapshot = findSnapshotByIdStmt.get({ snapshotId });
  } else {
    const result = await pgQuery(
      `
        SELECT
          fs.snapshot_id,
          fs.snapshot_date,
          fs.category,
          fs.limit_count,
          fs.provider,
          fs.created_at,
          fs.status,
          fs.started_at,
          fs.completed_at,
          fs.published_at,
          fs.error_message
        FROM feed_snapshots fs
        WHERE fs.snapshot_id = $1
        LIMIT 1
      `,
      [snapshotId]
    );
    snapshot = result.rows[0] || null;
  }
  if (!snapshot) {
    return null;
  }

  const rows = await listDailySnapshotArticleRows(snapshot.snapshot_id);
  const variantsByArticleId = new Map();
  const variantRows = await listSnapshotVariantRowsBySnapshot(snapshot.snapshot_id);
  for (const row of variantRows) {
    if (!variantsByArticleId.has(row.article_id)) {
      variantsByArticleId.set(row.article_id, {});
    }
    const entry = variantsByArticleId.get(row.article_id);
    entry[row.variant_key] = rowToVariant(row);
  }

  const articles = rows.map((row) => ({
    ...rowToArticle(row),
    variants: variantsByArticleId.get(row.article_id) || null
  }));
  const categories = Array.from(
    new Set(
      articles
        .map((article) => article.category)
        .filter((value) => typeof value === "string" && value.length > 0)
    )
  );

  return {
    snapshotId: Number(snapshot.snapshot_id),
    snapshotDate: snapshot.snapshot_date,
    category: snapshot.category,
    limitCount: snapshot.limit_count,
    provider: snapshot.provider,
    createdAt: snapshot.created_at,
    status:
      typeof snapshot.status === "string" && snapshot.status.length > 0
        ? snapshot.status
        : SNAPSHOT_STATUS_READY,
    publishedAt:
      typeof snapshot.published_at === "string" && snapshot.published_at.length > 0
        ? snapshot.published_at
        : null,
    startedAt:
      typeof snapshot.started_at === "string" && snapshot.started_at.length > 0
        ? snapshot.started_at
        : null,
    completedAt:
      typeof snapshot.completed_at === "string" && snapshot.completed_at.length > 0
        ? snapshot.completed_at
        : null,
    errorMessage:
      typeof snapshot.error_message === "string" && snapshot.error_message.length > 0
        ? snapshot.error_message
        : null,
    categories,
    articles
  };
}

async function findSnapshotRecordByDate({
  snapshotDate,
  category,
  limitCount,
  provider
}) {
  if (!POSTGRES_ENABLED) {
    return findDailySnapshotStmt.get({
      snapshotDate,
      category,
      limitCount,
      provider
    }) || null;
  }
  const result = await pgQuery(
    `
      SELECT
        fs.snapshot_id,
        fs.snapshot_date,
        fs.category,
        fs.limit_count,
        fs.provider,
        fs.created_at,
        fs.status,
        fs.started_at,
        fs.completed_at,
        fs.published_at,
        fs.error_message
      FROM feed_snapshots fs
      WHERE fs.snapshot_date = $1
        AND fs.category = $2
        AND fs.limit_count = $3
        AND fs.provider = $4
      LIMIT 1
    `,
    [snapshotDate, category, limitCount, provider]
  );
  return result.rows?.[0] || null;
}

async function updateSnapshotLifecycle({
  snapshotId,
  status,
  startedAt = null,
  completedAt = null,
  publishedAt = null,
  errorMessage = null
}) {
  if (!POSTGRES_ENABLED) {
    db.prepare(
      `
        UPDATE feed_snapshots
        SET status = @status,
            started_at = @startedAt,
            completed_at = @completedAt,
            published_at = @publishedAt,
            error_message = @errorMessage
        WHERE snapshot_id = @snapshotId
      `
    ).run({
      snapshotId,
      status,
      startedAt,
      completedAt,
      publishedAt,
      errorMessage
    });
    return;
  }
  await pgQuery(
    `
      UPDATE feed_snapshots
      SET status = $1,
          started_at = $2,
          completed_at = $3,
          published_at = $4,
          error_message = $5
      WHERE snapshot_id = $6
    `,
    [status, startedAt, completedAt, publishedAt, errorMessage, snapshotId]
  );
}

async function upsertCurrentSnapshot({
  category,
  limitCount,
  provider,
  snapshotId
}) {
  const updatedAt = new Date().toISOString();
  if (!POSTGRES_ENABLED) {
    db.prepare(
      `
        INSERT INTO current_snapshots (
          category,
          limit_count,
          provider,
          snapshot_id,
          updated_at
        ) VALUES (
          @category,
          @limitCount,
          @provider,
          @snapshotId,
          @updatedAt
        )
        ON CONFLICT(category, limit_count, provider) DO UPDATE SET
          snapshot_id = excluded.snapshot_id,
          updated_at = excluded.updated_at
      `
    ).run({
      category,
      limitCount,
      provider,
      snapshotId,
      updatedAt
    });
    return;
  }
  await pgQuery(
    `
      INSERT INTO current_snapshots (
        category,
        limit_count,
        provider,
        snapshot_id,
        updated_at
      ) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT(category, limit_count, provider) DO UPDATE SET
        snapshot_id = excluded.snapshot_id,
        updated_at = excluded.updated_at
    `,
    [category, limitCount, provider, snapshotId, updatedAt]
  );
}

async function getCurrentSnapshotId({
  category,
  limitCount,
  provider
}) {
  if (!POSTGRES_ENABLED) {
    const row = db
      .prepare(
        `
          SELECT snapshot_id
          FROM current_snapshots
          WHERE category = @category
            AND limit_count = @limitCount
            AND provider = @provider
          LIMIT 1
        `
      )
      .get({ category, limitCount, provider });
    return Number.isFinite(Number(row?.snapshot_id))
      ? Number(row.snapshot_id)
      : null;
  }
  const result = await pgQuery(
    `
      SELECT snapshot_id
      FROM current_snapshots
      WHERE category = $1
        AND limit_count = $2
        AND provider = $3
      LIMIT 1
    `,
    [category, limitCount, provider]
  );
  const snapshotId = result.rows?.[0]?.snapshot_id;
  return Number.isFinite(Number(snapshotId)) ? Number(snapshotId) : null;
}

async function getCurrentPublishedSnapshot({
  category,
  limitCount,
  provider
}) {
  const snapshotId = await getCurrentSnapshotId({
    category,
    limitCount,
    provider
  });
  if (!snapshotId) {
    return null;
  }
  const snapshot = await getSnapshotById(snapshotId);
  if (!snapshot) {
    return null;
  }
  if (snapshot.status !== SNAPSHOT_STATUS_READY) {
    return null;
  }
  return snapshot;
}

async function getLatestReadySnapshotForFeed({
  category,
  limitCount,
  provider
}) {
  if (!POSTGRES_ENABLED) {
    const row = db
      .prepare(
        `
          SELECT snapshot_id
          FROM feed_snapshots
          WHERE category = @category
            AND limit_count = @limitCount
            AND provider = @provider
            AND status = @status
          ORDER BY COALESCE(published_at, created_at) DESC, snapshot_id DESC
          LIMIT 1
        `
      )
      .get({
        category,
        limitCount,
        provider,
        status: SNAPSHOT_STATUS_READY
      });
    if (!Number.isFinite(Number(row?.snapshot_id))) {
      return null;
    }
    return getSnapshotById(Number(row.snapshot_id));
  }
  const result = await pgQuery(
    `
      SELECT snapshot_id
      FROM feed_snapshots
      WHERE category = $1
        AND limit_count = $2
        AND provider = $3
        AND status = $4
      ORDER BY COALESCE(published_at, created_at) DESC, snapshot_id DESC
      LIMIT 1
    `,
    [category, limitCount, provider, SNAPSHOT_STATUS_READY]
  );
  const snapshotId = result.rows?.[0]?.snapshot_id;
  if (!Number.isFinite(Number(snapshotId))) {
    return null;
  }
  return getSnapshotById(Number(snapshotId));
}

async function countRewriteJobsByStatus(status = null, snapshotId = null) {
  if (!POSTGRES_ENABLED) {
    const clauses = [];
    const params = {};
    if (typeof status === "string" && status.length > 0) {
      clauses.push("status = @status");
      params.status = status;
    }
    if (Number.isFinite(Number(snapshotId)) && Number(snapshotId) > 0) {
      clauses.push("snapshot_id = @snapshotId");
      params.snapshotId = Number(snapshotId);
    }
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const row = db
      .prepare(
        `
          SELECT COUNT(*) AS count
          FROM rewrite_jobs
          ${whereClause}
        `
      )
      .get(params);
    return Number(row?.count || 0);
  }
  const values = [];
  const clauses = [];
  if (typeof status === "string" && status.length > 0) {
    values.push(status);
    clauses.push(`status = $${values.length}`);
  }
  if (Number.isFinite(Number(snapshotId)) && Number(snapshotId) > 0) {
    values.push(Number(snapshotId));
    clauses.push(`snapshot_id = $${values.length}`);
  }
  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await pgQuery(
    `
      SELECT COUNT(*)::int AS count
      FROM rewrite_jobs
      ${whereClause}
    `,
    values
  );
  return Number(result.rows?.[0]?.count || 0);
}

async function resetStaleRunningRewriteJobs() {
  const cutoffDate = new Date(
    Date.now() - REWRITE_JOB_STALE_RUNNING_MINUTES * 60 * 1000
  ).toISOString();
  const nowIso = new Date().toISOString();
  if (!POSTGRES_ENABLED) {
    db.prepare(
      `
        UPDATE rewrite_jobs
        SET status = @pendingStatus,
            updated_at = @nowIso,
            last_error = COALESCE(last_error, 'Recovered stale running job after restart')
        WHERE status = @runningStatus
          AND COALESCE(started_at, '') <> ''
          AND started_at < @cutoffDate
      `
    ).run({
      pendingStatus: REWRITE_JOB_STATUS_PENDING,
      runningStatus: REWRITE_JOB_STATUS_RUNNING,
      nowIso,
      cutoffDate
    });
    return;
  }
  await pgQuery(
    `
      UPDATE rewrite_jobs
      SET status = $1,
          updated_at = $2,
          last_error = COALESCE(last_error, 'Recovered stale running job after restart')
      WHERE status = $3
        AND COALESCE(started_at, '') <> ''
        AND started_at < $4
    `,
    [
      REWRITE_JOB_STATUS_PENDING,
      nowIso,
      REWRITE_JOB_STATUS_RUNNING,
      cutoffDate
    ]
  );
}

async function ensureRewriteJobsForSnapshot({
  snapshotId,
  articleIds
}) {
  if (!Array.isArray(articleIds) || articleIds.length === 0) {
    return;
  }
  const nowIso = new Date().toISOString();
  const targetVariantKeys = Array.from(new Set(LLM_VARIANT_KEYS));
  if (targetVariantKeys.length === 0) {
    return;
  }
  if (!POSTGRES_ENABLED) {
    const stmt = db.prepare(
      `
        INSERT INTO rewrite_jobs (
          snapshot_id,
          article_id,
          variant_key,
          status,
          attempts,
          max_attempts,
          last_error,
          started_at,
          finished_at,
          created_at,
          updated_at
        ) VALUES (
          @snapshotId,
          @articleId,
          @variantKey,
          @status,
          0,
          @maxAttempts,
          NULL,
          NULL,
          NULL,
          @createdAt,
          @updatedAt
        )
        ON CONFLICT(snapshot_id, article_id, variant_key) DO NOTHING
      `
    );
    for (const articleId of articleIds) {
      for (const variantKey of targetVariantKeys) {
        stmt.run({
          snapshotId,
          articleId,
          variantKey,
          status: REWRITE_JOB_STATUS_PENDING,
          maxAttempts: REWRITE_MAX_ATTEMPTS,
          createdAt: nowIso,
          updatedAt: nowIso
        });
      }
    }
    return;
  }

  for (const articleId of articleIds) {
    for (const variantKey of targetVariantKeys) {
      await pgQuery(
        `
          INSERT INTO rewrite_jobs (
            snapshot_id,
            article_id,
            variant_key,
            status,
            attempts,
            max_attempts,
            last_error,
            started_at,
            finished_at,
            created_at,
            updated_at
          ) VALUES (
            $1,$2,$3,$4,0,$5,NULL,NULL,NULL,$6,$7
          )
          ON CONFLICT(snapshot_id, article_id, variant_key) DO NOTHING
        `,
        [
          snapshotId,
          articleId,
          variantKey,
          REWRITE_JOB_STATUS_PENDING,
          REWRITE_MAX_ATTEMPTS,
          nowIso,
          nowIso
        ]
      );
    }
  }
}

async function beginRewriteJob({
  snapshotId,
  articleId,
  variantKey
}) {
  const nowIso = new Date().toISOString();
  if (!POSTGRES_ENABLED) {
    const row = db
      .prepare(
        `
          SELECT attempts, max_attempts, status
          FROM rewrite_jobs
          WHERE snapshot_id = @snapshotId
            AND article_id = @articleId
            AND variant_key = @variantKey
          LIMIT 1
        `
      )
      .get({ snapshotId, articleId, variantKey });
    if (!row) {
      return null;
    }
    const attempts = Number(row.attempts || 0);
    const maxAttempts = Number(row.max_attempts || REWRITE_MAX_ATTEMPTS);
    const status = String(row.status || "");
    if (
      ![REWRITE_JOB_STATUS_PENDING, REWRITE_JOB_STATUS_FAILED].includes(status) ||
      attempts >= maxAttempts
    ) {
      return null;
    }
    db.prepare(
      `
        UPDATE rewrite_jobs
        SET status = @runningStatus,
            attempts = @attempts,
            started_at = @startedAt,
            updated_at = @updatedAt,
            finished_at = NULL,
            last_error = NULL
        WHERE snapshot_id = @snapshotId
          AND article_id = @articleId
          AND variant_key = @variantKey
      `
    ).run({
      runningStatus: REWRITE_JOB_STATUS_RUNNING,
      attempts: attempts + 1,
      startedAt: nowIso,
      updatedAt: nowIso,
      snapshotId,
      articleId,
      variantKey
    });
    return {
      attempts: attempts + 1,
      maxAttempts
    };
  }

  const selected = await pgQuery(
    `
      SELECT attempts, max_attempts, status
      FROM rewrite_jobs
      WHERE snapshot_id = $1
        AND article_id = $2
        AND variant_key = $3
      LIMIT 1
    `,
    [snapshotId, articleId, variantKey]
  );
  const row = selected.rows?.[0];
  if (!row) {
    return null;
  }
  const attempts = Number(row.attempts || 0);
  const maxAttempts = Number(row.max_attempts || REWRITE_MAX_ATTEMPTS);
  const status = String(row.status || "");
  if (
    ![REWRITE_JOB_STATUS_PENDING, REWRITE_JOB_STATUS_FAILED].includes(status) ||
    attempts >= maxAttempts
  ) {
    return null;
  }
  await pgQuery(
    `
      UPDATE rewrite_jobs
      SET status = $1,
          attempts = $2,
          started_at = $3,
          updated_at = $4,
          finished_at = NULL,
          last_error = NULL
      WHERE snapshot_id = $5
        AND article_id = $6
        AND variant_key = $7
    `,
    [
      REWRITE_JOB_STATUS_RUNNING,
      attempts + 1,
      nowIso,
      nowIso,
      snapshotId,
      articleId,
      variantKey
    ]
  );
  return {
    attempts: attempts + 1,
    maxAttempts
  };
}

async function completeRewriteJob({
  snapshotId,
  articleId,
  variantKey
}) {
  const nowIso = new Date().toISOString();
  if (!POSTGRES_ENABLED) {
    db.prepare(
      `
        UPDATE rewrite_jobs
        SET status = @status,
            finished_at = @finishedAt,
            updated_at = @updatedAt,
            last_error = NULL
        WHERE snapshot_id = @snapshotId
          AND article_id = @articleId
          AND variant_key = @variantKey
      `
    ).run({
      status: REWRITE_JOB_STATUS_SUCCEEDED,
      finishedAt: nowIso,
      updatedAt: nowIso,
      snapshotId,
      articleId,
      variantKey
    });
    return;
  }
  await pgQuery(
    `
      UPDATE rewrite_jobs
      SET status = $1,
          finished_at = $2,
          updated_at = $3,
          last_error = NULL
      WHERE snapshot_id = $4
        AND article_id = $5
        AND variant_key = $6
    `,
    [
      REWRITE_JOB_STATUS_SUCCEEDED,
      nowIso,
      nowIso,
      snapshotId,
      articleId,
      variantKey
    ]
  );
}

async function failRewriteJob({
  snapshotId,
  articleId,
  variantKey,
  attempts,
  maxAttempts,
  errorMessage
}) {
  const nowIso = new Date().toISOString();
  const terminalFailure =
    Number.isFinite(Number(attempts)) &&
    Number.isFinite(Number(maxAttempts)) &&
    Number(attempts) >= Number(maxAttempts);
  const nextStatus = terminalFailure
    ? REWRITE_JOB_STATUS_FAILED
    : REWRITE_JOB_STATUS_PENDING;
  if (!POSTGRES_ENABLED) {
    db.prepare(
      `
        UPDATE rewrite_jobs
        SET status = @status,
            finished_at = @finishedAt,
            updated_at = @updatedAt,
            last_error = @lastError
        WHERE snapshot_id = @snapshotId
          AND article_id = @articleId
          AND variant_key = @variantKey
      `
    ).run({
      status: nextStatus,
      finishedAt: nowIso,
      updatedAt: nowIso,
      lastError: errorMessage || null,
      snapshotId,
      articleId,
      variantKey
    });
    return;
  }
  await pgQuery(
    `
      UPDATE rewrite_jobs
      SET status = $1,
          finished_at = $2,
          updated_at = $3,
          last_error = $4
      WHERE snapshot_id = $5
        AND article_id = $6
        AND variant_key = $7
    `,
    [
      nextStatus,
      nowIso,
      nowIso,
      errorMessage || null,
      snapshotId,
      articleId,
      variantKey
    ]
  );
}

function buildRuleVariantMethods() {
  return buildDefaultVariantMethodMap(RULE_REWRITE_METHOD);
}

async function markSnapshotVariantMethod({
  snapshotId,
  variantKey,
  rewriteMethod,
  createdAt
}) {
  if (!POSTGRES_ENABLED) {
    markSnapshotVariantMethodStmt.run({
      snapshotId,
      variantKey,
      rewriteMethod,
      createdAt
    });
    return;
  }
  await pgQuery(
    `
      UPDATE snapshot_article_variants
      SET rewrite_method = $1,
          created_at = $2
      WHERE snapshot_id = $3
        AND variant_key = $4
    `,
    [rewriteMethod, createdAt, snapshotId, variantKey]
  );
}

async function upsertSnapshotVariant({
  snapshotId,
  snapshotDate,
  articleId,
  variantKey,
  title,
  lead,
  bodyJson,
  rewriteMethod,
  createdAt
}) {
  if (!POSTGRES_ENABLED) {
    insertSnapshotVariantStmt.run({
      snapshotId,
      snapshotDate,
      articleId,
      variantKey,
      title,
      lead,
      bodyJson,
      rewriteMethod,
      createdAt
    });
    return;
  }
  await pgQuery(
    `
      INSERT INTO snapshot_article_variants (
        snapshot_id,
        snapshot_date,
        article_id,
        variant_key,
        title,
        lead,
        body_json,
        rewrite_method,
        created_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
      ON CONFLICT(snapshot_id, article_id, variant_key) DO UPDATE SET
        title = excluded.title,
        lead = excluded.lead,
        body_json = excluded.body_json,
        rewrite_method = excluded.rewrite_method,
        created_at = excluded.created_at
    `,
    [
      snapshotId,
      snapshotDate,
      articleId,
      variantKey,
      title,
      lead,
      bodyJson,
      rewriteMethod,
      createdAt
    ]
  );
}

async function countPendingVariantsForSnapshot(snapshotId) {
  const pending = await countRewriteJobsByStatus(
    REWRITE_JOB_STATUS_PENDING,
    snapshotId
  );
  const running = await countRewriteJobsByStatus(
    REWRITE_JOB_STATUS_RUNNING,
    snapshotId
  );
  return pending + running;
}

async function rewriteSnapshotToneVariants({
  snapshotId,
  snapshotDate,
  category,
  limitCount,
  provider
}) {
  if (LLM_VARIANT_KEYS.length === 0 && !isToneLlmEnabled()) {
    return { updated: 0, llm: 0, fallback: 0 };
  }

  const rows = await listDailySnapshotArticleRows(snapshotId);
  if (!Array.isArray(rows) || rows.length === 0) {
    return { updated: 0, llm: 0, fallback: 0 };
  }

  await ensureRewriteJobsForSnapshot({
    snapshotId,
    articleIds: rows.map((row) => row.article_id)
  });

  let updated = 0;
  let llm = 0;
  let fallback = 0;

  for (const row of rows) {
    const article = rowToArticle(row);
    const fallbackVariants = buildVariants(article);
    let latestFactsOnlyVariant = fallbackVariants.facts_only;
    const orderedVariantKeys = LLM_VARIANT_KEYS.includes("facts_only")
      ? ["facts_only", ...LLM_VARIANT_KEYS.filter((key) => key !== "facts_only")]
      : [...LLM_VARIANT_KEYS];
    for (const variantKey of orderedVariantKeys) {
      const fallbackVariant = fallbackVariants[variantKey];
      if (!fallbackVariant) continue;

      const variantJobAttempt = await beginRewriteJob({
        snapshotId,
        articleId: article.id,
        variantKey
      });
      if (!variantJobAttempt) {
        continue;
      }

      try {
        const { variant, rewriteMethod } = await rewriteVariantForArticle({
          article,
          variantKey,
          fallbackVariant,
          factsOnlyVariant:
            variantKey === "clickbait" ? latestFactsOnlyVariant : null
        });
        const finalizedVariant = variant || fallbackVariant;
        const writeAt = new Date().toISOString();

        if (variantKey === "facts_only") {
          latestFactsOnlyVariant = finalizedVariant;
        }

        await upsertSnapshotVariant({
          snapshotId,
          snapshotDate,
          articleId: article.id,
          variantKey,
          title: finalizedVariant.title ?? article.title,
          lead: finalizedVariant.lead ?? article.lead ?? null,
          bodyJson: JSON.stringify(
            Array.isArray(finalizedVariant.body)
              ? finalizedVariant.body
              : article.body ?? []
          ),
          rewriteMethod,
          createdAt: writeAt
        });

        await completeRewriteJob({
          snapshotId,
          articleId: article.id,
          variantKey
        });

        updated += 1;
        if (rewriteMethod === TONE_LLM_METHOD) {
          llm += 1;
        } else {
          fallback += 1;
        }

        const cachedArticle = articleCache.get(article.id);
        if (cachedArticle) {
          const cachedVariants = cachedArticle.variants || buildVariants(cachedArticle);
          const cachedVariantMethods =
            cachedArticle.variantMethods || buildRuleVariantMethods();
          articleCache.set(article.id, {
            ...cachedArticle,
            variants: {
              ...cachedVariants,
              [variantKey]: finalizedVariant
            },
            variantMethods: {
              ...cachedVariantMethods,
              [variantKey]: rewriteMethod
            }
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await failRewriteJob({
          snapshotId,
          articleId: article.id,
          variantKey,
          attempts: variantJobAttempt.attempts,
          maxAttempts: variantJobAttempt.maxAttempts,
          errorMessage: message
        });
      }
    }
  }

  const pendingCount = await countRewriteJobsByStatus(
    REWRITE_JOB_STATUS_PENDING,
    snapshotId
  );
  const runningCount = await countRewriteJobsByStatus(
    REWRITE_JOB_STATUS_RUNNING,
    snapshotId
  );
  const failedCount = await countRewriteJobsByStatus(
    REWRITE_JOB_STATUS_FAILED,
    snapshotId
  );

  if (pendingCount === 0 && runningCount === 0 && failedCount === 0) {
    const readyAt = new Date().toISOString();
    await updateSnapshotLifecycle({
      snapshotId,
      status: SNAPSHOT_STATUS_READY,
      startedAt: null,
      completedAt: readyAt,
      publishedAt: readyAt,
      errorMessage: null
    });
    await upsertCurrentSnapshot({
      category,
      limitCount,
      provider,
      snapshotId
    });
    const refreshedSnapshot = await getSnapshotById(snapshotId);
    if (
      refreshedSnapshot &&
      Array.isArray(refreshedSnapshot.articles) &&
      refreshedSnapshot.articles.length > 0
    ) {
      feedCache.set(`${category}::${limitCount}`, {
        articles: refreshedSnapshot.articles,
        categories: refreshedSnapshot.categories,
        snapshotId: refreshedSnapshot.snapshotId,
        snapshotDate: refreshedSnapshot.snapshotDate,
        expiresAt: Date.now() + FEED_CACHE_TTL_MS
      });
    }
  } else if (failedCount > 0 && pendingCount === 0 && runningCount === 0) {
    await updateSnapshotLifecycle({
      snapshotId,
      status: SNAPSHOT_STATUS_FAILED,
      startedAt: null,
      completedAt: new Date().toISOString(),
      publishedAt: null,
      errorMessage: `rewrite jobs failed: ${failedCount}`
    });
  }

  return {
    updated,
    llm,
    fallback,
    pending: pendingCount,
    running: runningCount,
    failed: failedCount
  };
}

function queueToneRewriteForSnapshot(context) {
  if (!isToneLlmEnabled()) {
    return false;
  }

  if (rewriteJobsInFlight.has(context.snapshotId)) {
    return false;
  }

  rewriteJobsInFlight.add(context.snapshotId);

  setImmediate(async () => {
    try {
      const stats = await rewriteSnapshotToneVariants(context);
      console.log(
        `[rewrite-tone-llm] snapshot=${context.snapshotId} completed updated=${stats.updated} llm=${stats.llm} fallback=${stats.fallback}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await updateSnapshotLifecycle({
        snapshotId: context.snapshotId,
        status: SNAPSHOT_STATUS_FAILED,
        startedAt: null,
        completedAt: new Date().toISOString(),
        publishedAt: null,
        errorMessage: message
      });
      console.warn(
        `[rewrite-tone-llm] snapshot=${context.snapshotId} failed: ${message}`
      );
    } finally {
      rewriteJobsInFlight.delete(context.snapshotId);
    }
  });

  return true;
}

const saveDailySnapshotSqlite = db.transaction(
  ({ snapshotDate, category, limitCount, provider, articles }) => {
    const nowIso = new Date().toISOString();
    const snapshotRow = upsertSnapshotStmt.get({
      snapshotDate,
      category,
      limitCount,
      provider,
      createdAt: nowIso,
      status: SNAPSHOT_STATUS_BUILDING,
      startedAt: nowIso,
      completedAt: null,
      publishedAt: null,
      errorMessage: null
    });
    const snapshotId = snapshotRow.snapshot_id;
    const capturedAt = nowIso;

    for (const article of articles) {
      upsertArticleStmt.run({
        articleId: article.id,
        provider,
        title: article.title,
        category: article.category ?? null,
        topicLabel: article.topicLabel ?? null,
        topicTag: article.topicTag ?? null,
        publishedMinutesAgo:
          Number.isFinite(article.publishedMinutesAgo) && article.publishedMinutesAgo >= 0
            ? Math.round(article.publishedMinutesAgo)
            : null,
        lead: article.lead ?? null,
        bodyJson: JSON.stringify(Array.isArray(article.body) ? article.body : []),
        image: article.image ?? null,
        sourceName: article.source?.name ?? null,
        sourceUri: article.source?.uri ?? null,
        sourceArticleUri: article.source?.articleUri ?? null,
        publishedAt: article.publishedAt ?? null,
        metadataJson: JSON.stringify({
          topicLabel: article.topicLabel ?? null,
          topicTag: article.topicTag ?? null
        }),
        updatedAt: nowIso
      });
    }

    deleteSnapshotItemsStmt.run({ snapshotId });
    deleteSnapshotArticlesStmt.run({ snapshotId });
    deleteSnapshotVariantsStmt.run({ snapshotId });
    db.prepare("DELETE FROM rewrite_jobs WHERE snapshot_id = @snapshotId").run({
      snapshotId
    });

    articles.forEach((article, index) => {
      const rank = index + 1;
      insertSnapshotItemStmt.run({
        snapshotId,
        rank,
        articleId: article.id
      });

      insertSnapshotArticleStmt.run({
        snapshotId,
        snapshotDate,
        articleId: article.id,
        rank,
        title: article.title,
        lead: article.lead ?? null,
        bodyJson: JSON.stringify(Array.isArray(article.body) ? article.body : []),
        category: article.category ?? null,
        topicLabel: article.topicLabel ?? null,
        topicTag: article.topicTag ?? null,
        image: article.image ?? null,
        sourceName: article.source?.name ?? null,
        sourceUri: article.source?.uri ?? null,
        sourceArticleUri: article.source?.articleUri ?? null,
        publishedAt: article.publishedAt ?? null,
        capturedAt
      });

      const variants = article.variants || buildVariants(article);
      const variantMethods = article.variantMethods || {};
      for (const [variantKey, variant] of Object.entries(variants)) {
        insertSnapshotVariantStmt.run({
          snapshotId,
          snapshotDate,
          articleId: article.id,
          variantKey,
          title: variant.title ?? article.title,
          lead: variant.lead ?? article.lead ?? null,
          bodyJson: JSON.stringify(
            Array.isArray(variant.body) ? variant.body : article.body ?? []
          ),
          rewriteMethod:
            typeof variantMethods[variantKey] === "string" &&
            variantMethods[variantKey].length > 0
              ? variantMethods[variantKey]
              : RULE_REWRITE_METHOD,
          createdAt: nowIso
        });
      }
    });

    return {
      snapshotId
    };
  }
);

async function saveDailySnapshot({
  snapshotDate,
  category,
  limitCount,
  provider,
  articles
}) {
  if (!POSTGRES_ENABLED) {
    return saveDailySnapshotSqlite({
      snapshotDate,
      category,
      limitCount,
      provider,
      articles
    });
  }

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const nowIso = new Date().toISOString();
    const snapshotResult = await client.query(
      `
        INSERT INTO feed_snapshots (
          snapshot_date,
          category,
          limit_count,
          provider,
          created_at,
          status,
          started_at,
          completed_at,
          published_at,
          error_message
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT(snapshot_date, category, limit_count, provider)
        DO UPDATE SET
          created_at = excluded.created_at,
          status = excluded.status,
          started_at = excluded.started_at,
          completed_at = excluded.completed_at,
          published_at = excluded.published_at,
          error_message = excluded.error_message
        RETURNING snapshot_id
      `,
      [
        snapshotDate,
        category,
        limitCount,
        provider,
        nowIso,
        SNAPSHOT_STATUS_BUILDING,
        nowIso,
        null,
        null,
        null
      ]
    );
    const snapshotId = Number(snapshotResult.rows?.[0]?.snapshot_id);
    const capturedAt = nowIso;

    for (const article of articles) {
      await client.query(
        `
          INSERT INTO articles (
            article_id,
            provider,
            title,
            category,
            topic_label,
            topic_tag,
            published_minutes_ago,
            lead,
            body_json,
            image,
            source_name,
            source_uri,
            source_article_uri,
            published_at,
            metadata_json,
            updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
          )
          ON CONFLICT(article_id) DO UPDATE SET
            provider = excluded.provider,
            title = excluded.title,
            category = excluded.category,
            topic_label = excluded.topic_label,
            topic_tag = excluded.topic_tag,
            published_minutes_ago = excluded.published_minutes_ago,
            lead = excluded.lead,
            body_json = excluded.body_json,
            image = excluded.image,
            source_name = excluded.source_name,
            source_uri = excluded.source_uri,
            source_article_uri = excluded.source_article_uri,
            published_at = excluded.published_at,
            metadata_json = excluded.metadata_json,
            updated_at = excluded.updated_at
        `,
        [
          article.id,
          provider,
          article.title,
          article.category ?? null,
          article.topicLabel ?? null,
          article.topicTag ?? null,
          Number.isFinite(article.publishedMinutesAgo) &&
          article.publishedMinutesAgo >= 0
            ? Math.round(article.publishedMinutesAgo)
            : null,
          article.lead ?? null,
          JSON.stringify(Array.isArray(article.body) ? article.body : []),
          article.image ?? null,
          article.source?.name ?? null,
          article.source?.uri ?? null,
          article.source?.articleUri ?? null,
          article.publishedAt ?? null,
          JSON.stringify({
            topicLabel: article.topicLabel ?? null,
            topicTag: article.topicTag ?? null
          }),
          nowIso
        ]
      );
    }

    await client.query("DELETE FROM feed_snapshot_items WHERE snapshot_id = $1", [
      snapshotId
    ]);
    await client.query("DELETE FROM snapshot_articles WHERE snapshot_id = $1", [
      snapshotId
    ]);
    await client.query(
      "DELETE FROM snapshot_article_variants WHERE snapshot_id = $1",
      [snapshotId]
    );
    await client.query("DELETE FROM rewrite_jobs WHERE snapshot_id = $1", [snapshotId]);

    for (let index = 0; index < articles.length; index += 1) {
      const article = articles[index];
      const rank = index + 1;

      await client.query(
        `
          INSERT INTO feed_snapshot_items (
            snapshot_id,
            rank,
            article_id
          ) VALUES ($1,$2,$3)
        `,
        [snapshotId, rank, article.id]
      );

      await client.query(
        `
          INSERT INTO snapshot_articles (
            snapshot_id,
            snapshot_date,
            article_id,
            rank,
            title,
            lead,
            body_json,
            category,
            topic_label,
            topic_tag,
            image,
            source_name,
            source_uri,
            source_article_uri,
            published_at,
            captured_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        `,
        [
          snapshotId,
          snapshotDate,
          article.id,
          rank,
          article.title,
          article.lead ?? null,
          JSON.stringify(Array.isArray(article.body) ? article.body : []),
          article.category ?? null,
          article.topicLabel ?? null,
          article.topicTag ?? null,
          article.image ?? null,
          article.source?.name ?? null,
          article.source?.uri ?? null,
          article.source?.articleUri ?? null,
          article.publishedAt ?? null,
          capturedAt
        ]
      );

      const variants = article.variants || buildVariants(article);
      const variantMethods = article.variantMethods || {};
      for (const [variantKey, variant] of Object.entries(variants)) {
        await client.query(
          `
            INSERT INTO snapshot_article_variants (
              snapshot_id,
              snapshot_date,
              article_id,
              variant_key,
              title,
              lead,
              body_json,
              rewrite_method,
              created_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT(snapshot_id, article_id, variant_key) DO UPDATE SET
              title = excluded.title,
              lead = excluded.lead,
              body_json = excluded.body_json,
              rewrite_method = excluded.rewrite_method,
              created_at = excluded.created_at
          `,
          [
            snapshotId,
            snapshotDate,
            article.id,
            variantKey,
            variant.title ?? article.title,
            variant.lead ?? article.lead ?? null,
            JSON.stringify(
              Array.isArray(variant.body) ? variant.body : article.body ?? []
            ),
            typeof variantMethods[variantKey] === "string" &&
            variantMethods[variantKey].length > 0
              ? variantMethods[variantKey]
              : RULE_REWRITE_METHOD,
            nowIso
          ]
        );
      }
    }

    await client.query("COMMIT");
    return { snapshotId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const saveTopicClassificationAuditRunSqlite = db.transaction((input) => {
  const nowIso = new Date().toISOString();
  const items = Array.isArray(input.items) ? input.items : [];
  const result = insertTopicAuditRunStmt.run({
    createdAt: input.createdAt || nowIso,
    snapshotDate: input.snapshotDate ?? null,
    category: input.category ?? null,
    limitCount: Number.isFinite(Number(input.limitCount))
      ? Math.round(Number(input.limitCount))
      : null,
    provider: input.provider || "newsapi_ai",
    sourceUri: input.sourceUri ?? null,
    classifierMethod: input.classifierMethod ?? TOPIC_CLASSIFIER_METHOD,
    classifierModel: input.classifierModel ?? TOPIC_CLASSIFIER_MODEL,
    classifierBatchSize: Number.isFinite(Number(input.classifierBatchSize))
      ? Math.round(Number(input.classifierBatchSize))
      : TOPIC_CLASSIFIER_BATCH_SIZE,
    feedPerTopicTarget: Number.isFinite(Number(input.feedPerTopicTarget))
      ? Math.round(Number(input.feedPerTopicTarget))
      : FEED_PER_TOPIC_TARGET,
    freshArticleMaxAgeHours: Number.isFinite(Number(input.freshArticleMaxAgeHours))
      ? Math.round(Number(input.freshArticleMaxAgeHours))
      : FEED_FRESH_ARTICLE_MAX_AGE_HOURS,
    pagesFetched: Number.isFinite(Number(input.pagesFetched))
      ? Math.round(Number(input.pagesFetched))
      : 0,
    fetchedCount: Number.isFinite(Number(input.fetchedCount))
      ? Math.round(Number(input.fetchedCount))
      : items.length,
    auditedCount: Number.isFinite(Number(input.auditedCount))
      ? Math.round(Number(input.auditedCount))
      : items.length,
    eligibleCount: Number.isFinite(Number(input.eligibleCount))
      ? Math.round(Number(input.eligibleCount))
      : items.filter((item) => item.eligibleForFeed).length,
    selectedCount: Number.isFinite(Number(input.selectedCount))
      ? Math.round(Number(input.selectedCount))
      : items.filter((item) => item.selectedForSnapshot).length,
    snapshotId:
      Number.isFinite(Number(input.snapshotId)) && Number(input.snapshotId) > 0
        ? Math.round(Number(input.snapshotId))
        : null,
    status: input.status || "completed",
    errorMessage: input.errorMessage ?? null,
    metadataJson: JSON.stringify(input.metadata || {})
  });
  const runId = Number(result.lastInsertRowid);

  for (const item of items) {
    insertTopicAuditItemStmt.run({
      runId,
      providerRank: Number.isFinite(Number(item.providerRank))
        ? Math.round(Number(item.providerRank))
        : 0,
      articleId: item.articleId ?? null,
      title: item.title || "",
      lead: item.lead ?? null,
      publishedAt: item.publishedAt ?? null,
      wordCount: Number.isFinite(Number(item.wordCount))
        ? Math.round(Number(item.wordCount))
        : 0,
      lengthOk: item.lengthOk ? 1 : 0,
      isFresh: item.isFresh ? 1 : 0,
      classifiedTopic: item.classifiedTopic ?? null,
      topicTag: item.topicTag ?? null,
      eligibleForFeed: item.eligibleForFeed ? 1 : 0,
      selectedForSnapshot: item.selectedForSnapshot ? 1 : 0,
      skipReason: item.skipReason ?? null,
      classifierStatus: item.classifierStatus ?? null,
      fallbackUsed: item.fallbackUsed ? 1 : 0,
      metadataJson: JSON.stringify(item.metadata || {})
    });
  }

  return { auditRunId: runId };
});

async function saveTopicClassificationAuditRun(input) {
  const items = Array.isArray(input.items) ? input.items : [];
  if (!POSTGRES_ENABLED) {
    return saveTopicClassificationAuditRunSqlite({
      ...input,
      items
    });
  }

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const nowIso = new Date().toISOString();
    const runResult = await client.query(
      `
        INSERT INTO topic_classification_audit_runs (
          created_at,
          snapshot_date,
          category,
          limit_count,
          provider,
          source_uri,
          classifier_method,
          classifier_model,
          classifier_batch_size,
          feed_per_topic_target,
          fresh_article_max_age_hours,
          pages_fetched,
          fetched_count,
          audited_count,
          eligible_count,
          selected_count,
          snapshot_id,
          status,
          error_message,
          metadata_json
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
        )
        RETURNING id
      `,
      [
        input.createdAt || nowIso,
        input.snapshotDate ?? null,
        input.category ?? null,
        Number.isFinite(Number(input.limitCount))
          ? Math.round(Number(input.limitCount))
          : null,
        input.provider || "newsapi_ai",
        input.sourceUri ?? null,
        input.classifierMethod ?? TOPIC_CLASSIFIER_METHOD,
        input.classifierModel ?? TOPIC_CLASSIFIER_MODEL,
        Number.isFinite(Number(input.classifierBatchSize))
          ? Math.round(Number(input.classifierBatchSize))
          : TOPIC_CLASSIFIER_BATCH_SIZE,
        Number.isFinite(Number(input.feedPerTopicTarget))
          ? Math.round(Number(input.feedPerTopicTarget))
          : FEED_PER_TOPIC_TARGET,
        Number.isFinite(Number(input.freshArticleMaxAgeHours))
          ? Math.round(Number(input.freshArticleMaxAgeHours))
          : FEED_FRESH_ARTICLE_MAX_AGE_HOURS,
        Number.isFinite(Number(input.pagesFetched))
          ? Math.round(Number(input.pagesFetched))
          : 0,
        Number.isFinite(Number(input.fetchedCount))
          ? Math.round(Number(input.fetchedCount))
          : items.length,
        Number.isFinite(Number(input.auditedCount))
          ? Math.round(Number(input.auditedCount))
          : items.length,
        Number.isFinite(Number(input.eligibleCount))
          ? Math.round(Number(input.eligibleCount))
          : items.filter((item) => item.eligibleForFeed).length,
        Number.isFinite(Number(input.selectedCount))
          ? Math.round(Number(input.selectedCount))
          : items.filter((item) => item.selectedForSnapshot).length,
        Number.isFinite(Number(input.snapshotId)) && Number(input.snapshotId) > 0
          ? Math.round(Number(input.snapshotId))
          : null,
        input.status || "completed",
        input.errorMessage ?? null,
        JSON.stringify(input.metadata || {})
      ]
    );
    const runId = Number(runResult.rows?.[0]?.id);

    for (const item of items) {
      await client.query(
        `
          INSERT INTO topic_classification_audit_items (
            run_id,
            provider_rank,
            article_id,
            title,
            lead,
            published_at,
            word_count,
            length_ok,
            is_fresh,
            classified_topic,
            topic_tag,
            eligible_for_feed,
            selected_for_snapshot,
            skip_reason,
            classifier_status,
            fallback_used,
            metadata_json
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        `,
        [
          runId,
          Number.isFinite(Number(item.providerRank))
            ? Math.round(Number(item.providerRank))
            : 0,
          item.articleId ?? null,
          item.title || "",
          item.lead ?? null,
          item.publishedAt ?? null,
          Number.isFinite(Number(item.wordCount))
            ? Math.round(Number(item.wordCount))
            : 0,
          Boolean(item.lengthOk),
          Boolean(item.isFresh),
          item.classifiedTopic ?? null,
          item.topicTag ?? null,
          Boolean(item.eligibleForFeed),
          Boolean(item.selectedForSnapshot),
          item.skipReason ?? null,
          item.classifierStatus ?? null,
          Boolean(item.fallbackUsed),
          JSON.stringify(item.metadata || {})
        ]
      );
    }

    await client.query("COMMIT");
    return { auditRunId: runId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function saveTopicClassificationAuditRunBestEffort(input) {
  try {
    return await saveTopicClassificationAuditRun(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[topic-audit] failed to save audit run: ${message}`);
    return { auditRunId: null, error: message };
  }
}

async function listTopicAuditRuns(limit = 20) {
  const safeLimit = Number.isFinite(Number(limit))
    ? Math.max(1, Math.min(100, Math.round(Number(limit))))
    : 20;
  if (!POSTGRES_ENABLED) {
    return listTopicAuditRunsStmt
      .all({ limit: safeLimit })
      .map(rowToTopicAuditRun)
      .filter(Boolean);
  }
  const result = await pgQuery(
    `
      SELECT
        id,
        created_at,
        snapshot_date,
        category,
        limit_count,
        provider,
        source_uri,
        classifier_method,
        classifier_model,
        classifier_batch_size,
        feed_per_topic_target,
        fresh_article_max_age_hours,
        pages_fetched,
        fetched_count,
        audited_count,
        eligible_count,
        selected_count,
        snapshot_id,
        status,
        error_message,
        metadata_json
      FROM topic_classification_audit_runs
      ORDER BY created_at DESC, id DESC
      LIMIT $1
    `,
    [safeLimit]
  );
  return result.rows.map(rowToTopicAuditRun).filter(Boolean);
}

async function getTopicAuditRunById(runId) {
  const id = Number(runId);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  if (!POSTGRES_ENABLED) {
    return rowToTopicAuditRun(findTopicAuditRunByIdStmt.get({ runId: Math.round(id) }));
  }
  const result = await pgQuery(
    `
      SELECT
        id,
        created_at,
        snapshot_date,
        category,
        limit_count,
        provider,
        source_uri,
        classifier_method,
        classifier_model,
        classifier_batch_size,
        feed_per_topic_target,
        fresh_article_max_age_hours,
        pages_fetched,
        fetched_count,
        audited_count,
        eligible_count,
        selected_count,
        snapshot_id,
        status,
        error_message,
        metadata_json
      FROM topic_classification_audit_runs
      WHERE id = $1
      LIMIT 1
    `,
    [Math.round(id)]
  );
  return rowToTopicAuditRun(result.rows?.[0]);
}

async function getTopicAuditRunBySnapshotId(snapshotId) {
  const id = Number(snapshotId);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  if (!POSTGRES_ENABLED) {
    return rowToTopicAuditRun(
      findTopicAuditRunBySnapshotIdStmt.get({ snapshotId: Math.round(id) })
    );
  }
  const result = await pgQuery(
    `
      SELECT
        id,
        created_at,
        snapshot_date,
        category,
        limit_count,
        provider,
        source_uri,
        classifier_method,
        classifier_model,
        classifier_batch_size,
        feed_per_topic_target,
        fresh_article_max_age_hours,
        pages_fetched,
        fetched_count,
        audited_count,
        eligible_count,
        selected_count,
        snapshot_id,
        status,
        error_message,
        metadata_json
      FROM topic_classification_audit_runs
      WHERE snapshot_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [Math.round(id)]
  );
  return rowToTopicAuditRun(result.rows?.[0]);
}

async function getLatestTopicAuditRun() {
  const runs = await listTopicAuditRuns(1);
  return Array.isArray(runs) && runs.length > 0 ? runs[0] : null;
}

async function listTopicAuditItems(runId) {
  const id = Number(runId);
  if (!Number.isFinite(id) || id <= 0) {
    return [];
  }
  if (!POSTGRES_ENABLED) {
    return listTopicAuditItemsStmt
      .all({ runId: Math.round(id) })
      .map(rowToTopicAuditItem)
      .filter(Boolean);
  }
  const result = await pgQuery(
    `
      SELECT
        id,
        run_id,
        provider_rank,
        article_id,
        title,
        lead,
        published_at,
        word_count,
        length_ok,
        is_fresh,
        classified_topic,
        topic_tag,
        eligible_for_feed,
        selected_for_snapshot,
        skip_reason,
        classifier_status,
        fallback_used,
        metadata_json
      FROM topic_classification_audit_items
      WHERE run_id = $1
      ORDER BY provider_rank ASC, id ASC
    `,
    [Math.round(id)]
  );
  return result.rows.map(rowToTopicAuditItem).filter(Boolean);
}

async function runDailyRefreshTick() {
  if (!DAILY_REFRESH_ENABLED) {
    return;
  }
  if (dailyRefreshInFlight) {
    return;
  }

  const today = utcDayStamp();
  if (dailyRefreshLastSuccessDate === today) {
    return;
  }

  dailyRefreshInFlight = true;
  dailyRefreshLastAttemptAt = new Date().toISOString();
  try {
    const url = new URL(`http://127.0.0.1:${PORT}/feed`);
    url.searchParams.set("category", DAILY_REFRESH_CATEGORY);
    url.searchParams.set("refresh", "1");
    if (DAILY_REFRESH_LIMIT > 0) {
      url.searchParams.set("limit", String(DAILY_REFRESH_LIMIT));
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`status=${response.status} body=${text}`);
    }

    const payload = await response.json().catch(() => ({}));
    if (payload?.ok !== true) {
      throw new Error("daily refresh payload was not ok=true");
    }
    if (
      payload?.toneRewriteQueued === true ||
      (typeof payload?.snapshotStatus === "string" &&
        payload.snapshotStatus !== SNAPSHOT_STATUS_READY)
    ) {
      throw new Error(
        `daily refresh finished without ready snapshot (snapshotStatus=${payload?.snapshotStatus || "unknown"}, toneRewriteQueued=${String(payload?.toneRewriteQueued)})`
      );
    }
    dailyRefreshLastSuccessDate = today;
    console.log(
      `[daily-refresh] success date=${today} snapshotId=${payload.snapshotId ?? "n/a"} count=${payload.count ?? 0}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[daily-refresh] failed date=${today}: ${message}`);
  } finally {
    dailyRefreshInFlight = false;
  }
}

async function listBuildingSnapshots() {
  if (!POSTGRES_ENABLED) {
    return db
      .prepare(
        `
          SELECT
            snapshot_id,
            snapshot_date,
            category,
            limit_count,
            provider
          FROM feed_snapshots
          WHERE status = @status
          ORDER BY created_at ASC, snapshot_id ASC
        `
      )
      .all({ status: SNAPSHOT_STATUS_BUILDING });
  }
  const result = await pgQuery(
    `
      SELECT
        snapshot_id,
        snapshot_date,
        category,
        limit_count,
        provider
      FROM feed_snapshots
      WHERE status = $1
      ORDER BY created_at ASC, snapshot_id ASC
    `,
    [SNAPSHOT_STATUS_BUILDING]
  );
  return result.rows;
}

async function recoverIncompleteSnapshots() {
  await resetStaleRunningRewriteJobs();
  const snapshots = await listBuildingSnapshots();
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return;
  }

  for (const row of snapshots) {
    const snapshotId = Number(row.snapshot_id);
    if (!Number.isFinite(snapshotId) || snapshotId <= 0) {
      continue;
    }
    const context = {
      snapshotId,
      snapshotDate: row.snapshot_date,
      category: row.category,
      limitCount: Number(row.limit_count),
      provider: row.provider
    };

    if (!isToneLlmEnabled()) {
      const readyAt = new Date().toISOString();
      await updateSnapshotLifecycle({
        snapshotId,
        status: SNAPSHOT_STATUS_READY,
        startedAt: null,
        completedAt: readyAt,
        publishedAt: readyAt,
        errorMessage: null
      });
      await upsertCurrentSnapshot({
        category: context.category,
        limitCount: context.limitCount,
        provider: context.provider,
        snapshotId
      });
      continue;
    }

    queueToneRewriteForSnapshot(context);
  }
}

async function bootstrapCurrentSnapshotsFromReady() {
  let rows = [];
  if (!POSTGRES_ENABLED) {
    rows = db
      .prepare(
        `
          SELECT
            snapshot_id,
            category,
            limit_count,
            provider
          FROM feed_snapshots
          WHERE status = @status
          ORDER BY category ASC, limit_count ASC, provider ASC, COALESCE(published_at, created_at) DESC, snapshot_id DESC
        `
      )
      .all({ status: SNAPSHOT_STATUS_READY });
  } else {
    const result = await pgQuery(
      `
        SELECT
          snapshot_id,
          category,
          limit_count,
          provider
        FROM feed_snapshots
        WHERE status = $1
        ORDER BY category ASC, limit_count ASC, provider ASC, COALESCE(published_at, created_at) DESC, snapshot_id DESC
      `,
      [SNAPSHOT_STATUS_READY]
    );
    rows = result.rows;
  }

  const seen = new Set();
  for (const row of rows) {
    const key = `${row.category}::${row.limit_count}::${row.provider}`;
    if (seen.has(key)) {
      continue;
    }
    const snapshotId = Number(row.snapshot_id);
    if (!Number.isFinite(snapshotId) || snapshotId <= 0) {
      continue;
    }
    await upsertCurrentSnapshot({
      category: row.category,
      limitCount: Number(row.limit_count),
      provider: row.provider,
      snapshotId
    });
    seen.add(key);
  }
}

function startDailyRefreshScheduler() {
  if (!DAILY_REFRESH_ENABLED) {
    return;
  }
  setInterval(() => {
    void runDailyRefreshTick();
  }, DAILY_REFRESH_INTERVAL_MS);
  void runDailyRefreshTick();
}

app.get("/health", async (_req, res) => {
  const rewriteJobsRunning = await countRewriteJobsByStatus(
    REWRITE_JOB_STATUS_RUNNING
  );
  const rewriteJobsPending = await countRewriteJobsByStatus(
    REWRITE_JOB_STATUS_PENDING
  );
  const rewriteJobsFailed = await countRewriteJobsByStatus(
    REWRITE_JOB_STATUS_FAILED
  );
  const activeRewriteWorkers = rewriteJobsInFlight.size;
  res.json({
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    dbMode: POSTGRES_ENABLED ? "postgres" : "sqlite",
    dbPath: POSTGRES_ENABLED ? null : DB_PATH,
    postgresEnabled: POSTGRES_ENABLED,
    newsProvider: "newsapi_ai",
    newsapiConfigured: Boolean(NEWSAPI_AI_KEY),
    newsapiAiSourceUri: NEWSAPI_AI_SOURCE_URI || null,
    newsapiAiSourceKeyword:
      !NEWSAPI_AI_SOURCE_URI && NEWSAPI_AI_SOURCE_KEYWORD
        ? NEWSAPI_AI_SOURCE_KEYWORD
        : null,
    rewriteMode: REWRITE_MODE,
    rewriteMethod: currentRewriteMethod(),
    toneLlmEnabled: isToneLlmEnabled(),
    toneLlmModel: isToneLlmEnabled() ? OPENAI_MODEL : null,
    toneLlmTemperature: isToneLlmEnabled() ? OPENAI_TEMPERATURE : null,
    toneLlmTimeoutMs: isToneLlmEnabled() ? REWRITE_TIMEOUT_MS : null,
    toneLlmMaxAttempts: isToneLlmEnabled() ? REWRITE_MAX_ATTEMPTS : null,
    toneLlmPipeline: isToneLlmEnabled() ? REWRITE_PIPELINE : null,
    toneRewriteJobsInFlight: rewriteJobsRunning + activeRewriteWorkers,
    rewriteJobsPending,
    rewriteJobsRunning,
    rewriteJobsFailed,
    activeRewriteWorkers,
    allVariantKeys: ALL_VARIANT_KEYS,
    llmEnabledVariants: LLM_VARIANT_KEYS,
    toneLlmMethod: TONE_LLM_METHOD,
    rewriteFallbackMethod: RULE_REWRITE_METHOD,
    feedCacheTtlMs: FEED_CACHE_TTL_MS,
    feedMinWords: FEED_MIN_WORDS,
    feedMaxWords: FEED_MAX_WORDS,
    feedFreshArticleMaxAgeHours: FEED_FRESH_ARTICLE_MAX_AGE_HOURS,
    feedWaitForRewrite: FEED_WAIT_FOR_REWRITE,
    dailyRefreshEnabled: DAILY_REFRESH_ENABLED,
    dailyRefreshCategory: DAILY_REFRESH_CATEGORY,
    dailyRefreshLimit: DAILY_REFRESH_LIMIT > 0 ? DAILY_REFRESH_LIMIT : null,
    dailyRefreshIntervalMs: DAILY_REFRESH_INTERVAL_MS,
    dailyRefreshInFlight,
    dailyRefreshLastAttemptAt,
    dailyRefreshLastSuccessDate,
    feedPerTopicTarget: FEED_PER_TOPIC_TARGET,
    topicClassifierEnabled: TOPIC_CLASSIFIER_ENABLED,
    topicClassifierMethod: TOPIC_CLASSIFIER_METHOD,
    topicClassifierModel: TOPIC_CLASSIFIER_MODEL,
    topicClassifierBatchSize: TOPIC_CLASSIFIER_BATCH_SIZE,
    feedSelectorEnabled: FEED_SELECTOR_ENABLED,
    feedSelectorFreshOnly: FEED_SELECTOR_FRESH_ONLY,
    feedSelectorMethod: FEED_SELECTOR_METHOD,
    feedSelectorModel: FEED_SELECTOR_MODEL,
    feedSelectorCandidatesPerTopic: FEED_SELECTOR_CANDIDATES_PER_TOPIC,
    feedTopicTargets: FEED_TOPIC_TARGETS,
    feedFetchMaxPages: FEED_FETCH_MAX_PAGES
  });
});

app.get("/admin/ops/summary", async (req, res) => {
  if (!isAdminRequestAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized admin request."
    });
  }

  const category = normalizeRequestedCategory(req.query.category);
  const defaultLimit = resolveDefaultFeedLimit(category);
  const limitRaw = Number(req.query.limit ?? defaultLimit);
  const limitCount = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(50, Math.round(limitRaw)))
    : defaultLimit;
  const provider = "newsapi_ai";
  const today = utcDayStamp();
  const nowIso = new Date().toISOString();
  const publishedSnapshot = await getCurrentPublishedSnapshot({
    category,
    limitCount,
    provider
  });
  const todaySnapshotRow = await findSnapshotRecordByDate({
    snapshotDate: today,
    category,
    limitCount,
    provider
  });
  const todaySnapshot =
    Number.isFinite(Number(todaySnapshotRow?.snapshot_id)) &&
    Number(todaySnapshotRow.snapshot_id) > 0
      ? await getSnapshotById(Number(todaySnapshotRow.snapshot_id))
      : null;
  const rewriteJobsPending = await countRewriteJobsByStatus(
    REWRITE_JOB_STATUS_PENDING
  );
  const rewriteJobsRunning = await countRewriteJobsByStatus(
    REWRITE_JOB_STATUS_RUNNING
  );
  const rewriteJobsFailed = await countRewriteJobsByStatus(
    REWRITE_JOB_STATUS_FAILED
  );

  return res.json({
    ok: true,
    serverTime: nowIso,
    today,
    category,
    limit: limitCount,
    provider,
    publishedSnapshot: publishedSnapshot
      ? {
          snapshotId: publishedSnapshot.snapshotId,
          snapshotDate: publishedSnapshot.snapshotDate,
          status: publishedSnapshot.status,
          count: publishedSnapshot.articles.length,
          categories: publishedSnapshot.categories,
          createdAt: publishedSnapshot.createdAt,
          completedAt: publishedSnapshot.completedAt,
          publishedAt: publishedSnapshot.publishedAt
        }
      : null,
    todaySnapshot: todaySnapshot
      ? {
          snapshotId: todaySnapshot.snapshotId,
          snapshotDate: todaySnapshot.snapshotDate,
          status: todaySnapshot.status,
          count: todaySnapshot.articles.length,
          categories: todaySnapshot.categories,
          createdAt: todaySnapshot.createdAt,
          startedAt: todaySnapshot.startedAt,
          completedAt: todaySnapshot.completedAt,
          publishedAt: todaySnapshot.publishedAt,
          errorMessage: todaySnapshot.errorMessage
        }
      : todaySnapshotRow
        ? {
            snapshotId: Number(todaySnapshotRow.snapshot_id),
            snapshotDate: today,
            status: todaySnapshotRow.status,
            count: 0,
            categories: [],
            createdAt: todaySnapshotRow.created_at,
            startedAt: todaySnapshotRow.started_at,
            completedAt: todaySnapshotRow.completed_at,
            publishedAt: todaySnapshotRow.published_at,
            errorMessage: todaySnapshotRow.error_message
          }
        : null,
    publishedMatchesToday:
      Boolean(publishedSnapshot) && publishedSnapshot.snapshotDate === today,
    refreshState: {
      enabled: DAILY_REFRESH_ENABLED,
      inFlight: dailyRefreshInFlight,
      lastAttemptAt: dailyRefreshLastAttemptAt,
      lastSuccessDate: dailyRefreshLastSuccessDate
    },
    rewriteJobs: {
      global: {
        pending: rewriteJobsPending,
        running: rewriteJobsRunning,
        failed: rewriteJobsFailed
      },
      todaySnapshot:
        todaySnapshot && Number.isFinite(Number(todaySnapshot.snapshotId))
          ? {
              pending: await countRewriteJobsByStatus(
                REWRITE_JOB_STATUS_PENDING,
                Number(todaySnapshot.snapshotId)
              ),
              running: await countRewriteJobsByStatus(
                REWRITE_JOB_STATUS_RUNNING,
                Number(todaySnapshot.snapshotId)
              ),
              failed: await countRewriteJobsByStatus(
                REWRITE_JOB_STATUS_FAILED,
                Number(todaySnapshot.snapshotId)
              )
            }
          : null
    }
  });
});

app.get("/dashboard/variants", (_req, res) => {
  return res.sendFile(path.join(__dirname, "public", "variants-dashboard.html"));
});

app.get("/dashboard/ops", (_req, res) => {
  return res.sendFile(path.join(__dirname, "public", "ops-dashboard.html"));
});

app.get("/config", async (req, res) => {
  const userId =
    typeof req.query.userId === "string" && req.query.userId.trim().length > 0
      ? req.query.userId.trim()
      : "anonymous";
  const participantAccount = await getParticipantAccountByAuthUserId(userId);
  const experiment = getClickbaitExperimentAssignment({
    userId,
    participantArm: participantAccount?.experimentArm ?? ""
  });

  return res.json({
    ok: true,
    userId,
    appEdition: "clickbait_shell",
    experiment,
    availableArms: VALID_ARMS,
    participantAccount: participantAccount
      ? {
          prolificPid: normalizeProlificPid(participantAccount.prolificPid),
          status: participantAccount.status
        }
      : null
  });
});

function isAdminRequestAuthorized(req) {
  if (!PIPELINE_ADMIN_TOKEN) {
    return true;
  }
  const headerToken = String(req.headers["x-admin-token"] || "").trim();
  return headerToken.length > 0 && headerToken === PIPELINE_ADMIN_TOKEN;
}

app.post("/admin/pipeline/run", async (req, res) => {
  if (!isAdminRequestAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized admin request."
    });
  }
  const category = normalizeRequestedCategory(
    typeof req.body?.category === "string" ? req.body.category : req.query.category
  );
  const limitRaw = Number(
    req.body?.limit ?? req.query.limit ?? DAILY_REFRESH_LIMIT ?? 0
  );
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.max(1, Math.min(50, Math.round(limitRaw)))
    : null;
  const rebuildRequested =
    String(req.body?.rebuild ?? req.query.rebuild ?? "").trim() === "1";

  const url = new URL(`http://127.0.0.1:${PORT}/feed`);
  url.searchParams.set("category", category);
  url.searchParams.set("refresh", "1");
  if (rebuildRequested) {
    url.searchParams.set("rebuild", "1");
  }
  if (Number.isFinite(limit) && limit > 0) {
    url.searchParams.set("limit", String(limit));
  }

  try {
    const response = await fetch(url.toString(), { method: "GET" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: payload?.error || `refresh failed with status ${response.status}`,
        upstream: payload
      });
    }
    return res.json({
      ok: true,
      triggeredAt: new Date().toISOString(),
      category,
      limit,
      rebuildRequested,
      result: payload
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to trigger pipeline."
    });
  }
});

app.get("/admin/pipeline/status", async (req, res) => {
  if (!isAdminRequestAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized admin request."
    });
  }
  const rewriteJobsPending = await countRewriteJobsByStatus(
    REWRITE_JOB_STATUS_PENDING
  );
  const rewriteJobsRunning = await countRewriteJobsByStatus(
    REWRITE_JOB_STATUS_RUNNING
  );
  const rewriteJobsFailed = await countRewriteJobsByStatus(
    REWRITE_JOB_STATUS_FAILED
  );
  return res.json({
    ok: true,
    dailyRefreshEnabled: DAILY_REFRESH_ENABLED,
    dailyRefreshCategory: DAILY_REFRESH_CATEGORY,
    dailyRefreshLimit: DAILY_REFRESH_LIMIT > 0 ? DAILY_REFRESH_LIMIT : null,
    dailyRefreshLastAttemptAt,
    dailyRefreshLastSuccessDate,
    rewriteJobsPending,
    rewriteJobsRunning,
    rewriteJobsFailed
  });
});

app.get("/admin/topic-audit", (_req, res) => {
  const title = "Topic Classification Audit";
  return res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; --border: #d7d7d7; --muted: #666; --bg: #f6f3ee; --card: #fffdf8; --ink: #1d1a16; }
    body { margin: 0; padding: 24px; background: var(--bg); color: var(--ink); font-family: Georgia, "Times New Roman", serif; }
    main { max-width: 1280px; margin: 0 auto; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    p { color: var(--muted); }
    form { display: grid; grid-template-columns: minmax(240px, 1fr) 100px 120px 130px auto; gap: 10px; align-items: end; margin: 20px 0; padding: 16px; background: var(--card); border: 1px solid var(--border); }
    label { display: grid; gap: 4px; font-size: 13px; color: var(--muted); }
    input, select, button { font: inherit; padding: 9px 10px; border: 1px solid var(--border); background: white; }
    button { cursor: pointer; background: #1d1a16; color: white; }
    table { width: 100%; border-collapse: collapse; background: var(--card); border: 1px solid var(--border); }
    th, td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; font-size: 14px; }
    th { position: sticky; top: 0; background: #ece6db; z-index: 1; }
    .muted { color: var(--muted); }
    .pill { display: inline-block; padding: 2px 7px; border-radius: 999px; background: #ece6db; font-size: 12px; }
    .bad { background: #f6d7d7; }
    .good { background: #dcebd8; }
    .warn { background: #f3e2b8; }
    .headline { min-width: 280px; }
    .lead { min-width: 320px; }
    #error { color: #9d1d1d; white-space: pre-wrap; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>Shows the saved topic classification and feed-selector audit for the current published feed by default. Enter a run ID to inspect a specific rebuild attempt.</p>
    <form id="controls">
      <label>Admin token <input id="token" name="token" type="password" autocomplete="off" placeholder="PIPELINE_ADMIN_TOKEN" /></label>
      <label>Run ID <input id="runId" name="runId" type="number" min="1" placeholder="current feed" /></label>
      <label>Topic
        <select id="topicFilter" name="topicFilter">
          <option value="All">All topics</option>
          <option value="Politics">Politics</option>
          <option value="Economy">Economy</option>
          <option value="US">US</option>
          <option value="World">World</option>
          <option value="None">None</option>
        </select>
      </label>
      <label>Freshness
        <select id="freshnessFilter" name="freshnessFilter">
          <option value="All">All ages</option>
          <option value="Fresh">Fresh only</option>
          <option value="Stale">Stale only</option>
        </select>
      </label>
      <button type="submit">Load audit</button>
    </form>
    <p id="summary" class="muted"></p>
    <p id="projection" class="muted"></p>
    <p id="feedStatus" class="muted"></p>
    <p id="error"></p>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Topic</th>
          <th>Status</th>
          <th>Selector</th>
          <th>Published</th>
          <th>Words</th>
          <th>Fresh</th>
          <th class="headline">Headline</th>
          <th class="lead">Lead</th>
          <th>Tag</th>
        </tr>
      </thead>
      <tbody id="rows"></tbody>
    </table>
  </main>
  <script>
    const form = document.getElementById("controls");
    const rows = document.getElementById("rows");
    const summary = document.getElementById("summary");
    const projection = document.getElementById("projection");
    const feedStatus = document.getElementById("feedStatus");
    const error = document.getElementById("error");
    const tokenInput = document.getElementById("token");
    const topicFilter = document.getElementById("topicFilter");
    const freshnessFilter = document.getElementById("freshnessFilter");
    const savedToken = window.sessionStorage.getItem("topicAuditAdminToken") || "";
    const savedTopicFilter = window.sessionStorage.getItem("topicAuditTopicFilter") || "All";
    const savedFreshnessFilter = window.sessionStorage.getItem("topicAuditFreshnessFilter") || "All";
    let lastPayload = null;
    tokenInput.value = savedToken;
    topicFilter.value = savedTopicFilter;
    freshnessFilter.value = savedFreshnessFilter;

    function text(value) {
      return value == null ? "" : String(value);
    }

    function cell(value) {
      const td = document.createElement("td");
      td.textContent = text(value);
      return td;
    }

    function pill(value, className) {
      const span = document.createElement("span");
      span.className = "pill " + (className || "");
      span.textContent = text(value);
      return span;
    }

    function publishedMs(item) {
      const ms = Date.parse(item?.publishedAt || "");
      return Number.isFinite(ms) ? ms : 0;
    }

    function uniqueStrings(values) {
      return Array.from(new Set(values.filter((value) => typeof value === "string" && value.length > 0)));
    }

    function getTopicTargets(payload, articles) {
      const metadataTopics = Array.isArray(payload.run?.metadata?.topicTargets)
        ? payload.run.metadata.topicTargets
        : [];
      const selectorTopics = Array.isArray(payload.run?.metadata?.feedSelectorStats)
        ? payload.run.metadata.feedSelectorStats.map((entry) => entry.topic)
        : [];
      const articleTopics = articles.map((item) => item.classification?.topic).filter((topic) => topic && topic !== "None");
      return uniqueStrings([...metadataTopics, ...selectorTopics, ...articleTopics]);
    }

    function buildFreshnessProjection(payload, articles) {
      const topicTargets = getTopicTargets(payload, articles);
      const target = Number(payload.run?.feedPerTopicTarget || payload.run?.metadata?.perTopicTarget || 0);
      const maxAgeHours = Number(payload.run?.freshArticleMaxAgeHours || 24);
      if (topicTargets.length === 0 || !Number.isFinite(target) || target <= 0) {
        return "";
      }

      const parts = topicTargets.map((topic) => {
        const eligible = articles.filter((item) =>
          item.eligibleForFeed && item.classification?.topic === topic
        );
        const freshEligible = eligible.filter((item) => item.isFresh);
        const selectorCandidates = eligible.filter((item) => item.metadata?.selectorCandidate);
        const freshSelectorCandidates = selectorCandidates.filter((item) => item.isFresh);
        const projected = Math.min(target, freshEligible.length);
        return topic + ": " + freshEligible.length + "/" + eligible.length +
          " fresh eligible, " + freshSelectorCandidates.length + "/" + selectorCandidates.length +
          " fresh candidates, max " + projected + "/" + target;
      });

      return maxAgeHours + "h projection " + parts.join("; ");
    }

    function renderAudit(payload) {
      rows.replaceChildren();
      if (!payload || !payload.run) {
        return;
      }

      const selectedTopic = topicFilter.value || "All";
      const articles = Array.isArray(payload.articles) ? payload.articles : [];
      const selectedFreshness = freshnessFilter.value || "All";
      const visibleArticles = articles
        .filter((item) => {
          const topicMatches =
            selectedTopic === "All" ||
            (item.classification?.topic || "None") === selectedTopic;
          const freshnessMatches =
            selectedFreshness === "All" ||
            (selectedFreshness === "Fresh" && item.isFresh) ||
            (selectedFreshness === "Stale" && !item.isFresh);
          return topicMatches && freshnessMatches;
        })
        .sort((left, right) => {
          const dateDiff = publishedMs(right) - publishedMs(left);
          if (dateDiff !== 0) return dateDiff;
          return Number(left.position || 0) - Number(right.position || 0);
        });
      const selectorStats = Array.isArray(payload.run.metadata?.feedSelectorStats)
        ? payload.run.metadata.feedSelectorStats
            .map((entry) => entry.topic + ": " + entry.selectedCount + "/" + entry.candidateCount)
            .join(", ")
        : "";
      projection.textContent = buildFreshnessProjection(payload, articles);
      summary.textContent = [
        "Run " + payload.run.id,
        "created " + payload.run.createdAt,
        "fetched " + payload.run.fetchedCount,
        "audited " + payload.run.auditedCount,
        "eligible " + payload.run.eligibleCount,
        "selected " + payload.run.selectedCount,
        "showing " + visibleArticles.length + "/" + articles.length,
        selectedTopic !== "All" ? "filter " + selectedTopic : "",
        selectedFreshness !== "All" ? "freshness " + selectedFreshness : "",
        "method " + payload.run.classifierMethod,
        "model " + payload.run.classifierModel,
        selectorStats ? "selector " + selectorStats : ""
      ].filter(Boolean).join(" | ");

      for (const item of visibleArticles) {
        const tr = document.createElement("tr");
        const status = item.selectedForSnapshot ? "selected" : item.skipReason;
        tr.appendChild(cell(item.position));
        const topicTd = document.createElement("td");
        topicTd.appendChild(pill(item.classification?.topic || "unclassified", item.classification?.topic === "None" ? "bad" : "good"));
        tr.appendChild(topicTd);
        const statusTd = document.createElement("td");
        statusTd.appendChild(pill(status, item.selectedForSnapshot ? "good" : "warn"));
        tr.appendChild(statusTd);
        const selectorStatus = item.metadata?.feedSelectorReason ||
          (item.skipReason === "freshness_gate" ? "freshness gate" :
            item.metadata?.selectorCandidate ? "candidate" : "");
        tr.appendChild(cell(selectorStatus));
        tr.appendChild(cell(item.publishedAt || ""));
        tr.appendChild(cell(item.wordCount));
        tr.appendChild(cell(item.isFresh ? "yes" : "no"));
        tr.appendChild(cell(item.title));
        tr.appendChild(cell(item.lead));
        tr.appendChild(cell(item.classification?.tag || ""));
        rows.appendChild(tr);
      }
    }

    async function updateCurrentFeedStatus(payload) {
      feedStatus.textContent = "";
      if (!payload?.run) {
        return;
      }

      const params = new URLSearchParams();
      params.set("category", payload.run.category || "All");
      if (Number(payload.run.limitCount) > 0) {
        params.set("limit", String(payload.run.limitCount));
      }
      feedStatus.textContent = "Checking current /feed snapshot...";

      try {
        const response = await fetch("/feed?" + params.toString());
        const feed = await response.json();
        if (!response.ok || !feed.ok) {
          throw new Error(feed.error || "Feed request failed");
        }

        const auditSnapshotId = Number(payload.run.snapshotId || 0);
        const feedSnapshotId = Number(feed.snapshotId || 0);
        const matches =
          auditSnapshotId > 0 &&
          feedSnapshotId > 0 &&
          auditSnapshotId === feedSnapshotId;
        feedStatus.textContent = [
          "audit snapshot " + (auditSnapshotId || "none"),
          "current /feed snapshot " + (feedSnapshotId || "none"),
          "feed date " + (feed.snapshotDate || "unknown"),
          "feed count " + (feed.count ?? "unknown"),
          matches ? "matches app feed" : "does not match app feed"
        ].join(" | ");
      } catch (err) {
        feedStatus.textContent =
          "Could not compare current /feed snapshot: " +
          (err instanceof Error ? err.message : String(err));
      }
    }

    topicFilter.addEventListener("change", () => {
      window.sessionStorage.setItem("topicAuditTopicFilter", topicFilter.value || "All");
      if (lastPayload) {
        renderAudit(lastPayload);
      }
    });

    freshnessFilter.addEventListener("change", () => {
      window.sessionStorage.setItem("topicAuditFreshnessFilter", freshnessFilter.value || "All");
      if (lastPayload) {
        renderAudit(lastPayload);
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      rows.replaceChildren();
      summary.textContent = "Loading audit...";
      projection.textContent = "";
      feedStatus.textContent = "";
      error.textContent = "";

      const token = tokenInput.value.trim();
      window.sessionStorage.setItem("topicAuditAdminToken", token);
      const runId = document.getElementById("runId").value.trim();
      const url = runId
        ? "/admin/topic-audit/runs/" + encodeURIComponent(runId)
        : "/admin/topic-audit/runs/current";

      try {
        const response = await fetch(url, {
          headers: { "x-admin-token": token }
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Audit request failed");
        }
        if (!payload.run) {
          summary.textContent = "No saved topic audit runs yet. Trigger a feed rebuild first.";
          projection.textContent = "";
          feedStatus.textContent = "";
          return;
        }

        lastPayload = payload;
        renderAudit(payload);
        await updateCurrentFeedStatus(payload);
      } catch (err) {
        summary.textContent = "";
        projection.textContent = "";
        feedStatus.textContent = "";
        error.textContent = err instanceof Error ? err.message : String(err);
      }
    });
  </script>
</body>
</html>`);
});

app.get("/admin/topic-audit/runs", async (req, res) => {
  if (!isAdminRequestAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized admin request."
    });
  }
  const limitRaw = Number(req.query.limit ?? 20);
  const runs = await listTopicAuditRuns(limitRaw);
  return res.json({
    ok: true,
    runs
  });
});

app.get("/admin/topic-audit/runs/latest", async (req, res) => {
  if (!isAdminRequestAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized admin request."
    });
  }
  const run = await getLatestTopicAuditRun();
  const articles = run ? await listTopicAuditItems(run.id) : [];
  return res.json({
    ok: true,
    run,
    articles
  });
});

app.get("/admin/topic-audit/runs/current", async (req, res) => {
  if (!isAdminRequestAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized admin request."
    });
  }

  const category = normalizeRequestedCategory(req.query.category);
  const defaultLimit = resolveDefaultFeedLimit(category);
  const limitRaw = Number(req.query.limit ?? defaultLimit);
  const limitCount = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(50, Math.round(limitRaw)))
    : defaultLimit;
  const provider = "newsapi_ai";
  const currentSnapshot = await getCurrentPublishedSnapshot({
    category,
    limitCount,
    provider
  });
  const run = currentSnapshot
    ? await getTopicAuditRunBySnapshotId(currentSnapshot.snapshotId)
    : null;
  const articles = run ? await listTopicAuditItems(run.id) : [];

  return res.json({
    ok: true,
    run,
    articles,
    currentSnapshot: currentSnapshot
      ? {
          snapshotId: currentSnapshot.snapshotId,
          snapshotDate: currentSnapshot.snapshotDate,
          status: currentSnapshot.status,
          count: Array.isArray(currentSnapshot.articles)
            ? currentSnapshot.articles.length
            : 0
        }
      : null
  });
});

app.get("/admin/topic-audit/runs/current/export-originals", async (req, res) => {
  if (!isAdminRequestAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized admin request."
    });
  }

  const category = normalizeRequestedCategory(req.query.category);
  const defaultLimit = resolveDefaultFeedLimit(category);
  const limitRaw = Number(req.query.limit ?? defaultLimit);
  const limitCount = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(50, Math.round(limitRaw)))
    : defaultLimit;
  const provider = "newsapi_ai";
  const currentSnapshot = await getCurrentPublishedSnapshot({
    category,
    limitCount,
    provider
  });
  const run = currentSnapshot
    ? await getTopicAuditRunBySnapshotId(currentSnapshot.snapshotId)
    : null;
  const articles = run ? await listTopicAuditItems(run.id) : [];
  const includeWordCountItems = String(req.query.includeWordCount || "") === "1";

  return res.json(
    buildTopicAuditOriginalsExport({
      run,
      articles,
      includeWordCountItems,
      currentSnapshot: currentSnapshot
        ? {
            snapshotId: currentSnapshot.snapshotId,
            snapshotDate: currentSnapshot.snapshotDate,
            status: currentSnapshot.status,
            count: Array.isArray(currentSnapshot.articles)
              ? currentSnapshot.articles.length
              : 0
          }
        : null
    })
  );
});

app.get("/admin/topic-audit/runs/:runId/export-originals", async (req, res) => {
  if (!isAdminRequestAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized admin request."
    });
  }
  const run = await getTopicAuditRunById(req.params.runId);
  if (!run) {
    return res.status(404).json({
      ok: false,
      error: "Topic audit run not found."
    });
  }
  const articles = await listTopicAuditItems(run.id);
  const includeWordCountItems = String(req.query.includeWordCount || "") === "1";
  return res.json(
    buildTopicAuditOriginalsExport({
      run,
      articles,
      includeWordCountItems
    })
  );
});

app.get("/admin/topic-audit/runs/:runId", async (req, res) => {
  if (!isAdminRequestAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized admin request."
    });
  }
  const run = await getTopicAuditRunById(req.params.runId);
  if (!run) {
    return res.status(404).json({
      ok: false,
      error: "Topic audit run not found."
    });
  }
  const articles = await listTopicAuditItems(run.id);
  return res.json({
    ok: true,
    run,
    articles
  });
});

app.get("/admin/topic-audit/data", async (req, res) => {
  if (!isAdminRequestAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized admin request."
    });
  }

  const limitRaw = Number(req.query.limit ?? 60);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(100, Math.round(limitRaw)))
    : 60;
  const pageRaw = Number(req.query.page ?? 1);
  const page = Number.isFinite(pageRaw)
    ? Math.max(1, Math.min(20, Math.round(pageRaw)))
    : 1;
  const provider = "newsapi_ai";
  const now = Date.now();
  const requestedTopicTargets = resolveRequestedTopicTargets("All");

  try {
    const result = await fetchNewsApiArticles({
      apiKey: NEWSAPI_AI_KEY,
      category: "All",
      limit,
      page,
      sourceUri: NEWSAPI_AI_SOURCE_URI,
      sourceKeyword: NEWSAPI_AI_SOURCE_URI ? "" : NEWSAPI_AI_SOURCE_KEYWORD
    });
    const rawArticles = Array.isArray(result?.articles) ? result.articles : [];
    const seenArticleKeys = new Set();
    const articles = [];
    for (const article of rawArticles) {
      const dedupeKey =
        typeof article?.id === "string" && article.id.length > 0
          ? article.id
          : `${article?.title || ""}::${article?.publishedAt || ""}`;
      if (seenArticleKeys.has(dedupeKey)) {
        continue;
      }
      seenArticleKeys.add(dedupeKey);
      articles.push(article);
    }

    const lengthOkArticles = articles.filter((article) => isWithinArticleWordBounds(article));
    const classifications = await classifyArticlesMetadataBatch(lengthOkArticles);
    const classificationByKey = new Map();
    lengthOkArticles.forEach((article, index) => {
      const key =
        typeof article?.id === "string" && article.id.length > 0
          ? article.id
          : `${article?.title || ""}::${article?.publishedAt || ""}`;
      classificationByKey.set(key, classifications[index] || { topic: TOPIC_NONE });
    });

    const auditedArticles = articles.map((article, index) => {
      const key =
        typeof article?.id === "string" && article.id.length > 0
          ? article.id
          : `${article?.title || ""}::${article?.publishedAt || ""}`;
      const wordCount = countArticleWords(article);
      const lengthOk = wordCount >= FEED_MIN_WORDS && wordCount <= FEED_MAX_WORDS;
      const classification = lengthOk
        ? classificationByKey.get(key) || { topic: TOPIC_NONE, tag: null }
        : null;
      const topic = classification?.topic || TOPIC_NONE;
      const inTargetTopic =
        topic !== TOPIC_NONE &&
        requestedTopicTargets.includes(topic);
      const eligibleForFeed = lengthOk && inTargetTopic;
      let skipReason = "";
      if (!lengthOk) {
        skipReason = "word_count";
      } else if (topic === TOPIC_NONE) {
        skipReason = "topic_none";
      } else if (!inTargetTopic) {
        skipReason = "out_of_target";
      }

      return {
        position: index + 1,
        id: article.id ?? null,
        title: article.title ?? "",
        lead: article.lead ?? "",
        publishedAt: article.publishedAt ?? null,
        wordCount,
        lengthOk,
        isFresh: isFreshEnoughArticle(article, now),
        classification,
        eligibleForFeed,
        skipReason
      };
    });

    return res.json({
      ok: true,
      provider,
      sourceUri: result?.sourceUri || NEWSAPI_AI_SOURCE_URI || null,
      requestedAt: new Date().toISOString(),
      page,
      limit,
      fetchedCount: articles.length,
      auditedCount: lengthOkArticles.length,
      eligibleCount: auditedArticles.filter((article) => article.eligibleForFeed).length,
      topicTargets: requestedTopicTargets,
      topicClassifierMethod: TOPIC_CLASSIFIER_METHOD,
      topicClassifierModel: TOPIC_CLASSIFIER_MODEL,
      topicClassifierBatchSize: TOPIC_CLASSIFIER_BATCH_SIZE,
      wordBounds: {
        min: FEED_MIN_WORDS,
        max: FEED_MAX_WORDS
      },
      freshArticleMaxAgeHours: FEED_FRESH_ARTICLE_MAX_AGE_HOURS,
      articles: auditedArticles
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Topic audit failed."
    });
  }
});

app.get("/feed", async (req, res) => {
  const category = normalizeRequestedCategory(req.query.category);
  const debugRequested = String(req.query.debug || "") === "1";
  const auditBodyRequested = String(req.query.auditBody || "") === "1";
  if (auditBodyRequested && !isAdminRequestAuthorized(req)) {
    return res.status(401).json({
      ok: false,
      error: "auditBody=1 requires an authorized admin request."
    });
  }
  const requestedTopicTargets = resolveRequestedTopicTargets(category);
  const rawLimitParam = req.query.limit;
  const hasExplicitLimit =
    rawLimitParam != null && String(rawLimitParam).trim().length > 0;
  const isTopicBalancedRequest =
    category === "All" &&
    Array.isArray(requestedTopicTargets) &&
    requestedTopicTargets.length > 1;
  const balancedLimit = isTopicBalancedRequest
    ? FEED_PER_TOPIC_TARGET * requestedTopicTargets.length
    : FEED_PER_TOPIC_TARGET;
  const defaultLimit = resolveDefaultFeedLimit(category);
  const limitRaw = Number(hasExplicitLimit ? rawLimitParam : defaultLimit);
  const requestedLimit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(50, Math.round(limitRaw)))
    : FEED_PER_TOPIC_TARGET;
  const limit = isTopicBalancedRequest ? balancedLimit : requestedLimit;
  const perTopicTarget = isTopicBalancedRequest ? FEED_PER_TOPIC_TARGET : 1;
  const refreshRequested = String(req.query.refresh || "") === "1";
  const rebuildRequested = String(req.query.rebuild || "") === "1";
  const cacheKey = `${category}::${limit}`;
  const provider = "newsapi_ai";
  const snapshotDate = utcDayStamp();
  const now = Date.now();
  const currentPublishedSnapshot = await getCurrentPublishedSnapshot({
    category,
    limitCount: limit,
    provider
  });
  const cached = feedCache.get(cacheKey);
  const publishedSnapshotId = Number(currentPublishedSnapshot?.snapshotId || 0);
  const cachedSnapshotId = Number(cached?.snapshotId || 0);
  const isCachedForPublishedSnapshot =
    Number.isFinite(publishedSnapshotId) &&
    publishedSnapshotId > 0 &&
    cachedSnapshotId === publishedSnapshotId;

  if (
    !refreshRequested &&
    cached &&
    isCachedForPublishedSnapshot &&
    cached.expiresAt > now &&
    Array.isArray(cached.articles) &&
    cached.articles.length > 0
  ) {
    const countsByTopic = buildCountsByTopic(cached.articles, requestedTopicTargets);
    const isComplete = isTopicBalancedRequest
      ? evaluateTopicCompleteness(
          requestedTopicTargets,
          countsByTopic,
          perTopicTarget
        )
      : null;
    return res.json({
      ok: true,
      provider,
      category,
      snapshotId:
        Number.isFinite(Number(cached.snapshotId)) && Number(cached.snapshotId) > 0
          ? Number(cached.snapshotId)
          : null,
      count: cached.articles.length,
      categories: cached.categories,
      articles: cached.articles,
      cached: true,
      snapshotDate:
        typeof cached.snapshotDate === "string" ? cached.snapshotDate : snapshotDate,
      topicTargets: requestedTopicTargets,
      perTopicTarget,
      countsByTopic,
      isComplete,
      cacheTtlMs: FEED_CACHE_TTL_MS
    });
  }

  if (
    !refreshRequested &&
    currentPublishedSnapshot &&
    Array.isArray(currentPublishedSnapshot.articles) &&
    currentPublishedSnapshot.articles.length > 0
  ) {
    const countsByTopic = buildCountsByTopic(
      currentPublishedSnapshot.articles,
      requestedTopicTargets
    );
    const isComplete = isTopicBalancedRequest
      ? evaluateTopicCompleteness(
          requestedTopicTargets,
          countsByTopic,
          perTopicTarget
        )
      : null;
    feedCache.set(cacheKey, {
      articles: currentPublishedSnapshot.articles,
      categories: currentPublishedSnapshot.categories,
      snapshotId: currentPublishedSnapshot.snapshotId,
      snapshotDate: currentPublishedSnapshot.snapshotDate,
      expiresAt: now + FEED_CACHE_TTL_MS
    });
    return res.json({
      ok: true,
      provider,
      category,
      snapshotId: currentPublishedSnapshot.snapshotId,
      count: currentPublishedSnapshot.articles.length,
      categories: currentPublishedSnapshot.categories,
      articles: currentPublishedSnapshot.articles,
      cached: true,
      snapshotDate: currentPublishedSnapshot.snapshotDate,
      topicTargets: requestedTopicTargets,
      perTopicTarget,
      countsByTopic,
      isComplete,
      cacheTtlMs: FEED_CACHE_TTL_MS
    });
  }

  if (!refreshRequested && !currentPublishedSnapshot) {
    const fallbackReadySnapshot = await getLatestReadySnapshotForFeed({
      category,
      limitCount: limit,
      provider
    });
    if (
      fallbackReadySnapshot &&
      Array.isArray(fallbackReadySnapshot.articles) &&
      fallbackReadySnapshot.articles.length > 0
    ) {
      await upsertCurrentSnapshot({
        category,
        limitCount: limit,
        provider,
        snapshotId: fallbackReadySnapshot.snapshotId
      });
      const countsByTopic = buildCountsByTopic(
        fallbackReadySnapshot.articles,
        requestedTopicTargets
      );
      const isComplete = isTopicBalancedRequest
        ? evaluateTopicCompleteness(
            requestedTopicTargets,
            countsByTopic,
            perTopicTarget
          )
        : null;
      feedCache.set(cacheKey, {
        articles: fallbackReadySnapshot.articles,
        categories: fallbackReadySnapshot.categories,
        snapshotId: fallbackReadySnapshot.snapshotId,
        snapshotDate: fallbackReadySnapshot.snapshotDate,
        expiresAt: now + FEED_CACHE_TTL_MS
      });
      return res.json({
        ok: true,
        provider,
        category,
        snapshotId: fallbackReadySnapshot.snapshotId,
        count: fallbackReadySnapshot.articles.length,
        categories: fallbackReadySnapshot.categories,
        articles: fallbackReadySnapshot.articles,
        cached: true,
        snapshotDate: fallbackReadySnapshot.snapshotDate,
        topicTargets: requestedTopicTargets,
        perTopicTarget,
        countsByTopic,
        isComplete,
        cacheTtlMs: FEED_CACHE_TTL_MS
      });
    }
  }

  if (refreshRequested && !rebuildRequested) {
    const existingTodaySnapshotRow = await findSnapshotRecordByDate({
      snapshotDate,
      category,
      limitCount: limit,
      provider
    });
    if (
      existingTodaySnapshotRow &&
      String(existingTodaySnapshotRow.status || "") === SNAPSHOT_STATUS_READY
    ) {
      const existingTodaySnapshot = await getSnapshotById(
        Number(existingTodaySnapshotRow.snapshot_id)
      );
      if (
        existingTodaySnapshot &&
        Array.isArray(existingTodaySnapshot.articles) &&
        existingTodaySnapshot.articles.length > 0
      ) {
        await upsertCurrentSnapshot({
          category,
          limitCount: limit,
          provider,
          snapshotId: existingTodaySnapshot.snapshotId
        });
        const countsByTopic = buildCountsByTopic(
          existingTodaySnapshot.articles,
          requestedTopicTargets
        );
        const isComplete = isTopicBalancedRequest
          ? evaluateTopicCompleteness(
              requestedTopicTargets,
              countsByTopic,
              perTopicTarget
            )
          : null;
        feedCache.set(cacheKey, {
          articles: existingTodaySnapshot.articles,
          categories: existingTodaySnapshot.categories,
          snapshotId: existingTodaySnapshot.snapshotId,
          snapshotDate: existingTodaySnapshot.snapshotDate,
          expiresAt: now + FEED_CACHE_TTL_MS
        });
        return res.json({
          ok: true,
          provider,
          category,
          snapshotId: existingTodaySnapshot.snapshotId,
          count: existingTodaySnapshot.articles.length,
          categories: existingTodaySnapshot.categories,
          articles: existingTodaySnapshot.articles,
          cached: true,
          snapshotDate: existingTodaySnapshot.snapshotDate,
          toneRewriteQueued: false,
          refreshRequested: true,
          rebuildRequested: false,
          alreadyReady: true,
          topicTargets: requestedTopicTargets,
          perTopicTarget,
          countsByTopic,
          isComplete,
          cacheTtlMs: FEED_CACHE_TTL_MS
        });
      }
    }
  }

  try {
    const isBalancedAllRequest = isTopicBalancedRequest;
    const fetchTargetCount = isBalancedAllRequest
      ? FEED_PER_TOPIC_TARGET * requestedTopicTargets.length
      : limit;
    const fetchCount = Math.min(
      FEED_FETCH_PAGE_LIMIT_MAX,
      Math.max(fetchTargetCount * FEED_FETCH_MULTIPLIER, FEED_FETCH_MIN)
    );
    const maxPages = isBalancedAllRequest ? FEED_FETCH_MAX_PAGES : 1;
    let sourceUriUsed = null;
    let fetchedCount = 0;
    let pagesFetched = 0;
    let classifiedAccepted = 0;
    let skippedLength = 0;
    let skippedNone = 0;
    let skippedOutOfTarget = 0;
    let freshSelectedCount = 0;
    let staleFallbackSelectedCount = 0;
    const feedSelectorStats = [];
    const feedSelectorInputKeys = new Set();
    const selectedArticles = [];
    const seenArticleKeys = new Set();
    const topicAuditItems = [];
    const providerRanksByArticleKey = new Map();
    let providerRank = 0;
    const topicBuckets = new Map();
    const staleFallbackBuckets = new Map();
    if (isBalancedAllRequest) {
      for (const topic of requestedTopicTargets) {
        topicBuckets.set(topic, []);
        staleFallbackBuckets.set(topic, []);
      }
    }

    const hasReachedTarget = () => {
      if (isBalancedAllRequest) {
        return requestedTopicTargets.every((topic) => {
          const freshEntries = topicBuckets.get(topic);
          const staleEntries = staleFallbackBuckets.get(topic);
          const count =
            (Array.isArray(freshEntries) ? freshEntries.length : 0) +
            (Array.isArray(staleEntries) ? staleEntries.length : 0);
          return count >= FEED_SELECTOR_CANDIDATES_PER_TOPIC;
        });
      }
      return selectedArticles.length >= limit;
    };

    const staleFallbackArticles = [];
    const shouldUseTopicPagedFetch =
      Array.isArray(requestedTopicTargets) && requestedTopicTargets.length > 0;
    const retrievalMaxPages = shouldUseTopicPagedFetch ? FEED_FETCH_MAX_PAGES : maxPages;

    for (let page = 1; page <= retrievalMaxPages; page += 1) {
      const result = await fetchNewsApiArticles({
        apiKey: NEWSAPI_AI_KEY,
        category: "All",
        limit: fetchCount,
        page,
        sourceUri: NEWSAPI_AI_SOURCE_URI,
        sourceKeyword: NEWSAPI_AI_SOURCE_URI ? "" : NEWSAPI_AI_SOURCE_KEYWORD
      });
      if (!sourceUriUsed && result?.sourceUri) {
        sourceUriUsed = result.sourceUri;
      }
      const pageArticlesRaw = Array.isArray(result?.articles) ? result.articles : [];
      pagesFetched += 1;
      if (pageArticlesRaw.length === 0) {
        break;
      }

      const pageArticles = [];
      for (const candidate of pageArticlesRaw) {
        const dedupeKey = articleAuditKey(candidate);
        if (seenArticleKeys.has(dedupeKey)) {
          continue;
        }
        seenArticleKeys.add(dedupeKey);
        providerRank += 1;
        providerRanksByArticleKey.set(dedupeKey, providerRank);
        pageArticles.push(candidate);
      }
      fetchedCount += pageArticles.length;

      const candidateArticles = [];
      for (const candidate of pageArticles) {
        if (!isWithinArticleWordBounds(candidate)) {
          skippedLength += 1;
          topicAuditItems.push({
            auditKey: articleAuditKey(candidate),
            providerRank:
              providerRanksByArticleKey.get(articleAuditKey(candidate)) || 0,
            articleId: candidate.id ?? null,
            title: candidate.title ?? "",
            lead: candidate.lead ?? null,
            publishedAt: candidate.publishedAt ?? null,
            wordCount: countArticleWords(candidate),
            lengthOk: false,
            isFresh: isFreshEnoughArticle(candidate, now),
            classifiedTopic: null,
            topicTag: null,
            eligibleForFeed: false,
            selectedForSnapshot: false,
            skipReason: "word_count",
            classifierStatus: "skipped_length",
            fallbackUsed: false,
            metadata: {}
          });
          continue;
        }
        candidateArticles.push(candidate);
      }

      for (
        let start = 0;
        start < candidateArticles.length;
        start += TOPIC_CLASSIFIER_BATCH_SIZE
      ) {
        const candidateBatch = candidateArticles.slice(
          start,
          start + TOPIC_CLASSIFIER_BATCH_SIZE
        );
        const classifications = await classifyArticlesMetadataBatch(candidateBatch);

        for (let index = 0; index < candidateBatch.length; index += 1) {
          const candidate = candidateBatch[index];
          const classification = classifications[index] || { topic: TOPIC_NONE };
          const topic = classification.topic;
          const candidateAuditKey = articleAuditKey(candidate);
          const inTargetTopic =
            topic !== TOPIC_NONE &&
            (!Array.isArray(requestedTopicTargets) ||
              requestedTopicTargets.length === 0 ||
              requestedTopicTargets.includes(topic));
          const auditItem = {
            auditKey: candidateAuditKey,
            providerRank:
              providerRanksByArticleKey.get(candidateAuditKey) || 0,
            articleId: candidate.id ?? null,
            title: candidate.title ?? "",
            lead: candidate.lead ?? null,
            publishedAt: candidate.publishedAt ?? null,
            wordCount: countArticleWords(candidate),
            lengthOk: true,
            isFresh: isFreshEnoughArticle(candidate, now),
            classifiedTopic: topic,
            topicTag: classification.tag ?? null,
            eligibleForFeed: inTargetTopic,
            selectedForSnapshot: false,
            skipReason:
              topic === TOPIC_NONE
                ? "topic_none"
                : inTargetTopic
                  ? ""
                  : "out_of_target",
            classifierStatus: "classified",
            fallbackUsed: false,
            metadata: buildTopicAuditItemMetadata(candidate, {
              includeOriginalArticle: auditBodyRequested
            })
          };
          topicAuditItems.push(auditItem);
          if (topic === TOPIC_NONE) {
            skippedNone += 1;
            continue;
          }
          if (
            Array.isArray(requestedTopicTargets) &&
            requestedTopicTargets.length > 0 &&
            !requestedTopicTargets.includes(topic)
          ) {
            skippedOutOfTarget += 1;
            continue;
          }

          classifiedAccepted += 1;
          const mappedArticle = {
            ...candidate,
            category: topic,
            topicLabel: topic,
            topicTag: classification.tag ?? null
          };

          if (isBalancedAllRequest) {
            const bucket = topicBuckets.get(topic);
            const staleBucket = staleFallbackBuckets.get(topic);
            const currentCandidateCount =
              (Array.isArray(bucket) ? bucket.length : 0) +
              (Array.isArray(staleBucket) ? staleBucket.length : 0);
            if (currentCandidateCount < FEED_SELECTOR_CANDIDATES_PER_TOPIC) {
              mappedArticle.providerRank =
                providerRanksByArticleKey.get(candidateAuditKey) || 0;
              mappedArticle.isFresh = isFreshEnoughArticle(mappedArticle, now);
              auditItem.metadata.selectorCandidate = true;
              if (mappedArticle.isFresh && Array.isArray(bucket)) {
                bucket.push(mappedArticle);
              } else if (Array.isArray(staleBucket)) {
                staleBucket.push(mappedArticle);
              }
            } else {
              auditItem.metadata.selectorCandidate = false;
              auditItem.skipReason = "candidate_pool_full";
            }
          } else if (isFreshEnoughArticle(mappedArticle, now)) {
            selectedArticles.push(mappedArticle);
            freshSelectedCount += 1;
          } else {
            staleFallbackArticles.push(mappedArticle);
          }

          if (hasReachedTarget()) {
            break;
          }
        }

        if (hasReachedTarget()) {
          break;
        }
      }

      if (hasReachedTarget()) {
        break;
      }
    }

    if (isBalancedAllRequest) {
      for (const topic of requestedTopicTargets) {
        const freshBucket = topicBuckets.get(topic);
        const staleBucket = staleFallbackBuckets.get(topic);
        const candidates = [
          ...(Array.isArray(freshBucket) ? freshBucket : []),
          ...(Array.isArray(staleBucket) ? staleBucket : [])
        ].sort((left, right) => {
          const leftRank = Number(left.providerRank || Number.MAX_SAFE_INTEGER);
          const rightRank = Number(right.providerRank || Number.MAX_SAFE_INTEGER);
          return leftRank - rightRank;
        });
        const freshCandidates = candidates.filter((article) =>
          isFreshEnoughArticle(article, now)
        );
        const useFreshOnlyCandidates =
          FEED_SELECTOR_FRESH_ONLY &&
          freshCandidates.length >= FEED_PER_TOPIC_TARGET;
        const selectorCandidates = useFreshOnlyCandidates
          ? freshCandidates
          : candidates;
        selectorCandidates.forEach((article) => {
          feedSelectorInputKeys.add(articleAuditKey(article));
        });
        const selection = await selectFeedArticlesForTopic({
          topic,
          articles: selectorCandidates,
          targetCount: FEED_PER_TOPIC_TARGET,
          nowMs: now
        });
        feedSelectorStats.push({
          topic,
          method: selection.method,
          model: selection.model,
          fallbackUsed: Boolean(selection.fallbackUsed),
          error: selection.error || null,
          candidateCount: candidates.length,
          selectorInputCount: selectorCandidates.length,
          freshCandidateCount: freshCandidates.length,
          staleCandidateCount: candidates.length - freshCandidates.length,
          freshOnlyApplied: useFreshOnlyCandidates,
          freshOnlyBypassed:
            FEED_SELECTOR_FRESH_ONLY && !useFreshOnlyCandidates,
          selectedCount: selection.selected.length
        });

        for (const selected of selection.selected) {
          const article = selected?.candidate?.article;
          if (!article) {
            continue;
          }
          article.feedSelectorReason =
            selected.reason || "selected by feed selector";
          selectedArticles.push(article);
          if (isFreshEnoughArticle(article, now)) {
            freshSelectedCount += 1;
          } else {
            staleFallbackSelectedCount += 1;
          }
        }
      }
    } else {
      while (selectedArticles.length < limit && staleFallbackArticles.length > 0) {
        const nextFallback = staleFallbackArticles.shift();
        if (!nextFallback) {
          break;
        }
        selectedArticles.push(nextFallback);
        staleFallbackSelectedCount += 1;
      }
    }

    const selectedArticleKeys = new Set(selectedArticles.map((article) => articleAuditKey(article)));
    const selectedArticleReasons = new Map(
      selectedArticles.map((article) => [
        articleAuditKey(article),
        article.feedSelectorReason || null
      ])
    );
    for (const item of topicAuditItems) {
      if (selectedArticleKeys.has(item.auditKey)) {
        item.selectedForSnapshot = true;
        item.skipReason = "selected";
        const reason = selectedArticleReasons.get(item.auditKey);
        if (reason) {
          item.metadata.feedSelectorReason = reason;
        }
      } else if (item.eligibleForFeed && item.metadata.selectorCandidate === false) {
        item.skipReason = "candidate_pool_full";
      } else if (
        item.eligibleForFeed &&
        item.metadata.selectorCandidate &&
        !feedSelectorInputKeys.has(item.auditKey)
      ) {
        item.skipReason = "freshness_gate";
      } else if (item.eligibleForFeed && !item.skipReason) {
        item.skipReason = isBalancedAllRequest
          ? "feed_selector_rejected"
          : item.isFresh
            ? "topic_bucket_full"
            : "stale_fallback_not_needed";
      }
    }

    const articles = selectedArticles.map((article) => {
      const {
        feedSelectorReason: _feedSelectorReason,
        isFresh: _isFresh,
        providerRank: _providerRank,
        ...publicArticle
      } = article;
      return {
        ...publicArticle,
        variants: buildVariants(publicArticle),
        variantMethods: buildRuleVariantMethods()
      };
    });

    articles.forEach((article) => {
      articleCache.set(article.id, article);
    });

    const categories = Array.from(
      new Set(
        articles
          .map((article) => article.category)
          .filter((value) => typeof value === "string" && value.length > 0)
      )
    );
    const countsByTopic = buildCountsByTopic(articles, requestedTopicTargets);
    const isComplete = isTopicBalancedRequest
      ? evaluateTopicCompleteness(
          requestedTopicTargets,
          countsByTopic,
          perTopicTarget
        )
      : null;
    if (articles.length > 0) {
      const saveResult = await saveDailySnapshot({
        snapshotDate,
        category,
        limitCount: limit,
        provider,
        articles
      });
      const auditResult = await saveTopicClassificationAuditRunBestEffort({
        snapshotDate,
        category,
        limitCount: limit,
        provider,
        sourceUri: sourceUriUsed || NEWSAPI_AI_SOURCE_URI || null,
        classifierMethod: TOPIC_CLASSIFIER_METHOD,
        classifierModel: TOPIC_CLASSIFIER_MODEL,
        classifierBatchSize: TOPIC_CLASSIFIER_BATCH_SIZE,
        feedPerTopicTarget: FEED_PER_TOPIC_TARGET,
        freshArticleMaxAgeHours: FEED_FRESH_ARTICLE_MAX_AGE_HOURS,
        pagesFetched,
        fetchedCount,
        auditedCount: topicAuditItems.length,
        eligibleCount: topicAuditItems.filter((item) => item.eligibleForFeed).length,
        selectedCount: articles.length,
        snapshotId: saveResult.snapshotId,
        status: "completed",
        metadata: {
          topicTargets: requestedTopicTargets,
          perTopicTarget,
          fetchCountPerPage: fetchCount,
          skippedLength,
          skippedNone,
          skippedOutOfTarget,
          freshSelectedCount,
          staleFallbackSelectedCount,
          auditBodyIncluded: auditBodyRequested,
          feedSelectorStats
        },
        items: topicAuditItems
      });
      let toneRewriteQueued = false;
      let rewriteStats = null;
      if (isToneLlmEnabled()) {
        if (FEED_WAIT_FOR_REWRITE) {
          rewriteStats = await rewriteSnapshotToneVariants({
            snapshotId: saveResult.snapshotId,
            snapshotDate,
            category,
            limitCount: limit,
            provider
          });
        } else {
          toneRewriteQueued = queueToneRewriteForSnapshot({
            snapshotId: saveResult.snapshotId,
            snapshotDate,
            category,
            limitCount: limit,
            provider
          });
        }
      } else {
        const readyAt = new Date().toISOString();
        await updateSnapshotLifecycle({
          snapshotId: saveResult.snapshotId,
          status: SNAPSHOT_STATUS_READY,
          startedAt: null,
          completedAt: readyAt,
          publishedAt: readyAt,
          errorMessage: null
        });
        await upsertCurrentSnapshot({
          category,
          limitCount: limit,
          provider,
          snapshotId: saveResult.snapshotId
        });
      }

      const builtSnapshot = await getSnapshotById(saveResult.snapshotId);
      const publishedSnapshot = await getCurrentPublishedSnapshot({
        category,
        limitCount: limit,
        provider
      });
      const responseSnapshot =
        publishedSnapshot && Array.isArray(publishedSnapshot.articles)
          ? publishedSnapshot
          : builtSnapshot && Array.isArray(builtSnapshot.articles)
            ? builtSnapshot
            : null;
      const responseArticles = responseSnapshot?.articles || articles;
      const responseCategories = responseSnapshot?.categories || categories;
      const responseCountsByTopic = buildCountsByTopic(
        responseArticles,
        requestedTopicTargets
      );
      const responseIsComplete = isTopicBalancedRequest
        ? evaluateTopicCompleteness(
            requestedTopicTargets,
            responseCountsByTopic,
            perTopicTarget
          )
        : null;
      if (
        responseSnapshot &&
        responseSnapshot.status === SNAPSHOT_STATUS_READY &&
        Number.isFinite(Number(responseSnapshot.snapshotId)) &&
        Number(responseSnapshot.snapshotId) > 0
      ) {
        feedCache.set(cacheKey, {
          articles: responseArticles,
          categories: responseCategories,
          snapshotId: responseSnapshot.snapshotId,
          snapshotDate: responseSnapshot.snapshotDate,
          expiresAt: now + FEED_CACHE_TTL_MS
        });
      }

      return res.json({
        ok: true,
        provider,
        category,
        snapshotId:
          responseSnapshot &&
          Number.isFinite(Number(responseSnapshot.snapshotId)) &&
          Number(responseSnapshot.snapshotId) > 0
            ? Number(responseSnapshot.snapshotId)
            : null,
        buildingSnapshotId:
          toneRewriteQueued ||
          (builtSnapshot && builtSnapshot.status !== SNAPSHOT_STATUS_READY)
            ? saveResult.snapshotId
            : null,
        count: responseArticles.length,
        categories: responseCategories,
        articles: responseArticles,
        cached:
          Boolean(responseSnapshot) &&
          Number(responseSnapshot?.snapshotId) !== Number(saveResult.snapshotId),
        snapshotDate: responseSnapshot?.snapshotDate || snapshotDate,
        snapshotStatus: responseSnapshot?.status || SNAPSHOT_STATUS_BUILDING,
        toneRewriteQueued,
        rewriteJobStats: rewriteStats,
        topicAuditRunId: auditResult.auditRunId,
        auditBodyIncluded: auditBodyRequested,
        refreshRequested,
        rebuildRequested,
        freshnessPolicy: "fresh_first_with_stale_fallback",
        freshArticleMaxAgeHours: FEED_FRESH_ARTICLE_MAX_AGE_HOURS,
        freshSelectedCount,
        staleFallbackCount: staleFallbackSelectedCount,
        topicTargets: requestedTopicTargets,
        perTopicTarget,
        countsByTopic: responseCountsByTopic,
        isComplete: responseIsComplete,
        debug: debugRequested
          ? {
              fetchedCount,
              pagesFetched,
              fetchCountPerPage: fetchCount,
              classifiedAccepted,
              skippedLength,
              skippedNone,
              skippedOutOfTarget,
              freshSelectedCount,
              staleFallbackCount: staleFallbackSelectedCount,
              feedSelectorStats
            }
          : undefined,
        sourceUri: sourceUriUsed || null,
        cacheTtlMs: FEED_CACHE_TTL_MS
      });
    }

    const auditResult = await saveTopicClassificationAuditRunBestEffort({
      snapshotDate,
      category,
      limitCount: limit,
      provider,
      sourceUri: sourceUriUsed || NEWSAPI_AI_SOURCE_URI || null,
      classifierMethod: TOPIC_CLASSIFIER_METHOD,
      classifierModel: TOPIC_CLASSIFIER_MODEL,
      classifierBatchSize: TOPIC_CLASSIFIER_BATCH_SIZE,
      feedPerTopicTarget: FEED_PER_TOPIC_TARGET,
      freshArticleMaxAgeHours: FEED_FRESH_ARTICLE_MAX_AGE_HOURS,
      pagesFetched,
      fetchedCount,
      auditedCount: topicAuditItems.length,
      eligibleCount: topicAuditItems.filter((item) => item.eligibleForFeed).length,
      selectedCount: 0,
      snapshotId: null,
      status: "no_selection",
      metadata: {
        topicTargets: requestedTopicTargets,
        perTopicTarget,
        fetchCountPerPage: fetchCount,
        skippedLength,
        skippedNone,
        skippedOutOfTarget,
        freshSelectedCount,
        staleFallbackSelectedCount,
        auditBodyIncluded: auditBodyRequested,
        feedSelectorStats
      },
      items: topicAuditItems
    });

    const fallbackSnapshot =
      currentPublishedSnapshot ||
      (await getLatestReadySnapshotForFeed({
        category,
        provider,
        limitCount: limit
      }));
    if (
      fallbackSnapshot &&
      Array.isArray(fallbackSnapshot.articles) &&
      fallbackSnapshot.articles.length > 0
    ) {
      const fallbackCountsByTopic = buildCountsByTopic(
        fallbackSnapshot.articles,
        requestedTopicTargets
      );
      const fallbackIsComplete = isTopicBalancedRequest
        ? evaluateTopicCompleteness(
            requestedTopicTargets,
            fallbackCountsByTopic,
            perTopicTarget
          )
        : null;
      feedCache.set(cacheKey, {
        articles: fallbackSnapshot.articles,
        categories: fallbackSnapshot.categories,
        snapshotId: fallbackSnapshot.snapshotId,
        snapshotDate: fallbackSnapshot.snapshotDate,
        expiresAt: now + FEED_CACHE_TTL_MS
      });
      return res.json({
        ok: true,
        provider,
        category,
        snapshotId: fallbackSnapshot.snapshotId,
        count: fallbackSnapshot.articles.length,
        categories: fallbackSnapshot.categories,
        articles: fallbackSnapshot.articles,
        cached: true,
        snapshotDate: fallbackSnapshot.snapshotDate,
        refreshRequested,
        fallbackUsed: true,
        topicAuditRunId: auditResult.auditRunId,
        auditBodyIncluded: auditBodyRequested,
        topicTargets: requestedTopicTargets,
        perTopicTarget,
        countsByTopic: fallbackCountsByTopic,
        isComplete: fallbackIsComplete,
        debug: debugRequested
          ? {
              fetchedCount,
              pagesFetched,
              fetchCountPerPage: fetchCount,
              classifiedAccepted,
              skippedLength,
              skippedNone,
              skippedOutOfTarget,
              feedSelectorStats
            }
          : undefined,
        cacheTtlMs: FEED_CACHE_TTL_MS
      });
    }

    const emptyCountsByTopic = buildCountsByTopic([], requestedTopicTargets);
    return res.json({
      ok: true,
      provider,
      category,
      snapshotId: null,
      count: articles.length,
      categories,
      articles,
      cached: false,
      snapshotDate,
      refreshRequested,
      topicAuditRunId: auditResult.auditRunId,
      auditBodyIncluded: auditBodyRequested,
      topicTargets: requestedTopicTargets,
      perTopicTarget,
      countsByTopic: emptyCountsByTopic,
      isComplete: isTopicBalancedRequest ? false : null,
      debug: debugRequested
        ? {
            fetchedCount,
            pagesFetched,
            fetchCountPerPage: fetchCount,
            classifiedAccepted,
            skippedLength,
            skippedNone,
            skippedOutOfTarget,
            feedSelectorStats
          }
        : undefined,
      sourceUri: sourceUriUsed || null,
      cacheTtlMs: FEED_CACHE_TTL_MS
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to fetch feed."
    });
  }
});

app.get("/articles/:id", async (req, res) => {
  const id = req.params.id;
  const snapshotIdRaw = Number(req.query.snapshotId);
  const snapshotId = Number.isFinite(snapshotIdRaw) && snapshotIdRaw > 0
    ? Math.round(snapshotIdRaw)
    : null;
  const snapshotDate =
    typeof req.query.snapshotDate === "string" && req.query.snapshotDate.length > 0
      ? req.query.snapshotDate
      : null;

  let snapshotRow = null;
  if (!POSTGRES_ENABLED) {
    if (snapshotId) {
      snapshotRow = findSnapshotArticleBySnapshotIdStmt.get({
        snapshotId,
        articleId: id
      }) ?? null;
    }
    if (!snapshotRow && snapshotDate) {
      snapshotRow = findSnapshotArticleBySnapshotDateStmt.get({
        snapshotDate,
        articleId: id
      }) ?? null;
    }
    if (!snapshotRow) {
      snapshotRow = findLatestSnapshotArticleByIdStmt.get({
        articleId: id
      }) ?? null;
    }
  } else {
    if (snapshotId) {
      const bySnapshotId = await pgQuery(
        `
          SELECT
            fs.snapshot_id,
            fs.snapshot_date,
            sa.article_id,
            sa.category,
            sa.title,
            sa.topic_label,
            sa.topic_tag,
            sa.lead,
            sa.body_json,
            sa.image,
            sa.source_name,
            sa.source_uri,
            sa.source_article_uri,
            sa.published_at
          FROM snapshot_articles sa
          JOIN feed_snapshots fs ON fs.snapshot_id = sa.snapshot_id
          WHERE sa.snapshot_id = $1
            AND sa.article_id = $2
          LIMIT 1
        `,
        [snapshotId, id]
      );
      snapshotRow = bySnapshotId.rows[0] || null;
    }
    if (!snapshotRow && snapshotDate) {
      const bySnapshotDate = await pgQuery(
        `
          SELECT
            fs.snapshot_id,
            fs.snapshot_date,
            sa.article_id,
            sa.category,
            sa.title,
            sa.topic_label,
            sa.topic_tag,
            sa.lead,
            sa.body_json,
            sa.image,
            sa.source_name,
            sa.source_uri,
            sa.source_article_uri,
            sa.published_at
          FROM snapshot_articles sa
          JOIN feed_snapshots fs ON fs.snapshot_id = sa.snapshot_id
          WHERE fs.snapshot_date = $1
            AND sa.article_id = $2
          ORDER BY fs.created_at DESC
          LIMIT 1
        `,
        [snapshotDate, id]
      );
      snapshotRow = bySnapshotDate.rows[0] || null;
    }
    if (!snapshotRow) {
      const latestByArticle = await pgQuery(
        `
          SELECT
            fs.snapshot_id,
            fs.snapshot_date,
            sa.article_id,
            sa.category,
            sa.title,
            sa.topic_label,
            sa.topic_tag,
            sa.lead,
            sa.body_json,
            sa.image,
            sa.source_name,
            sa.source_uri,
            sa.source_article_uri,
            sa.published_at
          FROM snapshot_articles sa
          JOIN feed_snapshots fs ON fs.snapshot_id = sa.snapshot_id
          WHERE sa.article_id = $1
          ORDER BY fs.snapshot_date DESC, fs.created_at DESC
          LIMIT 1
        `,
        [id]
      );
      snapshotRow = latestByArticle.rows[0] || null;
    }
  }

  if (snapshotRow) {
    const variants = await getVariantsForSnapshotArticle(
      snapshotRow.snapshot_id,
      snapshotRow.article_id
    );

    return res.json({
      ok: true,
      article: {
        ...rowToArticle(snapshotRow),
        variants: variants || buildVariants(rowToArticle(snapshotRow))
      },
      snapshotId: Number(snapshotRow.snapshot_id),
      snapshotDate: snapshotRow.snapshot_date
    });
  }

  const article = articleCache.get(id);
  if (article) {
    return res.json({
      ok: true,
      article: {
        ...article,
        variants: article.variants || buildVariants(article)
      },
      snapshotId: null,
      snapshotDate: null
    });
  }

  const row = !POSTGRES_ENABLED
    ? findArticleByIdStmt.get({ articleId: id })
    : (
        await pgQuery(
          `
            SELECT
              article_id,
              category,
              title,
              topic_label,
              topic_tag,
              published_minutes_ago,
              lead,
              body_json,
              image,
              source_name,
              source_uri,
              source_article_uri,
              published_at,
              metadata_json
            FROM articles
            WHERE article_id = $1
            LIMIT 1
          `,
          [id]
        )
      ).rows[0];
  if (row) {
    const parsedArticle = rowToArticle(row);
    return res.json({
      ok: true,
      article: {
        ...parsedArticle,
        variants: buildVariants(parsedArticle)
      },
      snapshotId: null,
      snapshotDate: null
    });
  }

  return res.status(404).json({
    ok: false,
    error:
      "Article not found. Request /feed first for this day/category, or verify article id."
  });
});

app.get("/feed/snapshot/today", async (req, res) => {
  const category = normalizeRequestedCategory(req.query.category);
  const limitRaw = Number(req.query.limit ?? resolveDefaultFeedLimit(category));
  const limitCount = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(50, Math.round(limitRaw)))
    : resolveDefaultFeedLimit(category);
  const provider = "newsapi_ai";
  const snapshotDate = utcDayStamp();
  const snapshot = await getDailySnapshot({
    snapshotDate,
    category,
    limitCount,
    provider
  });

  if (!snapshot) {
    return res.status(404).json({
      ok: false,
      error: "No snapshot found for today. Hit /feed first."
    });
  }

  return res.json({
    ok: true,
    snapshotId: snapshot.snapshotId,
    snapshotDate: snapshot.snapshotDate,
    category,
    limit: limitCount,
    provider,
    count: snapshot.articles.length,
    categories: snapshot.categories,
    articles: snapshot.articles
  });
});

app.get("/feed/snapshots", async (req, res) => {
  const snapshotDate =
    typeof req.query.date === "string" && req.query.date.length > 0
      ? req.query.date
      : utcDayStamp();

  const rows = !POSTGRES_ENABLED
    ? listSnapshotsByDateStmt.all({ snapshotDate })
    : (
        await pgQuery(
          `
            SELECT
              fs.snapshot_id,
              fs.snapshot_date,
              fs.category,
              fs.limit_count,
              fs.provider,
              fs.created_at,
              fs.status,
              fs.published_at,
              (
                SELECT COUNT(*)
                FROM snapshot_articles sa
                WHERE sa.snapshot_id = fs.snapshot_id
              ) AS article_count
            FROM feed_snapshots fs
            WHERE fs.snapshot_date = $1
            ORDER BY fs.created_at DESC, fs.snapshot_id DESC
          `,
          [snapshotDate]
        )
      ).rows;
  const snapshots = rows.map((row) => ({
    snapshotId: row.snapshot_id,
    snapshotDate: row.snapshot_date,
    category: row.category,
    limit: row.limit_count,
    provider: row.provider,
    createdAt: row.created_at,
    status:
      typeof row.status === "string" && row.status.length > 0
        ? row.status
        : SNAPSHOT_STATUS_READY,
    publishedAt:
      typeof row.published_at === "string" && row.published_at.length > 0
        ? row.published_at
        : null,
    articleCount: Number.isFinite(Number(row.article_count))
      ? Number(row.article_count)
      : 0
  }));

  return res.json({
    ok: true,
    snapshotDate,
    count: snapshots.length,
    snapshots
  });
});

app.get("/feed/snapshot/by-date", async (req, res) => {
  const snapshotDate =
    typeof req.query.date === "string" && req.query.date.length > 0
      ? req.query.date
      : utcDayStamp();
  const category = normalizeRequestedCategory(req.query.category);
  const limitRaw = Number(req.query.limit ?? 5);
  const limitCount = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(50, Math.round(limitRaw)))
    : 5;
  const provider = "newsapi_ai";
  const snapshot = await getDailySnapshot({
    snapshotDate,
    category,
    limitCount,
    provider
  });

  if (!snapshot) {
    return res.status(404).json({
      ok: false,
      error: "Snapshot not found for the requested date/category/limit."
    });
  }

  return res.json({
    ok: true,
    snapshotId: snapshot.snapshotId,
    snapshotDate: snapshot.snapshotDate,
    category,
    limit: limitCount,
    provider,
    count: snapshot.articles.length,
    categories: snapshot.categories,
    articles: snapshot.articles
  });
});

app.get("/feed/snapshot/:snapshotId", async (req, res) => {
  const snapshotIdRaw = Number(req.params.snapshotId);
  const snapshotId = Number.isFinite(snapshotIdRaw) && snapshotIdRaw > 0
    ? Math.round(snapshotIdRaw)
    : null;

  if (!snapshotId) {
    return res.status(400).json({
      ok: false,
      error: "snapshotId must be a positive integer."
    });
  }

  const snapshot = await getSnapshotById(snapshotId);
  if (!snapshot) {
    return res.status(404).json({
      ok: false,
      error: "Snapshot not found."
    });
  }

  return res.json({
    ok: true,
    snapshotId: snapshot.snapshotId,
    snapshotDate: snapshot.snapshotDate,
    category: snapshot.category,
    limit: snapshot.limitCount,
    provider: snapshot.provider,
    count: snapshot.articles.length,
    categories: snapshot.categories,
    articles: snapshot.articles
  });
});

app.get(
  "/feed/snapshot/:snapshotId/article/:articleId/variants",
  async (req, res) => {
  const snapshotIdRaw = Number(req.params.snapshotId);
  const snapshotId = Number.isFinite(snapshotIdRaw) && snapshotIdRaw > 0
    ? Math.round(snapshotIdRaw)
    : null;
  const articleId = req.params.articleId;

  if (!snapshotId) {
    return res.status(400).json({
      ok: false,
      error: "snapshotId must be a positive integer."
    });
  }

  const bundle = await getVariantBundleForSnapshotArticle(snapshotId, articleId);
  if (!bundle) {
    return res.status(404).json({
      ok: false,
      error: "No stored variants found for this snapshot/article."
    });
  }

    return res.json({
      ok: true,
      snapshotId,
      articleId,
      variants: bundle.variants,
      variantMeta: bundle.variantMeta
    });
  }
);

app.get("/events", async (req, res) => {
  const limitRaw = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(500, Math.round(limitRaw)))
    : 100;

  const userId =
    typeof req.query.userId === "string" && req.query.userId.length > 0
      ? req.query.userId
      : null;
  const eventType =
    typeof req.query.eventType === "string" && req.query.eventType.length > 0
      ? req.query.eventType
      : null;
  const articleId =
    typeof req.query.articleId === "string" && req.query.articleId.length > 0
      ? req.query.articleId
      : null;
  const from =
    typeof req.query.from === "string" && req.query.from.length > 0
      ? req.query.from
      : null;
  const to =
    typeof req.query.to === "string" && req.query.to.length > 0
      ? req.query.to
      : null;

  const conditions = [];
  const params = {};

  if (userId) {
    conditions.push("user_id = @userId");
    params.userId = userId;
  }
  if (eventType) {
    conditions.push("event_type = @eventType");
    params.eventType = eventType;
  }
  if (articleId) {
    conditions.push("article_id = @articleId");
    params.articleId = articleId;
  }
  if (from) {
    conditions.push("timestamp >= @from");
    params.from = from;
  }
  if (to) {
    conditions.push("timestamp <= @to");
    params.to = to;
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  let rows = [];
  if (!POSTGRES_ENABLED) {
    const query = `
      ${listEventsBase}
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT @limit
    `;
    params.limit = limit;
    rows = db.prepare(query).all(params);
  } else {
    const clauses = [];
    const values = [];
    if (userId) {
      values.push(userId);
      clauses.push(`user_id = $${values.length}`);
    }
    if (eventType) {
      values.push(eventType);
      clauses.push(`event_type = $${values.length}`);
    }
    if (articleId) {
      values.push(articleId);
      clauses.push(`article_id = $${values.length}`);
    }
    if (from) {
      values.push(from);
      clauses.push(`timestamp >= $${values.length}`);
    }
    if (to) {
      values.push(to);
      clauses.push(`timestamp <= $${values.length}`);
    }
    values.push(limit);
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await pgQuery(
      `
        SELECT
          event_id,
          schema_version,
          event_type,
          timestamp,
          user_id,
          session_id,
          surface,
          request_id,
          article_id,
          variant_key,
          position,
          properties_json
        FROM events
        ${whereSql}
        ORDER BY timestamp DESC
        LIMIT $${values.length}
      `,
      values
    );
    rows = result.rows;
  }

  const events = rows.map((row) => ({
    eventId: row.event_id,
    schemaVersion: row.schema_version,
    eventType: row.event_type,
    timestamp: row.timestamp,
    userId: row.user_id,
    sessionId: row.session_id,
    surface: row.surface,
    requestId: row.request_id,
    articleId: row.article_id,
    variantKey: row.variant_key,
    position: row.position,
    properties: row.properties_json ? JSON.parse(row.properties_json) : {}
  }));

  res.json({
    ok: true,
    count: events.length,
    limit,
    filters: {
      userId,
      eventType,
      articleId,
      from,
      to
    },
    events
  });
});

app.post("/events/batch", async (req, res) => {
  const body = req.body;
  if (!isRecord(body)) {
    return res.status(400).json({ ok: false, error: "Body must be an object." });
  }

  if (body.schemaVersion !== SCHEMA_VERSION) {
    return res.status(400).json({
      ok: false,
      error: `Unsupported schemaVersion. Expected ${SCHEMA_VERSION}.`
    });
  }

  if (!Array.isArray(body.events)) {
    return res.status(400).json({ ok: false, error: "events must be an array." });
  }

  let accepted = 0;
  let duplicates = 0;
  const rejected = [];

  if (!POSTGRES_ENABLED) {
    const insertMany = db.transaction((events) => {
      for (let index = 0; index < events.length; index += 1) {
        const event = events[index];
        const error = validateEvent(event);
        if (error) {
          rejected.push({ index, error });
          continue;
        }

        const result = insertEventStmt.run({
          eventId: event.eventId,
          schemaVersion: event.schemaVersion,
          eventType: event.eventType,
          timestamp: event.timestamp,
          userId: event.userId,
          sessionId: event.sessionId,
          surface: event.surface ?? null,
          requestId: event.requestId ?? null,
          articleId: event.articleId ?? null,
          variantKey: event.variantKey ?? null,
          position: event.position ?? null,
          propertiesJson: JSON.stringify(event.properties ?? {})
        });

        if (result.changes === 1) {
          accepted += 1;
        } else {
          duplicates += 1;
        }
      }
    });

    insertMany(body.events);
  } else {
    const client = await pgPool.connect();
    try {
      await client.query("BEGIN");
      for (let index = 0; index < body.events.length; index += 1) {
        const event = body.events[index];
        const error = validateEvent(event);
        if (error) {
          rejected.push({ index, error });
          continue;
        }

        const result = await client.query(
          `
            INSERT INTO events (
              event_id,
              schema_version,
              event_type,
              timestamp,
              user_id,
              session_id,
              surface,
              request_id,
              article_id,
              variant_key,
              position,
              properties_json
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
            )
            ON CONFLICT(event_id) DO NOTHING
            RETURNING event_id
          `,
          [
            event.eventId,
            event.schemaVersion,
            event.eventType,
            event.timestamp,
            event.userId,
            event.sessionId,
            event.surface ?? null,
            event.requestId ?? null,
            event.articleId ?? null,
            event.variantKey ?? null,
            event.position ?? null,
            JSON.stringify(event.properties ?? {})
          ]
        );

        if (Array.isArray(result.rows) && result.rows.length > 0) {
          accepted += 1;
        } else {
          duplicates += 1;
        }
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      return res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Failed to insert events."
      });
    } finally {
      client.release();
    }
  }

  console.log(
    `[analytics-server] batch received total=${body.events.length} accepted=${accepted} duplicates=${duplicates} rejected=${rejected.length}`
  );

  return res.status(rejected.length > 0 ? 207 : 200).json({
    ok: true,
    schemaVersion: SCHEMA_VERSION,
    accepted,
    duplicates,
    rejectedCount: rejected.length,
    rejected
  });
});

async function startServer() {
  if (POSTGRES_ENABLED) {
    await ensurePostgresSchema();
  }
  await bootstrapCurrentSnapshotsFromReady();
  await recoverIncompleteSnapshots();

  app.listen(PORT, () => {
    const dbDescriptor = POSTGRES_ENABLED ? "Supabase Postgres" : DB_PATH;
    console.log(
      `[analytics-server] listening on http://localhost:${PORT} using DB ${dbDescriptor}`
    );
    if (DAILY_REFRESH_ENABLED) {
      console.log(
        `[daily-refresh] scheduler enabled category=${DAILY_REFRESH_CATEGORY} intervalMs=${DAILY_REFRESH_INTERVAL_MS}`
      );
    }
    startDailyRefreshScheduler();
  });
}

startServer().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[analytics-server] failed to start: ${message}`);
  process.exit(1);
});
