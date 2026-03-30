# TailorMadeTimes Ops Runbook

## Morning check

1. Open the ops dashboard:

```text
https://clickbait-times.onrender.com/dashboard/ops
```

2. Enter the admin token.

3. Confirm:
- `Published Snapshot -> Date` is today
- `Today's Snapshot -> Status` is `ready`
- `Rewrite Jobs -> Today Failed` is `0`

## CLI checks

Health:

```bash
curl -s "https://clickbait-times.onrender.com/health" | jq '{rewriteMode,toneLlmEnabled,dailyRefreshEnabled,dailyRefreshLastAttemptAt,dailyRefreshLastSuccessDate,rewriteJobsPending,rewriteJobsRunning,rewriteJobsFailed}'
```

Current published feed:

```bash
curl -s "https://clickbait-times.onrender.com/feed?category=All" | jq '{snapshotId,snapshotDate,count,cached}'
```

Authenticated ops summary:

```bash
curl -s "https://clickbait-times.onrender.com/admin/ops/summary?category=All" \
  -H "x-admin-token: $PIPELINE_ADMIN_TOKEN" | jq
```

## Force a rebuild

Use this only if today's snapshot is missing, stale, or was built under the wrong rewrite settings.

```bash
curl -s -X POST \
  -H "x-admin-token: $PIPELINE_ADMIN_TOKEN" \
  "https://clickbait-times.onrender.com/admin/pipeline/run?category=All&rebuild=1" | jq '{ok,rebuildRequested,error,upstream}'
```

## Interpret common states

### Feed is current
- published snapshot date is today
- today's snapshot status is `ready`
- rewrite failures are `0`

### Feed is stale
- published snapshot date is yesterday or older
- today's snapshot is missing or still `building`

### Rewrite issue
- today's snapshot exists
- but rewrite failures are nonzero
- inspect `snapshot_article_variants` and Render logs

## App-side failure behavior

If the backend is configured and unavailable, the app now:
- shows a feed load error
- shows a retry button
- does not silently fall back to bundled prototype content
