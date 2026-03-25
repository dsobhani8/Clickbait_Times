import AsyncStorage from "@react-native-async-storage/async-storage";

export const ANALYTICS_SCHEMA_VERSION = 1;
const ANALYTICS_QUEUE_STORAGE_KEY = "analytics_event_queue_v1";
const DEFAULT_ANALYTICS_ENDPOINT = "http://localhost:8787/events/batch";
const BATCH_SIZE = 10;
const MAX_QUEUE_SIZE = 5000;
const UPLOAD_TIMEOUT_MS = 20000;

export type AnalyticsEventType =
  | "app_session_start"
  | "app_session_end"
  | "feed_request"
  | "feed_response"
  | "impression"
  | "article_click"
  | "article_open"
  | "tailor_open"
  | "tailor_change"
  | "variant_applied"
  | "read_time";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type AnalyticsEvent = {
  eventId: string;
  schemaVersion: number;
  eventType: AnalyticsEventType;
  timestamp: string;
  userId: string;
  sessionId: string;
  surface?: "home_feed" | "article";
  requestId?: string;
  articleId?: string;
  variantKey?: string;
  position?: number;
  properties?: Record<string, JsonValue>;
};

export type AnalyticsBatchRequest = {
  schemaVersion: number;
  events: AnalyticsEvent[];
};

type TrackEventInput = Omit<
  AnalyticsEvent,
  "eventId" | "timestamp" | "sessionId" | "schemaVersion"
>;

const sessionId = createId("session");
let queue: AnalyticsEvent[] = [];
let queueLoaded = false;
let queueLoadPromise: Promise<void> | null = null;
let flushInFlight = false;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let endpointUrl = process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT ?? DEFAULT_ANALYTICS_ENDPOINT;

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

export function createRequestId() {
  return createId("req");
}

function trimQueue(nextQueue: AnalyticsEvent[]) {
  if (nextQueue.length <= MAX_QUEUE_SIZE) {
    return nextQueue;
  }

  return nextQueue.slice(nextQueue.length - MAX_QUEUE_SIZE);
}

async function ensureQueueLoaded() {
  if (queueLoaded) {
    return;
  }

  if (queueLoadPromise) {
    await queueLoadPromise;
    return;
  }

  queueLoadPromise = (async () => {
    try {
      const stored = await AsyncStorage.getItem(ANALYTICS_QUEUE_STORAGE_KEY);
      if (!stored) {
        queue = [];
        return;
      }

      const parsed = JSON.parse(stored) as AnalyticsEvent[];
      queue = Array.isArray(parsed) ? trimQueue(parsed) : [];
    } catch {
      queue = [];
    } finally {
      queueLoaded = true;
      queueLoadPromise = null;
    }
  })();

  await queueLoadPromise;
}

async function persistQueue() {
  await AsyncStorage.setItem(
    ANALYTICS_QUEUE_STORAGE_KEY,
    JSON.stringify(queue)
  );
}

async function enqueue(event: AnalyticsEvent) {
  await ensureQueueLoaded();
  queue = trimQueue([...queue, event]);
  await persistQueue();
}

export async function flushAnalyticsQueue() {
  await ensureQueueLoaded();
  if (flushInFlight || queue.length === 0) {
    return;
  }

  flushInFlight = true;
  try {
    while (queue.length > 0) {
      const batch = queue.slice(0, BATCH_SIZE);
      const payload: AnalyticsBatchRequest = {
        schemaVersion: ANALYTICS_SCHEMA_VERSION,
        events: batch
      };

      console.log(
        `[analytics-upload] attempt endpoint=${endpointUrl} batch=${batch.length} queued=${queue.length}`
      );

      let response: Response;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
      try {
        response = await fetch(endpointUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } catch (error) {
        clearTimeout(timeout);
        console.warn(
          `[analytics-upload] network error endpoint=${endpointUrl} queued=${queue.length}:`,
          error
        );
        break;
      }
      clearTimeout(timeout);

      if (!response.ok) {
        let responseBody = "";
        try {
          responseBody = await response.text();
        } catch {
          responseBody = "<unreadable body>";
        }
        console.warn(
          `[analytics-upload] failed status=${response.status} endpoint=${endpointUrl} queued=${queue.length} body=${responseBody}`
        );
        break;
      }

      console.log(
        `[analytics-upload] success endpoint=${endpointUrl} uploaded=${batch.length} remaining=${Math.max(
          0,
          queue.length - batch.length
        )}`
      );
      queue = queue.slice(batch.length);
      await persistQueue();
    }
  } catch {
    // Keep events in queue for retry.
  } finally {
    flushInFlight = false;
  }
}

export function configureAnalyticsEndpoint(url: string) {
  endpointUrl = url;
}

export function initializeAnalytics() {
  void ensureQueueLoaded();
  if (!flushTimer) {
    flushTimer = setInterval(() => {
      void flushAnalyticsQueue();
    }, 10000);
  }

  void flushAnalyticsQueue();
}

export function stopAnalytics() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

export function trackEvent(input: TrackEventInput) {
  const event: AnalyticsEvent = {
    eventId: createId("evt"),
    schemaVersion: ANALYTICS_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    sessionId,
    ...input
  };

  console.log("[analytics]", JSON.stringify(event));
  void enqueue(event).then(() => {
    console.log(`[analytics-queue] queued=${queue.length}`);
    void flushAnalyticsQueue();
  });
}

export async function getQueuedAnalyticsEvents() {
  await ensureQueueLoaded();
  return [...queue];
}

export async function getAnalyticsQueueStatus() {
  await ensureQueueLoaded();
  const oldestTimestamp = queue.length > 0 ? queue[0].timestamp : null;
  const newestTimestamp =
    queue.length > 0 ? queue[queue.length - 1].timestamp : null;

  return {
    queuedCount: queue.length,
    oldestTimestamp,
    newestTimestamp
  };
}

export async function clearAnalyticsQueue() {
  await ensureQueueLoaded();
  queue = [];
  await persistQueue();
}
