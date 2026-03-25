# Analytics API Contract (v1)

Schema version: `1`

## Endpoint

- `POST /events/batch`

## Request Body

```json
{
  "schemaVersion": 1,
  "events": [
    {
      "eventId": "evt_abc123",
      "schemaVersion": 1,
      "eventType": "impression",
      "timestamp": "2026-03-03T12:00:00.000Z",
      "userId": "dominic",
      "sessionId": "session_xyz",
      "surface": "home_feed",
      "requestId": "req_123",
      "articleId": "pol-001",
      "variantKey": "regular",
      "position": 1,
      "properties": {
        "category": "All",
        "resultCount": 6,
        "orderedArticleIds": ["pol-001", "eco-001", "us-001"],
        "rankScores": null
      }
    }
  ]
}
```

## Required Event Fields

- `eventId` (`string`)
- `schemaVersion` (`number`, must be `1`)
- `eventType` (`string`)
- `timestamp` (`ISO string`)
- `userId` (`string`)
- `sessionId` (`string`)

## Optional Event Fields

- `surface` (`home_feed` | `article`)
- `requestId` (`string`)
- `articleId` (`string`)
- `variantKey` (`string`)
- `position` (`number`)
- `properties` (`object`)
  - For `feed_response`, include:
    - `resultCount` (`number`)
    - `orderedArticleIds` (`string[]`)
    - `rankScores` (`number[] | null`)

## Response

```json
{
  "ok": true,
  "schemaVersion": 1,
  "accepted": 42,
  "duplicates": 3,
  "rejectedCount": 0,
  "rejected": []
}
```

Notes:
- Duplicate `eventId` values are ignored by the database (`INSERT OR IGNORE`).
- Invalid events are returned in `rejected` with index and error.
