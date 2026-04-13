const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const FEED_SELECTOR_MODEL =
  process.env.FEED_SELECTOR_MODEL ||
  process.env.TOPIC_CLASSIFIER_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-5-nano";
const FEED_SELECTOR_METHOD =
  process.env.FEED_SELECTOR_METHOD || "llm_bucket_selector_v1";
const FEED_SELECTOR_ENABLED =
  String(process.env.FEED_SELECTOR_ENABLED || "true").toLowerCase() !== "false";
const FEED_SELECTOR_TIMEOUT_MS_RAW = Number(
  process.env.FEED_SELECTOR_TIMEOUT_MS || 45000
);
const FEED_SELECTOR_TIMEOUT_MS = Number.isFinite(FEED_SELECTOR_TIMEOUT_MS_RAW)
  ? Math.max(5000, FEED_SELECTOR_TIMEOUT_MS_RAW)
  : 45000;
const FEED_SELECTOR_CANDIDATES_PER_TOPIC_RAW = Number(
  process.env.FEED_SELECTOR_CANDIDATES_PER_TOPIC || 60
);
const FEED_SELECTOR_CANDIDATES_PER_TOPIC = Number.isFinite(
  FEED_SELECTOR_CANDIDATES_PER_TOPIC_RAW
)
  ? Math.max(1, Math.min(200, Math.round(FEED_SELECTOR_CANDIDATES_PER_TOPIC_RAW)))
  : 60;

const FEED_SELECTOR_SYSTEM_PROMPT = [
  "You are selecting articles for a mobile news experiment feed.",
  "",
  "You will receive one topic bucket and a list of candidate AP articles with title, lead, body preview, publication time, freshness, and provider rank.",
  "Select the best articles for the feed from that bucket.",
  "",
  "Primary goal:",
  "- Choose public-interest hard-news articles with strong potential for serious mainstream sensationalized framing.",
  "- Prefer stories about US public affairs, politics, world affairs, military conflict, security, technology with public stakes, markets, trade, inflation, energy, courts, policy, diplomacy, and major institutions.",
  "",
  "Reject:",
  "- sports, game previews, recaps, standings, player/team stories, tournaments, and sports business unless the core story is genuinely public policy or macroeconomics",
  "- movies, TV, celebrity, music, fashion, food, lifestyle, travel, arts listings, and entertainment interviews",
  "- social-news filler, oddities, soft features, service journalism, schedules, explainers with little news value, and local human-interest items",
  "- article records where the title, lead, and body preview appear to describe different stories",
  "",
  "Topic-specific guidance:",
  '- "Politics": government, elections, courts, public officials, legislation, policy, diplomacy, political conflict, military decisions, or state power.',
  '- "Economy": inflation, jobs, markets, trade, tariffs, business conditions, earnings, energy prices, central banks, or macroeconomic stakes.',
  '- "US": domestic US public-interest hard news after ruling out Politics and Economy. Prefer institutions, public safety, military, technology, courts, disasters, health systems, and infrastructure over lifestyle or social filler.',
  '- "World": non-US public-interest hard news after ruling out Politics and Economy. Prefer war, military, diplomacy, major disasters, institutions, technology, public safety, and international crises over sports or entertainment.',
  "",
  "Freshness:",
  "- Prefer fresher articles when quality is similar.",
  "- A slightly older hard-news article is better than a fresh sports, celebrity, entertainment, or lifestyle article.",
  "",
  "Output requirements:",
  "- Return exactly one JSON object and no other text.",
  '- Use this format: {"selected":[{"id":"<input id>","reason":"short reason"}]}',
  "- Select at most the requested target count.",
  "- Preserve input ids exactly.",
  "- If there are fewer suitable articles than requested, select fewer."
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
  return typeof value === "string" ? value.trim() : "";
}

function truncateText(value, maxLength) {
  const text = coerceToString(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function getBodyPreview(article) {
  if (!Array.isArray(article?.body)) {
    return "";
  }
  return truncateText(
    article.body
      .filter((entry) => typeof entry === "string" && entry.trim().length > 0)
      .slice(0, 2)
      .join("\n"),
    700
  );
}

function getArticlePublishedMs(article) {
  const publishedAt =
    typeof article?.publishedAt === "string" && article.publishedAt.length > 0
      ? article.publishedAt
      : null;
  const publishedMs = publishedAt ? Date.parse(publishedAt) : NaN;
  if (Number.isFinite(publishedMs) && publishedMs > 0) {
    return publishedMs;
  }

  const minutesAgo = Number(article?.publishedMinutesAgo);
  if (Number.isFinite(minutesAgo) && minutesAgo >= 0) {
    return Date.now() - minutesAgo * 60 * 1000;
  }

  return NaN;
}

function rankByFreshnessAndProviderOrder(articles, nowMs) {
  return [...articles].sort((left, right) => {
    const leftFresh = left.isFresh ? 1 : 0;
    const rightFresh = right.isFresh ? 1 : 0;
    if (rightFresh !== leftFresh) return rightFresh - leftFresh;

    const leftPublished = getArticlePublishedMs(left.article);
    const rightPublished = getArticlePublishedMs(right.article);
    if (Number.isFinite(leftPublished) && Number.isFinite(rightPublished)) {
      if (rightPublished !== leftPublished) return rightPublished - leftPublished;
    }

    const leftRank = Number(left.providerRank || Number.MAX_SAFE_INTEGER);
    const rightRank = Number(right.providerRank || Number.MAX_SAFE_INTEGER);
    return leftRank - rightRank;
  });
}

function fallbackSelectArticles({ candidates, targetCount, nowMs, reason }) {
  return rankByFreshnessAndProviderOrder(candidates, nowMs)
    .slice(0, targetCount)
    .map((candidate) => ({
      candidate,
      reason: reason || "fallback freshness/provider-rank selection"
    }));
}

function buildSelectorInput({ topic, candidates, targetCount, nowMs }) {
  return {
    topic,
    targetCount,
    candidates: candidates.map((candidate, index) => {
      const publishedMs = getArticlePublishedMs(candidate.article);
      const ageHours =
        Number.isFinite(publishedMs) && publishedMs > 0
          ? Math.max(0, (nowMs - publishedMs) / (60 * 60 * 1000))
          : null;
      return {
        id: `candidate_${index}`,
        providerRank: candidate.providerRank,
        title: candidate.article.title || "",
        lead: candidate.article.lead || "",
        bodyPreview: getBodyPreview(candidate.article),
        publishedAt: candidate.article.publishedAt || null,
        ageHours:
          ageHours == null ? null : Math.round(ageHours * 10) / 10,
        isFresh: Boolean(candidate.isFresh)
      };
    })
  };
}

async function selectFeedArticlesForTopic({
  topic,
  articles,
  targetCount,
  nowMs = Date.now()
}) {
  const candidates = (Array.isArray(articles) ? articles : []).map(
    (article, index) => ({
      article,
      index,
      providerRank: Number(article?.providerRank || index + 1),
      isFresh: Boolean(article?.isFresh)
    })
  );

  if (targetCount <= 0 || candidates.length === 0) {
    return {
      method: FEED_SELECTOR_METHOD,
      model: FEED_SELECTOR_MODEL,
      fallbackUsed: false,
      selected: []
    };
  }

  if (!FEED_SELECTOR_ENABLED || !OPENAI_API_KEY) {
    return {
      method: "freshness_provider_rank_fallback",
      model: null,
      fallbackUsed: true,
      selected: fallbackSelectArticles({
        candidates,
        targetCount,
        nowMs,
        reason: FEED_SELECTOR_ENABLED
          ? "selector unavailable: missing OPENAI_API_KEY"
          : "selector disabled"
      })
    };
  }

  const selectorInput = buildSelectorInput({
    topic,
    candidates,
    targetCount,
    nowMs
  });
  const inputById = new Map(
    selectorInput.candidates.map((candidate, index) => [
      candidate.id,
      candidates[index]
    ])
  );
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    FEED_SELECTOR_TIMEOUT_MS
  );

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: FEED_SELECTOR_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: FEED_SELECTOR_SYSTEM_PROMPT
          },
          {
            role: "user",
            content: JSON.stringify(selectorInput)
          }
        ]
      }),
      signal: controller.signal
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `Feed selector failed: ${response.status} ${response.statusText} - ${text}`
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
    const selectedEntries = Array.isArray(parsed?.selected)
      ? parsed.selected
      : [];
    const seen = new Set();
    const selected = [];

    for (const entry of selectedEntries) {
      const id = coerceToString(entry?.id);
      if (!id || seen.has(id) || !inputById.has(id)) {
        continue;
      }
      seen.add(id);
      selected.push({
        candidate: inputById.get(id),
        reason: coerceToString(entry?.reason) || "selected by feed selector"
      });
      if (selected.length >= targetCount) {
        break;
      }
    }

    if (selected.length === 0) {
      return {
        method: "freshness_provider_rank_fallback",
        model: FEED_SELECTOR_MODEL,
        fallbackUsed: true,
        selected: fallbackSelectArticles({
          candidates,
          targetCount,
          nowMs,
          reason: "selector returned no valid selections"
        })
      };
    }

    return {
      method: FEED_SELECTOR_METHOD,
      model: FEED_SELECTOR_MODEL,
      fallbackUsed: false,
      selected
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      method: "freshness_provider_rank_fallback",
      model: FEED_SELECTOR_MODEL,
      fallbackUsed: true,
      error: message,
      selected: fallbackSelectArticles({
        candidates,
        targetCount,
        nowMs,
        reason: `selector failed: ${message}`
      })
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  FEED_SELECTOR_CANDIDATES_PER_TOPIC,
  FEED_SELECTOR_ENABLED,
  FEED_SELECTOR_METHOD,
  FEED_SELECTOR_MODEL,
  selectFeedArticlesForTopic
};
