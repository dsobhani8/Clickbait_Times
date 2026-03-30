# TailorMadeTimes

Mobile news experiment app with a React Native frontend, a Node/Express backend, Supabase auth/Postgres storage, and Render deployment.

## Current Product Shape

The live experiment is centered on one backend-assigned experiment:
- `clickbait_tone_v1`
- arms: `neutral` and `clickbait`
- participant identity: `Prolific ID + password`

The active stack is:
- Expo / React Native frontend
- `backend/events-server.js` for feed, analytics ingestion, snapshot serving, and admin endpoints
- Supabase Auth for participant sessions
- Supabase Postgres for analytics, feed snapshots, rewrites, and participant account metadata
- Render for the deployed backend

## What Is In Scope

Runtime frontend:
- `app/`
- `services/`
- `state/`
- `styles/`
- `utils/`

Runtime backend:
- `backend/events-server.js`
- `backend/newsapi-client.js`
- `backend/topic-classifier.js`
- `backend/rewrite-prompts.js`
- `backend/rewrite-specs.js`
- `backend/rewrite-tone-llm.js`
- `backend/rewrite-variants.js`
- `backend/experiments.js`
- `backend/participant-identity.js`

Operational scripts:
- `backend/feed-refresh.js`
- `backend/provision-prolific-users.js`
- `backend/provision-prolific-users-smoke.js`
- `backend/queue-clear.js`
- `backend/queue-status.js`
- `backend/rewrite-regular-smoke.js`
- `backend/snapshot-query.js`

Operational docs and dashboards:
- `docs/analytics-contract.md`
- `docs/ops-runbook.md`
- `backend/public/variants-dashboard.html`
- `backend/public/ops-dashboard.html`

Reference material intentionally kept in the repo:
- `modules/`
- `modules.zip`
- `News_Customization_with_AI.pdf`
- `docs/news_customization_with_ai.txt`
- `docs/news_customization_with_ai_extracted.txt`
- `ingar_shared/`
- `sensationalized_classifier/inspect_csvs.py`

Archived legacy SQLite helper scripts:
- `archive/legacy-sqlite-tools/`

## Core Runtime Behavior

### Feed and snapshots
- The app requests the feed from the backend via `/feed`.
- The backend stores immutable daily snapshots and only serves the last fully published snapshot.
- This prevents articles from changing mid-rewrite.
- If the backend is configured in the app and fetch fails, the app now shows an error state with retry instead of silently falling back to fake content.

### Rewrites
- Active launch-relevant variants are:
  - `regular`
  - `facts_only`
  - `clickbait`
- Rewrites are generated server-side and stored in Postgres.
- `REWRITE_MODE=tone_llm` enables LLM rewrites.
- If a rewrite fails, the backend can fall back to rule-based output for that variant.

### Auth and experiment assignment
- Participants log in with `Prolific ID + password`.
- The app converts the Prolific ID into an internal pseudo-email for Supabase Auth.
- Experiment assignment is backend-authoritative.
- Production participant accounts are stored in `participant_accounts` and include a fixed experiment arm.

### Analytics
- The client queues analytics locally and uploads batched events to `POST /events/batch`.
- Production analytics are stored in Supabase Postgres.
- Events include experiment context so treatment integrity can be audited later.

## Local Development

### Install
```bash
npm install
```

### Start the app in frontend-only dev mode
```bash
npx expo start
```

### Start the backend locally
```bash
npm run analytics:server
```

### Start the app against the local backend
```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8787 \
EXPO_PUBLIC_ANALYTICS_ENDPOINT=http://localhost:8787/events/batch \
npx expo start --clear
```

### Start the app against the deployed Render backend
```bash
EXPO_PUBLIC_API_BASE_URL=https://clickbait-times.onrender.com \
EXPO_PUBLIC_ANALYTICS_ENDPOINT=https://clickbait-times.onrender.com/events/batch \
npx expo start --clear
```

## Environment Variables

Frontend / Expo:
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_ANALYTICS_ENDPOINT`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_PARTICIPANT_LOGIN_EMAIL_DOMAIN` (optional)

Backend / Render or local server:
- `SUPABASE_DB_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_URL`
- `NEWSAPI_AI_KEY`
- `NEWSAPI_AI_SOURCE_URI`
- `REWRITE_MODE`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `FEED_FRESH_ARTICLE_MAX_AGE_HOURS`
- `REWRITE_TIMEOUT_MS`
- `REWRITE_MAX_ATTEMPTS`
- `PIPELINE_ADMIN_TOKEN`
- `DAILY_REFRESH_ENABLED`
- `DAILY_REFRESH_INTERVAL_MS`
- `FEED_WAIT_FOR_REWRITE`
- `PARTICIPANT_LOGIN_EMAIL_DOMAIN` (optional)

## Participant Provisioning

Provision a real batch from CSV:
```bash
npm run participants:provision -- --csv /path/to/participants.csv --output /tmp/provisioned-users.csv
```

Run the synthetic smoke test users:
```bash
npm run participants:smoke
```

## Operational Commands

Refresh feed locally:
```bash
npm run feed:refresh -- --base-url http://localhost:8787 --category All
```

Inspect stored snapshots:
```bash
npm run feed:snapshot -- --date 2026-03-27 --category All
```

Check rewrite queue state:
```bash
npm run analytics:queue:status
```

Clear stuck rewrite queue state locally if needed:
```bash
npm run analytics:queue:clear
```

## Render / Production Operations

Health:
```bash
curl -s "https://clickbait-times.onrender.com/health" | jq
```

Published feed:
```bash
curl -s "https://clickbait-times.onrender.com/feed?category=All" | jq '{snapshotId,snapshotDate,count,cached}'
```

Ops dashboard:
- `https://clickbait-times.onrender.com/dashboard/ops`

Variant dashboard:
- `https://clickbait-times.onrender.com/dashboard/variants`

Trigger a protected pipeline rebuild:
```bash
curl -s -X POST \
  -H "x-admin-token: $PIPELINE_ADMIN_TOKEN" \
  "https://clickbait-times.onrender.com/admin/pipeline/run?category=All&rebuild=1" | jq
```

## Repository Notes

- The old SQLite analytics helper scripts were archived under `archive/legacy-sqlite-tools/` because the live system now writes to Supabase Postgres.
- `backend/analytics-events.db*` are local development artifacts, not source-controlled product assets.
- The Python paper pipeline and research artifacts remain in the repo for reference only.
