const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { Pool } = require("pg");

const SUPABASE_DB_URL = (process.env.SUPABASE_DB_URL || "").trim();

const SMOKE_USERS = [
  {
    prolific_pid: "pilot_neutral_alpha",
    experiment_arm: "neutral",
    password: "testpass123"
  },
  {
    prolific_pid: "pilot_clickbait_alpha",
    experiment_arm: "clickbait",
    password: "testpass456"
  }
];

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

async function queryProvisionedRows() {
  if (!SUPABASE_DB_URL) {
    throw new Error("SUPABASE_DB_URL is required.");
  }
  const pool = new Pool({
    connectionString: SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  try {
    const result = await pool.query(
      `
        SELECT
          prolific_pid,
          login_email,
          experiment_arm,
          auth_user_id,
          status
        FROM participant_accounts
        WHERE prolific_pid = ANY($1::text[])
        ORDER BY prolific_pid ASC
      `,
      [SMOKE_USERS.map((user) => user.prolific_pid)]
    );
    return result.rows;
  } finally {
    await pool.end();
  }
}

async function main() {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "clickbait-times-smoke-participants-")
  );
  const csvPath = path.join(tmpDir, "participants.csv");
  const outputPath = path.join(tmpDir, "provisioned.csv");

  fs.writeFileSync(
    csvPath,
    formatCsv(SMOKE_USERS, ["prolific_pid", "experiment_arm", "password"]),
    "utf8"
  );

  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "provision-prolific-users.js"), "--csv", csvPath, "--output", outputPath],
    {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
      env: process.env
    }
  );

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  const rows = await queryProvisionedRows();
  console.log("[participants:smoke] provisioned rows:");
  for (const row of rows) {
    console.log(
      JSON.stringify({
        prolific_pid: row.prolific_pid,
        login_email: row.login_email,
        experiment_arm: row.experiment_arm,
        auth_user_id: row.auth_user_id,
        status: row.status
      })
    );
  }
  console.log(`[participants:smoke] temp_dir=${tmpDir}`);
}

main().catch((error) => {
  console.error(
    `[participants:smoke] failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
