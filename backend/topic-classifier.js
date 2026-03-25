const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const TOPIC_CLASSIFIER_MODEL =
  process.env.TOPIC_CLASSIFIER_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-5-mini-2025-08-07";
const TOPIC_CLASSIFIER_PROFILE_RAW =
  process.env.TOPIC_CLASSIFIER_PROFILE ||
  process.env.TOPIC_CLASSIFIER_PROMPT_PROFILE ||
  "focused";
const TOPIC_CLASSIFIER_PROFILE =
  String(TOPIC_CLASSIFIER_PROFILE_RAW).trim().toLowerCase() === "modules"
    ? "modules"
    : "focused";
const TOPIC_CLASSIFIER_ENABLED =
  String(process.env.TOPIC_CLASSIFIER_ENABLED || "true").toLowerCase() !==
  "false";
const TOPIC_CLASSIFIER_TIMEOUT_MS_RAW = Number(
  process.env.TOPIC_CLASSIFIER_TIMEOUT_MS || 30000
);
const TOPIC_CLASSIFIER_TIMEOUT_MS = Number.isFinite(
  TOPIC_CLASSIFIER_TIMEOUT_MS_RAW
)
  ? Math.max(5000, TOPIC_CLASSIFIER_TIMEOUT_MS_RAW)
  : 30000;

const FOCUSED_TOPIC_OPTIONS = Object.freeze([
  "Technology",
  "Politics",
  "Economy"
]);
const MODULES_TOPIC_OPTIONS = Object.freeze([
  "Politics",
  "Economy",
  "U.S.",
  "World",
  "Lifestyle",
  "Sports"
]);
const TOPIC_NONE = "None";
const TOPIC_OPTIONS =
  TOPIC_CLASSIFIER_PROFILE === "modules"
    ? MODULES_TOPIC_OPTIONS
    : FOCUSED_TOPIC_OPTIONS;
const TOPIC_DEFAULT_FILTERS_CSV = TOPIC_OPTIONS.join(",");
const topicCache = new Map();

const FOCUSED_SYSTEM_PROMPT = [
  "Classify a news article into exactly one topic label.",
  `Allowed labels: ${FOCUSED_TOPIC_OPTIONS.join(", ")}, ${TOPIC_NONE}.`,
  "Use None when the article is not primarily about Technology, Politics, or Economy.",
  "Return only JSON with key: topic."
].join(" ");

const MODULES_SYSTEM_PROMPT = [
  "You have two tasks:",
  "1) Assign the most relevant category to the given article.",
  "2) Assign the most relevant tag to the given article.",
  "",
  "Categories to choose from:",
  "- Politics: News related to politics and government in the United States (e.g. news about a new law).",
  "- Economy: News related to business and the economy in the United States (e.g. news about inflation, the stock market or also business news).",
  "- U.S.: News related to events happening in the United States (e.g. a plane crash).",
  "- World: News related to events happening outside the United States (e.g. an election in Venezuela or war in the middle east).",
  "- Lifestyle: News related to lifestyle and culture (e.g. news about Taylor Swift).",
  "- Sports: News related to sports (e.g. news about Football).",
  "",
  "Tag guidelines:",
  "- There is no fixed list of tags; create a fitting tag from scratch.",
  "- The tag should be more specific than the category.",
  "- The tag should be a single word or a very short phrase.",
  "- The tag should be informative to the reader but not too specific.",
  "",
  "Examples:",
  "- Plane crash in the United States -> category: U.S., tag: Plane Accident",
  "- New law in the United States -> category: Politics, tag: New Legislation",
  "- Presidential race 2024 in the United States -> category: Politics, tag: Election 2024",
  "",
  "Return only JSON with keys: category and tag."
].join(" ");

function extractMessageContent(messageContent) {
  if (typeof messageContent === "string") {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry.text === "string") return entry.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function sanitizeModelOutput(text) {
  if (typeof text !== "string") return "";
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return trimmed;
}

function parseJsonObject(text) {
  const cleaned = sanitizeModelOutput(text);
  if (!cleaned) return null;
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function coerceToString(value) {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    for (const entry of value) {
      if (typeof entry === "string" && entry.trim().length > 0) {
        return entry;
      }
      if (entry && typeof entry === "object") {
        if (typeof entry.value === "string" && entry.value.trim().length > 0) {
          return entry.value;
        }
        if (typeof entry.label === "string" && entry.label.trim().length > 0) {
          return entry.label;
        }
      }
    }
  }
  return "";
}

function normalizeTopic(value) {
  const normalized = coerceToString(value).trim().toLowerCase();
  if (normalized === "technology" || normalized === "tech") {
    return "Technology";
  }
  if (normalized === "politics" || normalized === "political") {
    return "Politics";
  }
  if (
    normalized === "economy" ||
    normalized === "economic" ||
    normalized === "economics" ||
    normalized === "finance" ||
    normalized === "business"
  ) {
    return "Economy";
  }
  if (
    normalized === "u.s." ||
    normalized === "u.s" ||
    normalized === "us" ||
    normalized === "u_s" ||
    normalized === "united states"
  ) {
    return "U.S.";
  }
  if (
    normalized === "world" ||
    normalized === "international" ||
    normalized === "global"
  ) {
    return "World";
  }
  if (
    normalized === "lifestyle" ||
    normalized === "culture" ||
    normalized === "entertainment"
  ) {
    return "Lifestyle";
  }
  if (normalized === "sports" || normalized === "sport") {
    return "Sports";
  }
  if (
    normalized === "none" ||
    normalized === "none_of_the_above" ||
    normalized === "other"
  ) {
    return TOPIC_NONE;
  }

  // Fuzzy matches for verbose model outputs (e.g., "Category: Sports")
  if (normalized.includes("sport")) {
    return "Sports";
  }
  if (normalized.includes("polit")) {
    return "Politics";
  }
  if (
    normalized.includes("econom") ||
    normalized.includes("business") ||
    normalized.includes("finance")
  ) {
    return "Economy";
  }
  if (
    normalized.includes("u.s") ||
    normalized.includes("united states") ||
    /\bus\b/.test(normalized)
  ) {
    return "U.S.";
  }
  if (normalized.includes("world") || normalized.includes("international")) {
    return "World";
  }
  if (normalized.includes("lifestyle") || normalized.includes("culture")) {
    return "Lifestyle";
  }
  if (normalized.includes("tech")) {
    return "Technology";
  }

  return TOPIC_NONE;
}

function buildArticleInput(article) {
  const body = Array.isArray(article?.body)
    ? article.body.filter((entry) => typeof entry === "string").slice(0, 4)
    : [];
  return {
    title: typeof article?.title === "string" ? article.title : "",
    lead: typeof article?.lead === "string" ? article.lead : "",
    body
  };
}

function normalizeTag(value) {
  const raw = coerceToString(value);
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  return normalized.slice(0, 60);
}

function fallbackTag(article, topic) {
  const title =
    typeof article?.title === "string" ? article.title.trim() : "";
  if (title.length > 0) {
    const words = title.split(/\s+/).slice(0, 4).join(" ");
    if (words) return words;
  }
  if (topic && topic !== TOPIC_NONE) {
    return topic;
  }
  return "General News";
}

function scoreKeywords(text, keywords) {
  let score = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) score += 1;
  }
  return score;
}

function heuristicClassification(article) {
  const text = [
    article?.title || "",
    article?.lead || "",
    ...(Array.isArray(article?.body) ? article.body : [])
  ]
    .join(" ")
    .toLowerCase();

  if (TOPIC_CLASSIFIER_PROFILE === "modules") {
    const score = {
      Politics: scoreKeywords(text, [
        "election",
        "congress",
        "senate",
        "parliament",
        "president",
        "prime minister",
        "campaign",
        "lawmakers",
        "government",
        "supreme court"
      ]),
      Economy: scoreKeywords(text, [
        "inflation",
        "gdp",
        "jobs",
        "unemployment",
        "interest rate",
        "federal reserve",
        "stock market",
        "earnings",
        "economy",
        "recession"
      ]),
      "U.S.": scoreKeywords(text, [
        "united states",
        "u.s.",
        "us",
        "state",
        "county",
        "governor",
        "city council"
      ]),
      World: scoreKeywords(text, [
        "international",
        "foreign",
        "europe",
        "asia",
        "africa",
        "middle east",
        "ukraine",
        "israel"
      ]),
      Lifestyle: scoreKeywords(text, [
        "lifestyle",
        "culture",
        "music",
        "movie",
        "fashion",
        "food",
        "travel",
        "celebrity"
      ]),
      Sports: scoreKeywords(text, [
        "sports",
        "football",
        "basketball",
        "soccer",
        "baseball",
        "hockey",
        "tournament",
        "coach"
      ])
    };

    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    const topic = !best || best[1] <= 0 ? TOPIC_NONE : best[0];
    return {
      topic,
      tag: fallbackTag(article, topic)
    };
  }

  const score = {
    Technology: scoreKeywords(text, [
      "ai",
      "artificial intelligence",
      "software",
      "chip",
      "semiconductor",
      "smartphone",
      "cyber",
      "startup",
      "technology",
      "tech company"
    ]),
    Politics: scoreKeywords(text, [
      "election",
      "congress",
      "senate",
      "parliament",
      "president",
      "prime minister",
      "campaign",
      "lawmakers",
      "government",
      "policy vote"
    ]),
    Economy: scoreKeywords(text, [
      "inflation",
      "gdp",
      "jobs",
      "unemployment",
      "interest rate",
      "federal reserve",
      "stock market",
      "earnings",
      "economy",
      "recession"
    ])
  };
  const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  const topic = !best || best[1] <= 0 ? TOPIC_NONE : best[0];
  return {
    topic,
    tag: fallbackTag(article, topic)
  };
}

async function classifyWithLlm(article) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TOPIC_CLASSIFIER_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: TOPIC_CLASSIFIER_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              TOPIC_CLASSIFIER_PROFILE === "modules"
                ? MODULES_SYSTEM_PROMPT
                : FOCUSED_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: JSON.stringify(buildArticleInput(article))
          }
        ]
      }),
      signal: controller.signal
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `Topic classification failed: ${response.status} ${response.statusText} - ${text}`
      );
    }

    let payload = null;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }

    const content = extractMessageContent(payload?.choices?.[0]?.message?.content);
    const parsed = parseJsonObject(content);
    if (TOPIC_CLASSIFIER_PROFILE === "modules") {
      const category = normalizeTopic(parsed?.category || parsed?.topic);
      const topic = MODULES_TOPIC_OPTIONS.includes(category) ? category : TOPIC_NONE;
      return {
        topic,
        tag: normalizeTag(parsed?.tag) || fallbackTag(article, topic)
      };
    }

    const topicCandidate = normalizeTopic(parsed?.topic || parsed?.category);
    const topic = FOCUSED_TOPIC_OPTIONS.includes(topicCandidate)
      ? topicCandidate
      : TOPIC_NONE;
    return {
      topic,
      tag: normalizeTag(parsed?.tag) || fallbackTag(article, topic)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function classifyArticleMetadata(article) {
  const cacheKey =
    typeof article?.id === "string" && article.id.length > 0
      ? article.id
      : `${article?.title || ""}::${article?.publishedAt || ""}`;
  if (topicCache.has(cacheKey)) {
    return topicCache.get(cacheKey);
  }

  let classification = { topic: TOPIC_NONE, tag: fallbackTag(article, TOPIC_NONE) };
  if (TOPIC_CLASSIFIER_ENABLED && OPENAI_API_KEY) {
    try {
      classification = await classifyWithLlm(article);
    } catch {
      classification = heuristicClassification(article);
    }
  } else {
    classification = heuristicClassification(article);
  }

  topicCache.set(cacheKey, classification);
  return classification;
}

async function classifyArticleTopic(article) {
  const classification = await classifyArticleMetadata(article);
  return classification.topic;
}

function parseTopicListCsv(value) {
  const raw =
    typeof value === "string" && value.trim().length > 0
      ? value
      : TOPIC_OPTIONS.join(",");
  const entries = raw.split(",").map((entry) => normalizeTopic(entry));
  const filtered = entries.filter((entry) => TOPIC_OPTIONS.includes(entry));
  if (filtered.length === 0) {
    return [...TOPIC_OPTIONS];
  }
  return Array.from(new Set(filtered));
}

module.exports = {
  TOPIC_OPTIONS,
  TOPIC_DEFAULT_FILTERS_CSV,
  TOPIC_NONE,
  TOPIC_CLASSIFIER_MODEL,
  TOPIC_CLASSIFIER_PROFILE,
  TOPIC_CLASSIFIER_ENABLED,
  classifyArticleMetadata,
  classifyArticleTopic,
  normalizeTopic,
  parseTopicListCsv
};
