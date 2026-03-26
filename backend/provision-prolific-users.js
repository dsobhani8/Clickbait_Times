const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const {
  buildParticipantLoginEmail,
  normalizeProlificPid
} = require("./participant-identity");

const SUPABASE_URL = (
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  ""
).trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const SUPABASE_DB_URL = (process.env.SUPABASE_DB_URL || "").trim();
const VALID_ARMS = new Set(["neutral", "clickbait"]);

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "1";
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  function pushCell() {
    row.push(current);
    current = "";
  }

  function pushRow() {
    if (row.length === 0 && current.length === 0) {
      return;
    }
    pushCell();
    rows.push(row);
    row = [];
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === ",") {
      pushCell();
      continue;
    }
    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      pushRow();
      continue;
    }
    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    pushRow();
  }

  if (rows.length === 0) {
    return [];
  }

  const header = rows[0].map((value) => value.trim());
  return rows.slice(1).map((values) => {
    const record = {};
    header.forEach((key, headerIndex) => {
      record[key] = typeof values[headerIndex] === "string" ? values[headerIndex].trim() : "";
    });
    return record;
  });
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
}

function formatCsv(records, columns) {
  const lines = [columns.join(",")];
  for (const record of records) {
    lines.push(columns.map((column) => csvEscape(record[column] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function generatePassword(length = 12) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(length);
  let output = "";
  for (let index = 0; index < length; index += 1) {
    output += alphabet[bytes[index] % alphabet.length];
  }
  return output;
}

async function ensureSchema(pool) {
  await pool.query(`
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
}

async function findAuthUserByEmail(pool, email) {
  const result = await pool.query(
    `
      SELECT id, email
      FROM auth.users
      WHERE lower(email) = lower($1)
      LIMIT 1
    `,
    [email]
  );
  return result.rows[0] || null;
}

async function createOrUpdateSupabaseUser({
  pool,
  prolificPid,
  loginEmail,
  password
}) {
  const existing = await findAuthUserByEmail(pool, loginEmail);
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
  const body = JSON.stringify({
    email: loginEmail,
    password,
    email_confirm: true,
    user_metadata: {
      prolific_pid: prolificPid,
      login_id: prolificPid
    }
  });

  if (!existing) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason =
        payload?.msg || payload?.message || payload?.error_description || payload?.error;
      throw new Error(
        `Failed to create auth user for ${prolificPid}: ${reason || response.status}`
      );
    }
    const createdUserId = payload?.user?.id || payload?.id;
    if (typeof createdUserId !== "string" || createdUserId.length === 0) {
      throw new Error(`Create user response for ${prolificPid} did not include an id.`);
    }
    return createdUserId;
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
    method: "PUT",
    headers,
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason =
      payload?.msg || payload?.message || payload?.error_description || payload?.error;
    throw new Error(
      `Failed to update auth user for ${prolificPid}: ${reason || response.status}`
    );
  }
  return existing.id;
}

async function upsertParticipantAccount(pool, record) {
  await pool.query(
    `
      INSERT INTO participant_accounts (
        prolific_pid,
        auth_user_id,
        login_email,
        experiment_arm,
        status,
        password_issued_at,
        metadata_json,
        created_at,
        updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (prolific_pid) DO UPDATE SET
        auth_user_id = excluded.auth_user_id,
        login_email = excluded.login_email,
        experiment_arm = excluded.experiment_arm,
        status = excluded.status,
        password_issued_at = excluded.password_issued_at,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `,
    [
      record.prolificPid,
      record.authUserId,
      record.loginEmail,
      record.experimentArm,
      record.status,
      record.passwordIssuedAt,
      JSON.stringify(record.metadata || {}),
      record.createdAt,
      record.updatedAt
    ]
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const csvPath = args.csv ? path.resolve(args.csv) : "";
  const outputPath = args.output ? path.resolve(args.output) : "";
  const idColumn = (args["id-column"] || "prolific_pid").trim();
  const armColumn = (args["arm-column"] || "experiment_arm").trim();
  const passwordColumn = (args["password-column"] || "password").trim();
  const defaultArm = (args["default-arm"] || "").trim().toLowerCase();
  const status = (args.status || "active").trim().toLowerCase();

  if (!csvPath) {
    throw new Error("Missing required --csv path.");
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_DB_URL) {
    throw new Error(
      "Set EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_DB_URL before running."
    );
  }
  if (defaultArm && !VALID_ARMS.has(defaultArm)) {
    throw new Error(`Invalid --default-arm "${defaultArm}". Use neutral or clickbait.`);
  }

  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  if (rows.length === 0) {
    throw new Error("CSV had no rows.");
  }

  const pool = new Pool({
    connectionString: SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await ensureSchema(pool);
    const seen = new Set();
    const outputRows = [];

    for (const row of rows) {
      const prolificPid = normalizeProlificPid(row[idColumn] || "");
      if (!prolificPid) {
        throw new Error(`Missing prolific pid in column "${idColumn}".`);
      }
      if (seen.has(prolificPid)) {
        throw new Error(`Duplicate prolific pid "${prolificPid}" in CSV.`);
      }
      seen.add(prolificPid);

      const candidateArm = String(row[armColumn] || defaultArm || "")
        .trim()
        .toLowerCase();
      if (!VALID_ARMS.has(candidateArm)) {
        throw new Error(
          `Missing or invalid arm for "${prolificPid}". Use column "${armColumn}" or --default-arm neutral/clickbait.`
        );
      }

      const password =
        typeof row[passwordColumn] === "string" && row[passwordColumn].trim().length > 0
          ? row[passwordColumn].trim()
          : generatePassword();
      const loginEmail = buildParticipantLoginEmail(prolificPid);
      const authUserId = await createOrUpdateSupabaseUser({
        pool,
        prolificPid,
        loginEmail,
        password
      });
      const nowIso = new Date().toISOString();
      await upsertParticipantAccount(pool, {
        prolificPid,
        authUserId,
        loginEmail,
        experimentArm: candidateArm,
        status,
        passwordIssuedAt: nowIso,
        metadata: {},
        createdAt: nowIso,
        updatedAt: nowIso
      });

      outputRows.push({
        prolific_pid: prolificPid,
        login_email: loginEmail,
        password,
        experiment_arm: candidateArm,
        auth_user_id: authUserId,
        status
      });
    }

    if (outputPath) {
      fs.writeFileSync(
        outputPath,
        formatCsv(outputRows, [
          "prolific_pid",
          "login_email",
          "password",
          "experiment_arm",
          "auth_user_id",
          "status"
        ]),
        "utf8"
      );
    }

    console.log(
      `[participants:provision] provisioned=${outputRows.length} output=${outputPath || "<none>"}`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(
    `[participants:provision] failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
