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
- `prompts/runtime/`

Reference material intentionally kept in the repo:
- `modules/`
- `News_Customization_with_AI.pdf`
- `docs/news_customization_with_ai.txt`
- `docs/news_customization_with_ai_extracted.txt`

Local-only reference/data paths intentionally not tracked in Git:
- `modules.zip`
- `ingar_shared/`
- `sensationalized_classifier/`
- `modules/b_summary_metadata/regular_summary/prompts/*.py`
- `modules/d_versions/*/prompts/*.py`

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
- `regular` is the baseline/original article.
- `facts_only` is now a staged neutral rewrite:
  - facts-only body rewrite
  - then facts-only title + lead rewrite
- `clickbait` is derived from the neutral rewrite:
  - clickbait title + lead rewrite
  - then clickbait body rewrite
- If a rewrite stage fails, the backend falls back to the safest earlier stage available for that variant.

### Auth and experiment assignment
- Participants log in with `Prolific ID + password`.
- The app converts the Prolific ID into an internal pseudo-email for Supabase Auth.
- Experiment assignment is backend-authoritative.
- Production participant accounts are stored in `participant_accounts` and include a fixed experiment arm.

### Analytics
- The client queues analytics locally and uploads batched events to `POST /events/batch`.
- Production analytics are stored in Supabase Postgres.
- Events include experiment context so treatment integrity can be audited later.

## Pipeline Overview

### 1. Retrieval from NewsAPI.ai / Event Registry
- Provider code lives in `backend/newsapi-client.js`.
- The backend fetches from the NewsAPI.ai / Event Registry article endpoint:
  - `https://eventregistry.org/api/v1/article/getArticles`
- The deployed pipeline filters provider results to AP by setting:
  - `NEWSAPI_AI_SOURCE_URI=apnews.com`
- For the `All` feed, the backend now fetches a broad recent AP pool and does not add provider-side topic keywords like `Technology` or `Politics`.
- The source filter is applied in `buildArticleQuery` in `backend/newsapi-client.js`.
- `fetchNewsApiArticles` resolves the source URI, fetches the page, dedupes results, and normalizes them into internal article objects.

### 2. Eligibility filtering
- Article length filtering happens in `backend/events-server.js`.
- Current bounds are controlled by:
  - `FEED_MIN_WORDS`
  - `FEED_MAX_WORDS`
- Short or overly long articles are excluded before selection.

### 3. Topic classification
- Topic classification lives in `backend/topic-classifier.js`.
- The classifier assigns each candidate to one of:
  - `Technology`
  - `Politics`
  - `Economy`
  - `None`
- The classifier uses:
  - the article title
  - the article lead
  - the first few body paragraphs
- For `All`, `backend/events-server.js`:
  - fetches a broad AP pool
  - classifies each candidate locally
  - buckets accepted articles by topic
  - fills the feed with `FEED_PER_TOPIC_TARGET` articles per topic
- Freshness policy is:
  - `fresh_first_with_stale_fallback`
  - controlled by `FEED_FRESH_ARTICLE_MAX_AGE_HOURS`

### 4. Snapshot creation and storage
- Snapshot orchestration lives in `backend/events-server.js`.
- The main tables are:
  - `feed_snapshots`: one row per generated feed snapshot
  - `snapshot_articles`: the selected article rows for a snapshot
  - `snapshot_article_variants`: stored `regular`, `facts_only`, and `clickbait` variants
  - `current_snapshots`: the currently published snapshot pointer per feed shape
  - `rewrite_jobs`: queued/running/completed LLM rewrite jobs
- The backend only publishes a snapshot after rewrite work is complete, so the app does not see mid-build editions.

### 5. Rewrite generation
- Rewrite orchestration lives in:
  - `backend/rewrite-tone-llm.js`
  - `backend/rewrite-specs.js`
  - `backend/rewrite-variants.js`
- Prompt loading lives in:
  - `backend/rewrite-prompts.js`
- Active prompt files are:
  - `prompts/runtime/regular_body_rewrite.py`
  - `prompts/runtime/regular_title_lead_rewrite.py`
  - `prompts/runtime/clickbait_title_lead_rewrite.py`
  - `prompts/runtime/clickbait_body_rewrite.py`
- The active runtime behavior is:
  - `regular`: original title, lead, and body
  - `facts_only`:
    - body rewritten into a neutral/facts-only version at about 300 words when the source is longer
    - then title + lead rewritten from that facts-only body
  - `clickbait`:
    - title + lead rewritten from the facts-only variant
    - then body rewritten from the facts-only variant under the clickbait framing
- The active LLM method is:
  - `tone_llm_staged_v1`
- Legacy module prompt files can remain local for reference, but `prompts/runtime/` is now the runtime source of truth.

### 6. App delivery
- The app-side feed client lives in `services/articles.ts`.
- The app always fetches the canonical `All` snapshot from `/feed`.
- Topic tabs such as `Technology`, `Politics`, and `Economy` are filtered locally from that same `All` snapshot so they match what appears in `All`.
- The feed screen is in `app/index.tsx`.
- Article display is in `app/article/[id].tsx`.

### 7. Experiment rendering
- Backend arm assignment logic lives in `backend/experiments.js`.
- Frontend article-level variant assignment logic lives in `services/experiment.ts`.
- Current behavior:
  - `neutral` arm: all articles render as `facts_only`
  - `clickbait` arm: roughly 50% of articles render as `clickbait` and 50% as `facts_only`
- That split is stable per user and article, not randomized on every app open.

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
EXPO_PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com \
EXPO_PUBLIC_ANALYTICS_ENDPOINT=https://<your-render-service>.onrender.com/events/batch \
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
- `NEWSAPI_AI_SOURCE_URI` (`apnews.com` in the current production setup)
- `REWRITE_MODE`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `FEED_FRESH_ARTICLE_MAX_AGE_HOURS`
- `FEED_PER_TOPIC_TARGET`
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
curl -s "https://<your-render-service>.onrender.com/health" | jq
```

Published feed:
```bash
curl -s "https://<your-render-service>.onrender.com/feed?category=All" | jq '{snapshotId,snapshotDate,count,cached}'
```

Ops dashboard:
- `https://<your-render-service>.onrender.com/dashboard/ops`

Variant dashboard:
- `https://<your-render-service>.onrender.com/dashboard/variants`

Trigger a rebuild directly through `/feed`:
```bash
curl -s "https://<your-render-service>.onrender.com/feed?category=All&refresh=1&rebuild=1" | jq
```

Recommended production scheduling:
- keep the web service focused on serving the API
- use a separate Render Cron Job to trigger the rebuild URL above
- set `DAILY_REFRESH_ENABLED=0` on the web service if cron is the only scheduler

## Repository Notes

- `backend/analytics-events.db*` are local development artifacts, not source-controlled product assets.
- The Python paper pipeline and research artifacts remain in the repo for reference only.
