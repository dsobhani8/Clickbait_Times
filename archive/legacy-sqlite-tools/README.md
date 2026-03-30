Legacy SQLite analytics inspection scripts that predate the current Supabase Postgres pipeline.

What they are:
- one-off CLI tools for querying `backend/analytics-events.db`
- built around `better-sqlite3`
- useful as reference for old local debugging, not part of the live Render backend

Why archived:
- the production app now writes analytics to Supabase Postgres through `backend/events-server.js`
- these scripts are no longer part of the active runtime or npm workflow

How to use them if needed:
- point them at a SQLite analytics file with `ANALYTICS_DB_PATH`
- example:
  - `ANALYTICS_DB_PATH=backend/analytics-events.db node archive/legacy-sqlite-tools/events-summary.js`

Files:
- `events-query.js`
- `events-summary.js`
- `events-clicks.js`
- `events-session-clicks.js`
- `events-sessions.js`
- `events-narrative.js`
- `events-tailor.js`
- `events-reset.js`
- `articles-index.js`
