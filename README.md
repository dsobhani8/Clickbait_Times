# TailorMadeTimes

Mobile news experiment app with:
- Expo / React Native frontend
- Node / Express backend
- Supabase Auth and Postgres
- Render deployment

## Public Pipeline

### 1. Retrieval
- Provider code: `backend/newsapi-client.js`
- Source: NewsAPI.ai / Event Registry
- Endpoint: `https://eventregistry.org/api/v1/article/getArticles`
- Production source filter: `NEWSAPI_AI_SOURCE_URI=apnews.com`
- The backend fetches a broad recent AP pool for the canonical `All` feed. It does not rely on provider-side topic keywords.

### 2. Eligibility Filtering
- Selection logic: `backend/events-server.js`
- Articles are filtered before selection using:
  - `FEED_MIN_WORDS`
  - `FEED_MAX_WORDS`

### 3. Topic Classification
- Classifier code: `backend/topic-classifier.js`
- Active method: keyword gate + LLM classifier
  - constant: `TOPIC_CLASSIFIER_METHOD`
- Allowed labels:
  - `Technology`
  - `Politics`
  - `Economy`
  - `None`
- The classifier uses:
  - title
  - lead
  - first few body paragraphs
- A weighted keyword pass first removes obvious out-of-scope articles.
- Articles that pass the keyword gate are then classified by the LLM.
- If the LLM fails, the backend falls back to the keyword classification.

### 4. Feed Selection
- Orchestration: `backend/events-server.js`
- The backend:
  - classifies the AP candidate pool
  - buckets articles by topic
  - selects `FEED_PER_TOPIC_TARGET` articles per topic
- Freshness policy:
  - fresh-first with stale fallback
  - controlled by `FEED_FRESH_ARTICLE_MAX_AGE_HOURS`

### 5. Snapshot Storage
- The backend writes the selected feed into Postgres tables:
  - `feed_snapshots`
  - `snapshot_articles`
  - `snapshot_article_variants`
  - `current_snapshots`
  - `rewrite_jobs`
- `/feed` serves the current published snapshot rather than rebuilding on every request.

### 6. Rewrite Pipeline
- Rewrite orchestration:
  - `backend/rewrite-tone-llm.js`
  - `backend/rewrite-prompts.js`
  - `backend/rewrite-specs.js`
- Prompt source of truth:
  - `prompts/runtime/`

Current staged rewrite flow per selected article:

```text
Original article
  ├─ regular = original
  └─ facts_only
       ├─ facts-only body rewrite
       └─ facts-only title + lead
            └─ clickbait
                 ├─ clickbait title + lead
                 └─ clickbait body rewrite
```

## Prompt Locations

### Topic Classification
- `backend/topic-classifier.js`
  - keyword gate
  - inline LLM classifier prompt
  - no separate runtime prompt file

### Rewrite Prompts
- Prompt wiring:
  - `backend/rewrite-prompts.js`
- Runtime prompt directory:
  - `prompts/runtime/README.md`
- Active runtime prompt files:
  - `prompts/runtime/regular_body_rewrite.py`
  - `prompts/runtime/regular_title_lead_rewrite.py`
  - `prompts/runtime/clickbait_title_lead_rewrite.py`
  - `prompts/runtime/clickbait_body_rewrite.py`
