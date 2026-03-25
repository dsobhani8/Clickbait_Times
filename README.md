# TailorMadeTimes Prototype

Mobile prototype for a customizable news-reading experience.

## Current Status

Implemented:
- Feed screen with category filtering
- Article reader route
- Route-based navigation with `expo-router`
- Local async article service layer
- Tailor controls (mocked UX + live static variant switching)
- Optional prompt-driven LLM rewrites at snapshot time (configurable variant set)
- Rule-based fallback rewrites for all variants
- Per-user local Tailor preference persistence (dev identities, no login)
- Analytics client queue + batch upload pipeline
- Local analytics ingestion server with persistent `events` table (SQLite)
- Immutable daily feed snapshots with stored raw article content and stored rewrite variants

Not implemented yet:
- Real authentication
- Multi-agent rewrite pipeline from the paper
- Recommender ranking model

## App Features (Today)

### Feed
- Shows articles by category
- Uses service layer (`services/articles.ts`) rather than direct JSON reads
- Can run in:
  - local static mode (`data/articles.json`)
  - backend mode (`/feed` + `/articles/:id`) when `EXPO_PUBLIC_API_BASE_URL` is set
- Emits `impression` analytics for rendered cards with rank position

### Article Reader
- Opens by route: `/article/[id]`
- Displays article with active variant
- Tailor panel includes:
  - `Facts only` (toggle)
  - `Complexity` (stepped slider)
  - `Tone` (stepped slider)

### Variant Switching
- App-exposed variants:
  - `regular`
  - `facts_only`
  - `less_complex`
  - `more_positive`
  - `more_negative`
- Backend-stored variants (snapshot persistence):
  - `regular`
  - `facts_only`
  - `less_complex`
  - `more_positive`
  - `more_negative`
  - `conservative`
  - `liberal`
  - `entertaining`
- Selection priority:
  1. `facts_only`
  2. `less_complex` (if complexity < 0)
  3. tone (`more_positive` / `more_negative`)
  4. `regular`

### Live Rewrite Behavior (Current)
- For static sample articles (`data/articles.json`), variant text is manually authored (plus overrides).
- For live backend articles (`EXPO_PUBLIC_API_BASE_URL` mode), variants are generated and persisted server-side at snapshot time and returned by API.
- Default mode (`REWRITE_MODE=rule_based`) uses `backend/rewrite-variants.js`:
  - `regular`: original title/lead/body from API
  - `facts_only`: currently same as `regular`
  - `less_complex`: first-sentence simplification
  - `more_positive`: deterministic word-level replacement map + `Positive Framing:` title prefix
  - `more_negative`: deterministic word-level replacement map + `Cautious Framing:` title prefix
  - `conservative`: deterministic lexical framing map + `Conservative Framing:` title prefix
  - `liberal`: deterministic lexical framing map + `Liberal Framing:` title prefix
  - `entertaining`: deterministic title/lead framing
- Optional LLM mode (`REWRITE_MODE=tone_llm`) uses `backend/rewrite-tone-llm.js` + `backend/rewrite-prompts.js`:
  - Generates the variants listed in `LLM_VARIANTS` with OpenAI (`OPENAI_API_KEY` + `OPENAI_MODEL`).
  - Default `LLM_VARIANTS` is `more_positive,more_negative`.
  - Uses `OPENAI_TEMPERATURE` (default `1.0`).
  - Non-LLM variants remain rule-based.
  - If any LLM call fails, that variant falls back to rule-based output.
- Rewrite execution order is now:
  1. fetch AP feed
  2. save raw article snapshot + baseline rule variants
  3. run queued LLM rewrites against saved snapshot entries (for configured `LLM_VARIANTS`)
  4. upsert rewritten variants in `snapshot_article_variants`
- This keeps the daily snapshot durable even if LLM calls are slow or fail.
- This is a lightweight MVP rewrite layer intended to validate UX and analytics wiring before a full multi-agent system.

### Snapshot Storage (Raw + Rewrites)
- Daily feed snapshots are now immutable and date-stamped in SQLite:
  - `feed_snapshots`: one row per `(snapshot_date, category, limit, provider)`
  - `snapshot_articles`: full raw article payload per snapshot (title/lead/body/source/date/rank)
  - `snapshot_article_variants`: stored rewrite text per snapshot/article/variant (includes `rewrite_method`)
- This preserves historical "what users were shown" and "what rewrite text existed that day."

### Dev User Identity (No Login)
- Built-in identities:
  - `dominic`
  - `tester1`
  - `tester2`
- Selectable on feed screen
- Active user persists across restarts

### Preference Persistence
- Tailor settings are saved per user using:
  - `tailor_settings_${userId}`
- Active dev user is saved as:
  - `active_dev_user_v1`

## Analytics (Current)

Tracked event types:
- `impression`
- `article_open`
- `tailor_open`
- `tailor_change`
- `variant_applied`
- `read_time`

Tracked fields include:
- `eventId`, `eventType`, `timestamp`
- `userId`, `sessionId`
- optional `surface`, `requestId`, `articleId`, `variantKey`, `position`, `properties`

Durable pipeline:
- Client queue stored in `AsyncStorage` (`analytics_event_queue_v1`)
- Batch upload to `POST /events/batch`
- Local server persists to SQLite `events` table (`backend/analytics-events.db`)
- Contract is versioned (`schemaVersion: 1`)
- Contract doc: `docs/analytics-contract.md`

## Project Structure

- `app/_layout.tsx` - Root router stack and providers
- `app/index.tsx` - Feed route
- `app/article/[id].tsx` - Article route + Tailor UI
- `services/articles.ts` - Async local article service + variant data
- `services/analytics.ts` - Analytics event contract + local logger
- `backend/events-server.js` - Analytics ingestion API and DB writer
- `backend/newsapi-client.js` - NewsAPI.ai fetch adapter (server-side key usage)
- `backend/rewrite-variants.js` - Rule-based rewrite generator used at snapshot time
- `backend/rewrite-specs.js` - Canonical variant registry and LLM variant selection (`LLM_VARIANTS`)
- `backend/rewrite-prompts.js` - Prompt catalog used by LLM rewrite mode
- `backend/rewrite-tone-llm.js` - LLM rewrite adapter with per-variant fallback
- `backend/public/variants-dashboard.html` - Browser dashboard for side-by-side variant comparison
- `backend/feed-refresh.js` - Manual/cron refresh trigger (`/feed?refresh=1`)
- `backend/snapshot-query.js` - CLI inspection of stored snapshots and variants
- `docs/analytics-contract.md` - Analytics API contract (v1)
- `state/userIdentity.tsx` - Dev user identity context + persistence
- `styles/news.ts` - Shared styles
- `data/articles.json` - Static article source data

## Run Locally

1. Install dependencies:
```bash
npm install
```

2. Ensure Expo-managed deps are aligned:
```bash
npx expo install expo-router react-native-safe-area-context react-native-screens
npx expo install @react-native-async-storage/async-storage
```

3. Start the app:
```bash
npx expo start
```

## Run Analytics Server (Durable Storage)

1. Start local ingestion server:
```bash
npm run analytics:server
```

2. Ensure app points to server endpoint:
```bash
EXPO_PUBLIC_ANALYTICS_ENDPOINT=http://localhost:8787/events/batch npx expo start
```

3. Verify server health:
```bash
curl http://localhost:8787/health
```

4. Analytics DB location:
- `backend/analytics-events.db`

## Serve Feed From Backend (NewsAPI.ai)

Backend routes (same server as analytics):
- `GET /feed?category=All&limit=5`
- `GET /feed?category=All&limit=5&refresh=1` (bypass cache + daily snapshot)
- `GET /articles/:id`
- `GET /feed/snapshots?date=YYYY-MM-DD`
- `GET /feed/snapshot/:snapshotId`
- `GET /feed/snapshot/today?category=All&limit=5`
- `GET /feed/snapshot/by-date?date=YYYY-MM-DD&category=All&limit=5`
- `GET /feed/snapshot/:snapshotId/article/:articleId/variants`
- `GET /dashboard/variants`

Important:
- Keep your API keys server-side only.
- Do not put it in `EXPO_PUBLIC_*`.

1. Start backend with NewsAPI.ai key:
```bash
NEWSAPI_AI_KEY=your_key_here npm run analytics:server
```

Optional:
- `FEED_CACHE_TTL_MS` (default `300000` = 5 minutes)
- `NEWSAPI_AI_SOURCE_URI` (exact source URI filter)
- `NEWSAPI_AI_SOURCE_KEYWORD` (source lookup keyword for `suggestSources`, default: `Associated Press`)
- `REWRITE_MODE` (`rule_based` default, `tone_llm` for OpenAI rewrites)
- `OPENAI_API_KEY` (required when `REWRITE_MODE=tone_llm`)
- `OPENAI_MODEL` (default `gpt-5-nano-2025-08-07`)
- `OPENAI_TEMPERATURE` (default `1.0`)
- `OPENAI_BASE_URL` (optional, default `https://api.openai.com/v1`)
- `REWRITE_TIMEOUT_MS` (optional, default `120000`)
- `REWRITE_MAX_ATTEMPTS` (optional, default `2`)
- `LLM_VARIANTS` (comma-separated subset of non-regular variants to run via LLM; default `more_positive,more_negative`)
- Example:
```bash
NEWSAPI_AI_KEY=your_key_here FEED_CACHE_TTL_MS=86400000 NEWSAPI_AI_SOURCE_KEYWORD="Associated Press" npm run analytics:server
```
Tone LLM example:
```bash
NEWSAPI_AI_KEY=your_key_here REWRITE_MODE=tone_llm OPENAI_API_KEY=your_openai_key OPENAI_MODEL=gpt-5-nano-2025-08-07 LLM_VARIANTS=more_positive,more_negative npm run analytics:server
```

2. Start app with backend base URL:
```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8787 npx expo start --clear
```

If backend feed fails, the app falls back to local static articles.

Notes:
- Backend feed now defaults to `limit=5` when no limit is provided.
- Feed responses include `cached: true|false` and `cacheTtlMs`.
- Feed is also persisted as a daily SQLite snapshot so all users can receive the same set per day/category/limit.
- In-memory feed cache is day-bounded: cached results are reused only when `cached.snapshotDate` matches the current UTC date.
- Feed category normalization: `General` is treated as `All` for backend requests to avoid separate stale snapshots/caches.
- `GET /health` reports `newsProvider`, configuration status, and active source filter settings.
- `GET /health` also reports rewrite mode and whether tone LLM rewriting is active.
- `GET /health` reports active tone rewrite queue size (`toneRewriteJobsInFlight`).
- `GET /health` reports `allVariantKeys` and `llmEnabledVariants`.
- Feed responses include `snapshotId` and `snapshotDate`.
- Fresh `/feed?...&refresh=1` responses include `toneRewriteQueued` in tone-LLM mode.
- Article fetches accept `snapshotId`/`snapshotDate` so article opens are tied to the exact daily snapshot.
- If rewrite logs show `timed out after ...ms`, the request hit the configured `REWRITE_TIMEOUT_MS`; increase timeout or reduce rewrite volume for debugging.

## Daily Refresh Automation

Manual refresh command:
```bash
npm run feed:refresh
```

Options:
```bash
npm run feed:refresh -- --base-url http://localhost:8787 --category All --limit 5
```

Recommended daily cron (example, 06:00 local time):
```cron
0 6 * * * cd /Users/dominicsobhani/News_Customization_Codex && /usr/bin/npm run feed:refresh >> /tmp/news-feed-refresh.log 2>&1
```

Important:
- Backend server must be running for `feed:refresh` to succeed.

## View Events

### Option A: HTTP endpoint

Get latest events:
```bash
curl "http://localhost:8787/events?limit=20"
```

Filter examples:
```bash
curl "http://localhost:8787/events?limit=50&userId=dominic"
curl "http://localhost:8787/events?eventType=tailor_change"
curl "http://localhost:8787/events?articleId=pol-001"
```

Date filtering (ISO strings):
```bash
curl "http://localhost:8787/events?from=2026-03-03T00:00:00.000Z&to=2026-03-03T23:59:59.999Z"
```

### Option B: CLI table output

Recent 20:
```bash
npm run analytics:events
```

With filters:
```bash
npm run analytics:events -- --limit 50 --user dominic
npm run analytics:events -- --type tailor_change
npm run analytics:events -- --article pol-001
```

`analytics:events` now enriches output with:
- article title/topic/category
- parsed property fields (`field`, `value`, `app_session_id`, `session_seconds`, `snapshot_id`, `snapshot_date`)
- feed response details (`result_count`, `ordered_article_ids`, `source`)

Full feed-response view:
```bash
npm run analytics:events -- --type feed_response --limit 20 --full
```

### See Which Articles Users Clicked

All users:
```bash
npm run analytics:clicks -- --limit 50
```

Single user:
```bash
npm run analytics:clicks -- --user tester1 --limit 50
```

This shows `article_open` events with:
- timestamp
- user id
- article id
- article title
- topic
- category
- feed position
- active variant key
- request id

### Clicks Grouped by App Session

```bash
npm run analytics:session-clicks -- --limit 100
npm run analytics:session-clicks -- --user dominic --limit 100
```

This includes:
- app session id + session timestamps
- clicked article title/topic/category
- click position, request id, read time

## Inspect Stored Historical Feed + Rewrites

Inspect one day/category snapshot:
```bash
npm run feed:snapshot -- --date 2026-03-10 --category All --limit 5
```

Inspect stored variants for a specific article in that snapshot:
```bash
npm run feed:snapshot -- --date 2026-03-10 --category All --limit 5 --article <article_id>
```

If snapshot tables are not initialized yet, start `npm run analytics:server` once to run DB migrations, then retry.

### Summary report

```bash
npm run analytics:summary
```

This prints:
- total events, distinct users, time range
- counts by `event_type`
- counts by user
- counts by user + event type

### Session Duration Report

```bash
npm run analytics:sessions -- --limit 50
```

Filter by user:
```bash
npm run analytics:sessions -- --user tester1 --limit 50
```

This shows:
- `session_start_at`
- `session_end_at`
- `user_id`
- `app_session_id`
- `seconds` (time spent in app for that session)

### Session Narrative Report (Human-Readable)

```bash
npm run analytics:narrative -- --limit 20
```

Filter by user:
```bash
npm run analytics:narrative -- --user tester1 --limit 20
```

This converts raw event streams into session-level summaries like:
- opened feed
- saw impressions
- clicked a specific article (with title/topic/position)
- applied Tailor changes in plain language
- read duration

### Client Queue Controls

Queue status guidance:
```bash
npm run analytics:queue:status
```

Queue clear guidance:
```bash
npm run analytics:queue:clear
```

Notes:
- Client queue is on-device in `AsyncStorage` and cannot be directly manipulated from desktop CLI.
- Clear Expo Go app storage (or reinstall Expo Go) to clear client queue.
- Use `npm run analytics:reset` to clear server-side stored events.

### Reset for clean test runs

```bash
npm run analytics:reset
```

This clears the server-side `events` table in `backend/analytics-events.db`.

Note:
- If your app has a backlog in the client queue (`AsyncStorage`), those queued events can be re-uploaded after reset.
- For a truly clean run, reset DB and then restart/reload the app session before new interactions.

Then open with:
- Expo Go on phone (scan QR)
- iOS Simulator (`i`)
- Android Emulator (`a`)
- Web (`w`)

## Immediate Next Steps

1. Send analytics to durable storage:
  - Add event query/export tools for analysis
  - Add background retry/backoff policy tuning
2. Expand curated static variants for all articles (improve quality consistency)
3. Add candidate-set/feed-response logging for recommender training
4. Add backend article/version APIs and swap service layer from static to remote
