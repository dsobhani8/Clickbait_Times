const TOPIC_CLASSIFIER_METHOD = "keyword_v2";
const TOPIC_CLASSIFIER_ENABLED =
  String(process.env.TOPIC_CLASSIFIER_ENABLED || "true").toLowerCase() !==
  "false";

const FOCUSED_TOPIC_OPTIONS = Object.freeze([
  "Technology",
  "Politics",
  "Economy"
]);
const TOPIC_NONE = "None";
const TOPIC_OPTIONS = FOCUSED_TOPIC_OPTIONS;
const TOPIC_DEFAULT_FILTERS_CSV = TOPIC_OPTIONS.join(",");
const topicCache = new Map();

const SECTION_WEIGHTS = Object.freeze({
  title: 5,
  lead: 3,
  body: 1
});

const KEYWORDS_BY_TOPIC = Object.freeze({
  Technology: Object.freeze([
    "ai",
    "a.i.",
    "artificial intelligence",
    "machine learning",
    "software",
    "technology",
    "tech",
    "internet",
    "online",
    "digital",
    "digital platform",
    "social media",
    "app store",
    "chip",
    "chips",
    "semiconductor",
    "semiconductors",
    "cyber",
    "cyberattack",
    "cybersecurity",
    "hack",
    "hacked",
    "cloud",
    "data center",
    "data centers",
    "smartphone",
    "smartphones",
    "device",
    "devices",
    "startup",
    "startups",
    "tech company",
    "tech giant",
    "algorithm",
    "robot",
    "robots",
    "robotics",
    "automation",
    "electric vehicle",
    "ev",
    "crypto",
    "cryptocurrency",
    "bitcoin",
    "privacy",
    "openai",
    "microsoft",
    "google",
    "apple",
    "meta",
    "tesla",
    "nvidia"
  ]),
  Politics: Object.freeze([
    "election",
    "elections",
    "campaign",
    "campaigns",
    "congress",
    "senate",
    "house of representatives",
    "lawmakers",
    "president",
    "prime minister",
    "government",
    "governments",
    "white house",
    "parliament",
    "supreme court",
    "federal court",
    "appeals court",
    "judge",
    "judges",
    "legislation",
    "bill",
    "policy",
    "policies",
    "diplomacy",
    "diplomatic",
    "governor",
    "mayor",
    "vote",
    "voting",
    "cabinet",
    "minister",
    "ministry",
    "sanctions"
  ]),
  Economy: Object.freeze([
    "inflation",
    "prices",
    "jobs",
    "job market",
    "unemployment",
    "gdp",
    "interest rate",
    "interest rates",
    "federal reserve",
    "central bank",
    "stock market",
    "stocks",
    "shares",
    "earnings",
    "revenue",
    "profit",
    "profits",
    "trade",
    "tariff",
    "tariffs",
    "economy",
    "economic",
    "economic growth",
    "recession",
    "consumer spending",
    "layoffs",
    "demand",
    "business conditions",
    "small business",
    "sba loan",
    "loans",
    "mortgage",
    "housing market",
    "manufacturing",
    "factory activity"
  ])
});

const NONE_KEYWORDS = Object.freeze([
  "sports",
  "football",
  "basketball",
  "baseball",
  "mlb",
  "nba",
  "nfl",
  "nhl",
  "wnba",
  "soccer",
  "tennis",
  "golf",
  "hockey",
  "tournament",
  "coach",
  "player",
  "players",
  "team",
  "teams",
  "game",
  "match",
  "season",
  "umpire",
  "ejection",
  "pitch",
  "pitcher",
  "automated ball-strike",
  "ball-strike",
  "abs review",
  "abs reviews",
  "movie",
  "movies",
  "music",
  "album",
  "celebrity",
  "fashion",
  "travel",
  "weather",
  "storm",
  "hurricane",
  "earthquake",
  "crime",
  "police",
  "shooting",
  "murder",
  "hospital",
  "disease",
  "virus",
  "health",
  "wildfire",
  "accident",
  "crash"
]);

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
  return TOPIC_NONE;
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(text, phrase) {
  const normalizedText = typeof text === "string" ? text.toLowerCase() : "";
  const normalizedPhrase = typeof phrase === "string" ? phrase.trim().toLowerCase() : "";
  if (!normalizedText || !normalizedPhrase) {
    return 0;
  }

  const escapedPhrase = escapeRegExp(normalizedPhrase).replace(/\s+/g, "\\s+");
  const pattern = new RegExp(`\\b${escapedPhrase}\\b`, "g");
  const matches = normalizedText.match(pattern);
  return Array.isArray(matches) ? matches.length : 0;
}

function buildSections(article) {
  const title = typeof article?.title === "string" ? article.title : "";
  const lead = typeof article?.lead === "string" ? article.lead : "";
  const body = Array.isArray(article?.body)
    ? article.body
        .filter((entry) => typeof entry === "string")
        .slice(0, 4)
        .join("\n")
    : "";

  return { title, lead, body };
}

function scoreText(text, keywords, weight) {
  let score = 0;
  const matchedKeywords = [];

  for (const keyword of keywords) {
    const occurrences = countOccurrences(text, keyword);
    if (occurrences <= 0) continue;
    score += occurrences * weight;
    matchedKeywords.push(keyword);
  }

  return {
    score,
    matchedKeywords
  };
}

function mergeUnique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function classifyWithKeywords(article) {
  const sections = buildSections(article);
  const topicScores = {};
  const topicKeywordsMatched = {};

  for (const topic of TOPIC_OPTIONS) {
    const keywords = KEYWORDS_BY_TOPIC[topic] || [];
    const titleScore = scoreText(sections.title, keywords, SECTION_WEIGHTS.title);
    const leadScore = scoreText(sections.lead, keywords, SECTION_WEIGHTS.lead);
    const bodyScore = scoreText(sections.body, keywords, SECTION_WEIGHTS.body);

    topicScores[topic] = titleScore.score + leadScore.score + bodyScore.score;
    topicKeywordsMatched[topic] = mergeUnique([
      ...titleScore.matchedKeywords,
      ...leadScore.matchedKeywords,
      ...bodyScore.matchedKeywords
    ]);
  }

  const noneTitleScore = scoreText(sections.title, NONE_KEYWORDS, SECTION_WEIGHTS.title);
  const noneLeadScore = scoreText(sections.lead, NONE_KEYWORDS, SECTION_WEIGHTS.lead);
  const noneBodyScore = scoreText(sections.body, NONE_KEYWORDS, SECTION_WEIGHTS.body);
  const noneScore = noneTitleScore.score + noneLeadScore.score + noneBodyScore.score;

  const rankedTopics = Object.entries(topicScores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  const [topTopicEntry, secondTopicEntry] = rankedTopics;
  const topTopic = topTopicEntry?.[0] || TOPIC_NONE;
  const topScore = Number(topTopicEntry?.[1] || 0);
  const secondScore = Number(secondTopicEntry?.[1] || 0);

  let topic = TOPIC_NONE;
  if (
    topScore > 0 &&
    topScore > secondScore &&
    topScore > noneScore
  ) {
    topic = topTopic;
  }

  return {
    topic,
    tag: normalizeTag(topicKeywordsMatched[topic]?.[0]) || fallbackTag(article, topic)
  };
}

async function classifyArticleMetadata(article) {
  const cacheKey =
    typeof article?.id === "string" && article.id.length > 0
      ? article.id
      : `${article?.title || ""}::${article?.publishedAt || ""}`;
  if (topicCache.has(cacheKey)) {
    return topicCache.get(cacheKey);
  }

  if (!TOPIC_CLASSIFIER_ENABLED) {
    throw new Error("Topic classifier is disabled.");
  }

  const classification = classifyWithKeywords(article);
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
  TOPIC_CLASSIFIER_METHOD,
  TOPIC_CLASSIFIER_ENABLED,
  classifyArticleMetadata,
  classifyArticleTopic,
  normalizeTopic,
  parseTopicListCsv
};
