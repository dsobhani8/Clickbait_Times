const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const TOPIC_CLASSIFIER_MODEL =
  process.env.TOPIC_CLASSIFIER_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-5-mini-2025-08-07";
const TOPIC_CLASSIFIER_PROFILE = "focused";
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
const TOPIC_NONE = "None";
const TOPIC_OPTIONS = FOCUSED_TOPIC_OPTIONS;
const TOPIC_DEFAULT_FILTERS_CSV = TOPIC_OPTIONS.join(",");
const topicCache = new Map();
const TECHNOLOGY_KEYWORDS = Object.freeze([
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
]);
const POLITICS_KEYWORDS = Object.freeze([
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
]);
const ECONOMY_KEYWORDS = Object.freeze([
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
]);

const TOPIC_CLASSIFIER_SYSTEM_PROMPT = [
  "You are classifying a news article into exactly one primary topic.",
  `Allowed labels: ${TOPIC_OPTIONS.join(", ")}, ${TOPIC_NONE}.`,
  "",
  "Decision rule:",
  "- Pick the one label that best matches the article's central news angle.",
  "- Ignore brief mentions, background context, secondary themes, and downstream effects.",
  `- Use "${TOPIC_NONE}" when the main subject is not primarily ${TOPIC_OPTIONS.join(", ")}, including sports, entertainment, lifestyle, health, crime, weather, culture, science without a clear technology angle, or general world news outside the allowed labels.`,
  "",
  "Label definitions:",
  '- "Technology": the article is mainly about software, hardware, AI, cybersecurity, semiconductors, consumer devices, tech companies, startups, or digital platforms.',
  '- "Politics": the article is mainly about governments, elections, campaigns, public officials, legislation, courts, public policy, diplomacy, or political power.',
  '- "Economy": the article is mainly about inflation, jobs, unemployment, GDP, interest rates, central banks, markets, earnings, trade, business conditions, or macroeconomic trends.',
  "",
  "Tie-breakers:",
  '- If the story is about a government action, election, law, or political dispute, choose "Politics" even if it affects the economy or technology.',
  '- If the story is about markets, inflation, jobs, company earnings, or economic conditions, choose "Economy" unless the core event is primarily political.',
  '- If the story is about a product, platform, AI model, cyber incident, chipmaker, or tech company operation, choose "Technology" unless the core event is primarily political or macroeconomic.',
  '- For company news, choose "Technology" only when the company is a tech company and the article is mainly about its technology, products, platforms, or operations; choose "Economy" when the focus is earnings, stock moves, layoffs, demand, or broader business conditions.',
  "",
  "Output requirements:",
  '- Return exactly one JSON object and no other text.',
  '- Use this format: {"topic":"<label>"}'
].join("\n");

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
    normalized === "none" ||
    normalized === "none_of_the_above" ||
    normalized === "other"
  ) {
    return TOPIC_NONE;
  }

  // Fuzzy matches for verbose model outputs (e.g., "Category: Economy")
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

  const score = {
    Technology: scoreKeywords(text, TECHNOLOGY_KEYWORDS),
    Politics: scoreKeywords(text, POLITICS_KEYWORDS),
    Economy: scoreKeywords(text, ECONOMY_KEYWORDS)
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
            content: TOPIC_CLASSIFIER_SYSTEM_PROMPT
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
    const topicCandidate = normalizeTopic(parsed?.topic || parsed?.category);
    const topic = TOPIC_OPTIONS.includes(topicCandidate)
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
