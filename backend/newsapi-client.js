const NEWSAPI_AI_ARTICLES_ENDPOINT =
  process.env.NEWSAPI_AI_ENDPOINT ||
  "https://eventregistry.org/api/v1/article/getArticles";
const NEWSAPI_AI_SUGGEST_SOURCES_ENDPOINT =
  process.env.NEWSAPI_AI_SUGGEST_SOURCES_ENDPOINT ||
  "https://newsapi.ai/api/v1/suggestSources";

function mapCategoryToKeyword(category) {
  if (!category || category === "All" || category === "General") return null;
  return category;
}

function extractBody(article) {
  if (typeof article.body === "string" && article.body.trim().length > 0) {
    return article.body;
  }
  if (typeof article.summary === "string" && article.summary.trim().length > 0) {
    return article.summary;
  }
  return "";
}

function splitParagraphs(text) {
  const cleaned = (text || "").replace(/\r/g, "").trim();
  if (!cleaned) return [];
  return cleaned
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildLead(article, paragraphs) {
  const summary =
    typeof article.summary === "string" ? article.summary.trim() : "";
  if (summary.length > 0) {
    return summary;
  }

  if (paragraphs.length > 0) {
    const firstParagraph = paragraphs[0].trim();
    if (firstParagraph.length <= 280) {
      return firstParagraph;
    }
    return `${firstParagraph.slice(0, 277).trimEnd()}...`;
  }

  const body = typeof article.body === "string" ? article.body.trim() : "";
  if (body.length > 0) {
    if (body.length <= 280) {
      return body;
    }
    return `${body.slice(0, 277).trimEnd()}...`;
  }

  return "No summary available.";
}

function hostnameFromUrl(value) {
  if (typeof value !== "string" || value.length === 0) return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function normalizeSource(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function isArticleFromSource(article, sourceUri) {
  const normalized = normalizeSource(sourceUri);
  if (!normalized) return true;

  const sourceUriValue = normalizeSource(article?.source?.uri || "");
  const articleHost = hostnameFromUrl(article?.url || "");
  const articlePath = typeof article?.url === "string" ? article.url.toLowerCase() : "";

  if (sourceUriValue === normalized) return true;
  if (sourceUriValue.endsWith(`.${normalized}`)) return true;
  if (articleHost === normalized) return true;
  if (articleHost.endsWith(`.${normalized}`)) return true;
  if (articlePath.includes(`://${normalized}/`)) return true;
  return false;
}

function normalizeStringKey(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function canonicalArticleUrl(article) {
  const candidate =
    (typeof article?.url === "string" && article.url) ||
    (typeof article?.uri === "string" && article.uri) ||
    "";
  if (!candidate) {
    return "";
  }

  try {
    const parsed = new URL(candidate);
    return `${parsed.hostname.toLowerCase()}${parsed.pathname}`;
  } catch {
    return normalizeSource(candidate).split("?")[0];
  }
}

function dedupeArticles(rawArticles) {
  const seen = new Set();
  const deduped = [];

  for (const article of rawArticles) {
    const urlKey = canonicalArticleUrl(article);
    const titleKey = normalizeStringKey(article?.title || "");
    const dateKey = normalizeStringKey(
      article?.dateTimePub || article?.date || ""
    ).slice(0, 10);
    const dedupeKey = urlKey || `${titleKey}|${dateKey}`;

    if (!dedupeKey || seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    deduped.push(article);
  }

  return deduped;
}

function toInternalArticle(article, index) {
  const bodyText = extractBody(article);
  const paragraphs = splitParagraphs(bodyText);
  const published = article.dateTimePub || article.date || null;
  const publishedMs = published ? Date.parse(published) : null;
  const minutesAgo = Number.isFinite(publishedMs)
    ? Math.max(1, Math.round((Date.now() - publishedMs) / 60000))
    : 60 + index;
  const topic =
    article?.concepts?.[0]?.label?.eng ||
    article?.categories?.[0]?.label?.eng ||
    article?.source?.title ||
    "General";

  return {
    id: article.uri || `newsapi-${index}-${Date.now()}`,
    category: article?.categories?.[0]?.label?.eng || "General",
    title: article.title || "Untitled",
    topicLabel: topic,
    publishedMinutesAgo: minutesAgo,
    lead: buildLead(article, paragraphs),
    body:
      paragraphs.length > 0
        ? paragraphs
        : [article.body || article.summary || "No body content available."],
    image:
      article.image || "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&w=1400&q=80",
    source: {
      name: article?.source?.title || null,
      uri: article?.source?.uri || null,
      articleUri: article?.url || null
    },
    publishedAt: published
  };
}

function buildArticleQuery({ category, sourceUri }) {
  const queryParts = [{ lang: "eng" }];
  const keyword = mapCategoryToKeyword(category);
  if (keyword) {
    queryParts.push({ keyword });
  }
  if (sourceUri) {
    queryParts.push({ sourceUri });
  }
  return {
    $query: {
      $and: queryParts
    }
  };
}

async function resolveSourceUri({ apiKey, sourceKeyword }) {
  if (!sourceKeyword) {
    return null;
  }

  const params = new URLSearchParams();
  params.set("keyword", sourceKeyword);
  params.set("apiKey", apiKey);
  const response = await fetch(
    `${NEWSAPI_AI_SUGGEST_SOURCES_ENDPOINT}?${params.toString()}`
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "<unreadable>");
    throw new Error(
      `newsapi.ai suggestSources failed: ${response.status} ${response.statusText} - ${body}`
    );
  }

  const json = await response.json();
  const sources = Array.isArray(json?.sources)
    ? json.sources
    : Array.isArray(json)
      ? json
      : [];
  if (sources.length === 0) {
    return null;
  }

  const exactByUri = sources.find(
    (source) =>
      typeof source?.uri === "string" &&
      source.uri.toLowerCase() === sourceKeyword.toLowerCase()
  );
  if (exactByUri?.uri) {
    return exactByUri.uri;
  }

  const exactByTitle = sources.find(
    (source) =>
      typeof source?.title === "string" &&
      source.title.toLowerCase() === sourceKeyword.toLowerCase()
  );
  if (exactByTitle?.uri) {
    return exactByTitle.uri;
  }

  const keywordLower = sourceKeyword.toLowerCase();
  if (
    keywordLower.includes("associated press") ||
    keywordLower.includes("apnews.com") ||
    keywordLower === "ap"
  ) {
    const apMatch = sources.find((source) => {
      const uri = typeof source?.uri === "string" ? source.uri.toLowerCase() : "";
      const title =
        typeof source?.title === "string" ? source.title.toLowerCase() : "";
      return (
        uri.includes("apnews.com") ||
        uri.includes("associatedpress.com") ||
        title.includes("associated press") ||
        title === "ap"
      );
    });
    if (apMatch?.uri) {
      return apMatch.uri;
    }
  }

  return null;
}

async function fetchNewsApiArticles({
  apiKey,
  category = "All",
  limit = 20,
  page = 1,
  sourceUri = "",
  sourceKeyword = ""
}) {
  if (!apiKey) {
    throw new Error(
      "Missing NEWSAPI_AI_KEY. Set NEWSAPI_AI_KEY in backend environment."
    );
  }

  const resolvedSourceUri =
    sourceUri ||
    (sourceKeyword
      ? await resolveSourceUri({
          apiKey,
          sourceKeyword
        })
      : null);
  if (sourceKeyword && !sourceUri && !resolvedSourceUri) {
    throw new Error(
      `No sourceUri match found for NEWSAPI_AI_SOURCE_KEYWORD="${sourceKeyword}". Set NEWSAPI_AI_SOURCE_URI explicitly (for AP, usually apnews.com).`
    );
  }

  const pageNumber = Number.isFinite(Number(page))
    ? Math.max(1, Math.round(Number(page)))
    : 1;

  const payload = {
    apiKey,
    query: buildArticleQuery({
      category,
      sourceUri: resolvedSourceUri
    }),
    resultType: "articles",
    dataType: ["news"],
    articlesSortBy: "date",
    articlesSortByAsc: false,
    articlesCount: limit,
    articlesPage: pageNumber,
    includeArticleBody: true
  };

  const response = await fetch(NEWSAPI_AI_ARTICLES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "<unreadable>");
    throw new Error(
      `newsapi.ai request failed: ${response.status} ${response.statusText} - ${body}`
    );
  }

  const json = await response.json();
  const rawArticlesUnfiltered = json?.articles?.results || json?.articles || [];
  const filtered = Array.isArray(rawArticlesUnfiltered)
    ? rawArticlesUnfiltered.filter((article) =>
        isArticleFromSource(article, resolvedSourceUri)
      )
    : [];
  const rawArticles = dedupeArticles(filtered);
  if (!Array.isArray(rawArticles) || rawArticles.length === 0) {
    return {
      articles: [],
      sourceUri: resolvedSourceUri
    };
  }

  return {
    articles: rawArticles.map((article, index) => toInternalArticle(article, index)),
    sourceUri: resolvedSourceUri
  };
}

module.exports = {
  fetchNewsApiArticles,
  resolveSourceUri
};
