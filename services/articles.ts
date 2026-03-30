export type ArticleVariantKey = "regular" | "facts_only" | "clickbait";

export type ArticleVariant = {
  title: string;
  lead: string;
  body: string[];
};

export type NewsArticle = {
  id: string;
  category: string;
  title: string;
  topicLabel: string;
  topicTag?: string | null;
  publishedMinutesAgo: number;
  lead: string;
  body: string[];
  image: string;
  source?: {
    name: string | null;
    uri: string | null;
    articleUri: string | null;
  };
  publishedAt?: string | null;
  variants: Record<ArticleVariantKey, ArticleVariant>;
};

type ListArticlesOptions = {
  category?: string;
};

export type FeedMetadata = {
  provider: string | null;
  snapshotId: number | null;
  snapshotDate: string | null;
  sourceUri: string | null;
  cached: boolean | null;
  category: string | null;
  limit: number | null;
};

const API_BASE_URL = String(process.env.EXPO_PUBLIC_API_BASE_URL || "").trim();

let lastFeedMetadata: FeedMetadata = {
  provider: null,
  snapshotId: null,
  snapshotDate: null,
  sourceUri: null,
  cached: null,
  category: null,
  limit: null
};

function requireApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error(
      "EXPO_PUBLIC_API_BASE_URL is not configured. The app requires a live backend feed."
    );
  }

  return API_BASE_URL;
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function normalizeBody(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.length > 0
  );
}

function cloneVariant(variant: ArticleVariant): ArticleVariant {
  return {
    title: variant.title,
    lead: variant.lead,
    body: [...variant.body]
  };
}

function buildRegularVariant(article: {
  title: string;
  lead: string;
  body: string[];
}): ArticleVariant {
  return {
    title: article.title,
    lead: article.lead,
    body: [...article.body]
  };
}

function hasCompleteVariants(
  variants: unknown
): variants is Record<ArticleVariantKey, ArticleVariant> {
  if (!variants || typeof variants !== "object") {
    return false;
  }

  const candidate = variants as Record<string, ArticleVariant>;
  const required: ArticleVariantKey[] = ["regular", "facts_only", "clickbait"];

  return required.every((key) => {
    const variant = candidate[key];
    return (
      variant != null &&
      typeof variant.title === "string" &&
      typeof variant.lead === "string" &&
      Array.isArray(variant.body)
    );
  });
}

function buildFallbackVariants(article: {
  title: string;
  lead: string;
  body: string[];
}): Record<ArticleVariantKey, ArticleVariant> {
  const regular = buildRegularVariant(article);
  return {
    regular,
    facts_only: cloneVariant(regular),
    clickbait: cloneVariant(regular)
  };
}

function normalizeVariants(
  article: Pick<NewsArticle, "title" | "lead" | "body">,
  variants: unknown
): Record<ArticleVariantKey, ArticleVariant> {
  if (!hasCompleteVariants(variants)) {
    return buildFallbackVariants(article);
  }

  return {
    regular: {
      title: normalizeString(variants.regular.title, article.title),
      lead: normalizeString(variants.regular.lead, article.lead),
      body: normalizeBody(variants.regular.body)
    },
    facts_only: {
      title: normalizeString(variants.facts_only.title, article.title),
      lead: normalizeString(variants.facts_only.lead, article.lead),
      body: normalizeBody(variants.facts_only.body)
    },
    clickbait: {
      title: normalizeString(variants.clickbait.title, article.title),
      lead: normalizeString(variants.clickbait.lead, article.lead),
      body: normalizeBody(variants.clickbait.body)
    }
  };
}

function normalizeArticle(input: unknown): NewsArticle | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const article = {
    id: normalizeString(raw.id),
    category: normalizeString(raw.category, "General"),
    title: normalizeString(raw.title, "Untitled"),
    topicLabel: normalizeString(raw.topicLabel),
    topicTag:
      typeof raw.topicTag === "string" || raw.topicTag == null
        ? (raw.topicTag as string | null | undefined)
        : null,
    publishedMinutesAgo: Number.isFinite(Number(raw.publishedMinutesAgo))
      ? Number(raw.publishedMinutesAgo)
      : 0,
    lead: normalizeString(raw.lead),
    body: normalizeBody(raw.body),
    image: normalizeString(raw.image),
    source:
      raw.source && typeof raw.source === "object"
        ? {
            name:
              typeof (raw.source as Record<string, unknown>).name === "string" ||
              (raw.source as Record<string, unknown>).name == null
                ? ((raw.source as Record<string, unknown>).name as string | null)
                : null,
            uri:
              typeof (raw.source as Record<string, unknown>).uri === "string" ||
              (raw.source as Record<string, unknown>).uri == null
                ? ((raw.source as Record<string, unknown>).uri as string | null)
                : null,
            articleUri:
              typeof (raw.source as Record<string, unknown>).articleUri === "string" ||
              (raw.source as Record<string, unknown>).articleUri == null
                ? ((raw.source as Record<string, unknown>).articleUri as string | null)
                : null
          }
        : undefined,
    publishedAt:
      typeof raw.publishedAt === "string" || raw.publishedAt == null
        ? (raw.publishedAt as string | null | undefined)
        : null
  };

  if (!article.id) {
    return null;
  }

  return {
    ...article,
    variants: normalizeVariants(article, raw.variants)
  };
}

async function fetchBackendJson(pathname: string) {
  const baseUrl = requireApiBaseUrl();
  const response = await fetch(`${baseUrl}${pathname}`);

  if (!response.ok) {
    let message = `Backend request failed: ${response.status} ${response.statusText}`;

    try {
      const payload = await response.json();
      if (typeof payload?.error === "string" && payload.error.trim().length > 0) {
        message = `${message} - ${payload.error.trim()}`;
      }
    } catch {
      // Keep the default message when the backend body is not JSON.
    }

    throw new Error(message);
  }

  return response.json();
}

export async function listArticles(
  options: ListArticlesOptions = {}
): Promise<NewsArticle[]> {
  const normalizedCategory =
    options.category && options.category.toLowerCase() === "general"
      ? "All"
      : options.category;
  const categoryQuery =
    normalizedCategory && normalizedCategory !== "All"
      ? `?category=${encodeURIComponent(normalizedCategory)}`
      : "";
  const json = await fetchBackendJson(`/feed${categoryQuery}`);
  const remoteArticles = Array.isArray(json?.articles) ? json.articles : [];
  const nextArticles = remoteArticles
    .map((article) => normalizeArticle(article))
    .filter((article): article is NewsArticle => article != null);

  if (nextArticles.length === 0) {
    throw new Error("Backend feed returned no articles.");
  }

  lastFeedMetadata = {
    provider: typeof json?.provider === "string" ? json.provider : null,
    snapshotId:
      Number.isFinite(Number(json?.snapshotId)) && Number(json.snapshotId) > 0
        ? Number(json.snapshotId)
        : null,
    snapshotDate: typeof json?.snapshotDate === "string" ? json.snapshotDate : null,
    sourceUri: typeof json?.sourceUri === "string" ? json.sourceUri : null,
    cached: typeof json?.cached === "boolean" ? json.cached : null,
    category: typeof json?.category === "string" ? json.category : null,
    limit:
      Number.isFinite(Number(json?.count)) && Number(json.count) >= 0
        ? Number(json.count)
        : null
  };

  return nextArticles;
}

type GetArticleByIdOptions = {
  snapshotId?: number | null;
  snapshotDate?: string | null;
};

export async function getArticleById(
  id: string,
  options: GetArticleByIdOptions = {}
): Promise<NewsArticle | null> {
  requireApiBaseUrl();

  const queryParts: string[] = [];
  if (Number.isFinite(Number(options.snapshotId)) && Number(options.snapshotId) > 0) {
    queryParts.push(`snapshotId=${encodeURIComponent(String(options.snapshotId))}`);
  }
  if (
    typeof options.snapshotDate === "string" &&
    options.snapshotDate.length > 0
  ) {
    queryParts.push(`snapshotDate=${encodeURIComponent(options.snapshotDate)}`);
  }

  const query = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
  const json = await fetchBackendJson(`/articles/${encodeURIComponent(id)}${query}`);
  return normalizeArticle(json?.article);
}

export async function listCategories(): Promise<string[]> {
  requireApiBaseUrl();

  try {
    const health = await fetchBackendJson("/health");
    if (Array.isArray(health?.feedTopicTargets) && health.feedTopicTargets.length > 0) {
      return health.feedTopicTargets.filter(
        (entry: unknown): entry is string =>
          typeof entry === "string" && entry.trim().length > 0
      );
    }
  } catch {
    // Fall through to feed categories.
  }

  const json = await fetchBackendJson("/feed");
  if (Array.isArray(json?.categories) && json.categories.length > 0) {
    return json.categories.filter(
      (entry: unknown): entry is string =>
        typeof entry === "string" && entry.trim().length > 0
    );
  }

  return [];
}

export function getLastFeedMetadata() {
  return { ...lastFeedMetadata };
}
