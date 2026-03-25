import articlesJson from "../data/articles.json";

export type ArticleVariantKey =
  | "regular"
  | "facts_only"
  | "less_complex"
  | "more_positive"
  | "more_negative"
  | "conservative"
  | "liberal"
  | "entertaining"
  | "clickbait";

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

type RawArticle = Omit<NewsArticle, "variants">;

const rawArticles = articlesJson as RawArticle[];

const POSITIVE_REPLACEMENTS: Array<[string, string]> = [
  ["concern", "focus"],
  ["concerns", "focus areas"],
  ["warned", "noted"],
  ["warning", "note"],
  ["risk", "challenge"],
  ["risks", "challenges"],
  ["crisis", "challenge"],
  ["decline", "slowdown"],
  ["drop", "dip"],
  ["stalled", "paused"],
  ["uncertainty", "open questions"],
  ["difficult", "demanding"],
  ["problem", "issue"],
  ["problems", "issues"]
];

const NEGATIVE_REPLACEMENTS: Array<[string, string]> = [
  ["focus areas", "concerns"],
  ["focus", "concern"],
  ["noted", "warned"],
  ["note", "warning"],
  ["challenge", "risk"],
  ["challenges", "risks"],
  ["slowdown", "decline"],
  ["dip", "drop"],
  ["paused", "stalled"],
  ["open questions", "uncertainty"],
  ["issue", "problem"],
  ["issues", "problems"],
  ["stable", "fragile"],
  ["progress", "setback"]
];

const variantOverrides: Partial<
  Record<string, Partial<Record<ArticleVariantKey, ArticleVariant>>>
> = {
  "pol-001": {
    facts_only: {
      title: "Transit Funding Talks Continue as Officials Review Cost Split",
      lead:
        "State and city officials resumed negotiations on transit funding after proposed service cuts prompted responses from commuters and business groups.",
      body: [
        "Lawmakers resumed negotiations on a funding plan for the regional transit system after talks paused over cost sharing between the state and city.",
        "The transit authority previously said that without additional funding it would reduce service frequency on several commuter lines and delay planned repairs.",
        "Business organizations and labor groups publicly requested that negotiators reach an agreement.",
        "Officials said the current proposal combines temporary operating support with a review of fares, tolls, and dedicated tax revenue.",
        "No final agreement was announced. Negotiations are expected to continue through the weekend."
      ]
    },
    less_complex: {
      title: "Leaders Restart Transit Money Talks",
      lead:
        "State and city leaders started talking again about how to pay for transit service.",
      body: [
        "Lawmakers are discussing a new plan for the regional transit system.",
        "Earlier talks stopped because leaders disagreed about who should pay more.",
        "Transit officials warned that trains and buses could run less often without new money.",
        "Groups representing workers and businesses asked leaders to make a deal quickly.",
        "Talks will continue this weekend. No final deal has been announced yet."
      ]
    },
    more_positive: {
      title: "Transit Funding Talks Gain Momentum as Leaders Return to the Table",
      lead:
        "State and city officials resumed negotiations on a transit package, signaling renewed cooperation after weeks of delay.",
      body: [
        "Lawmakers reopened transit funding talks on Thursday, with both sides describing the latest round as productive.",
        "Officials said the renewed negotiations improve the chances of avoiding deeper service cuts and keeping summer repairs on track.",
        "Business groups and labor unions welcomed the talks, calling them an important step toward stable service for workers and commuters.",
        "Negotiators said the latest framework blends short-term support with a longer-term plan for fares, tolls, and dedicated revenue.",
        "While no final agreement was announced, participants said continued weekend talks reflect clear forward progress."
      ]
    },
    more_negative: {
      title:
        "Transit Funding Standoff Persists as New Talks Fail to Deliver a Deal",
      lead:
        "Officials returned to negotiations, but commuters still face uncertainty after weeks of budget conflict and threatened service cuts.",
      body: [
        "Lawmakers resumed transit funding talks on Thursday after prolonged disagreements over how to split costs.",
        "Transit leaders warned that service reductions and repair delays remain possible without immediate funding.",
        "Commuters and business groups said the ongoing stalemate is already straining travel reliability and downtown activity.",
        "Officials discussed another mixed proposal, but core disputes over revenue and long-term responsibility remain unresolved.",
        "Negotiators ended the session without a final deal and said talks will continue through the weekend."
      ]
    }
  },
  "eco-001": {
    facts_only: {
      title: "Small Business Survey Reports Modest Increase in Hiring Plans",
      lead:
        "A national survey found somewhat higher hiring intentions among small firms, while many reported continued pressure from financing costs.",
      body: [
        "Small business owners reported a modest increase in hiring intentions in a survey released Thursday.",
        "Respondents cited stable demand in several service categories including food services, personal care, and home maintenance.",
        "Many firms also reported delaying equipment purchases or expansion because borrowing costs remain elevated.",
        "Economists said the results are consistent with a mixed environment of firm labor demand and slower investment activity.",
        "The survey found that price increases are slowing, while wage competition remains a reported constraint in some industries."
      ]
    },
    less_complex: {
      title: "Small Businesses Plan to Hire, but Loans Stay Expensive",
      lead:
        "A new survey says many small companies still want to hire even though borrowing money costs a lot.",
      body: [
        "Small business owners said they plan to hire a little more this month.",
        "Many owners said customer demand is still steady in everyday services.",
        "At the same time, expensive loans are causing some businesses to delay new equipment and growth plans.",
        "Economists said this can happen when hiring stays solid but investment slows down.",
        "Prices are rising more slowly, but business owners still report pressure to offer higher wages."
      ]
    },
    more_positive: {
      title: "Small Firms Show Hiring Resilience Despite Higher Financing Costs",
      lead:
        "New survey data suggests small businesses are maintaining confidence, supported by steady consumer demand across key service sectors.",
      body: [
        "Small business owners reported stronger hiring plans this month, pointing to continued confidence in near-term demand.",
        "Respondents said customer activity remains steady in food services, personal care, and home maintenance.",
        "Although financing remains costly, many firms said they are adapting while preserving workforce growth plans.",
        "Economists said the survey reflects an encouraging balance: labor demand remains firm even as investment decisions stay selective.",
        "The report also showed moderation in price increases, a sign that inflation pressure may be easing for smaller operators."
      ]
    },
    more_negative: {
      title: "Small Businesses Face Hiring Strain as Borrowing Costs Stay High",
      lead:
        "A national survey found only modest hiring growth, with many owners delaying investment as financing pressures continue.",
      body: [
        "Small business hiring plans rose slightly, but owners continue to report a difficult operating environment.",
        "Respondents said demand has held up in some service areas, yet many remain cautious about near-term growth.",
        "High borrowing costs are still forcing firms to postpone equipment purchases and expansion decisions.",
        "Economists said the data reflects a fragile balance in which firms may keep hiring while pulling back on investment.",
        "While price increases have moderated, wage competition remains a significant challenge for many small employers."
      ]
    }
  }
};

function buildDefaultVariant(base: RawArticle): ArticleVariant {
  return {
    title: base.title,
    lead: base.lead,
    body: base.body
  };
}

function buildLessComplexVariant(base: RawArticle): ArticleVariant {
  return {
    title: `${base.title.split(":")[0]}`,
    lead: `In simple terms: ${base.lead}`,
    body: base.body.map((paragraph) => {
      const firstSentence = paragraph.split(". ")[0];
      return firstSentence.endsWith(".")
        ? firstSentence
        : `${firstSentence}.`;
    })
  };
}

function buildPositiveVariant(base: RawArticle): ArticleVariant {
  return {
    title: `Progress Update: ${base.title}`,
    lead: base.lead.replace(/^A new survey shows/i, "A new survey highlights"),
    body: base.body.map((paragraph, index) =>
      index === 0 ? `Encouragingly, ${paragraph.charAt(0).toLowerCase()}${paragraph.slice(1)}` : paragraph
    )
  };
}

function buildNegativeVariant(base: RawArticle): ArticleVariant {
  return {
    title: `Pressure Builds: ${base.title}`,
    lead: base.lead,
    body: base.body.map((paragraph, index) =>
      index === 0 ? `Caution remains high as ${paragraph.charAt(0).toLowerCase()}${paragraph.slice(1)}` : paragraph
    )
  };
}

function buildFactsOnlyVariant(base: RawArticle): ArticleVariant {
  return {
    title: base.title,
    lead: base.lead,
    body: base.body.map((paragraph) =>
      paragraph
        .replace(/\bmajor\b/gi, "")
        .replace(/\bambitious\b/gi, "")
        .replace(/\bdramatic\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
  };
}

function buildClickbaitVariant(base: RawArticle): ArticleVariant {
  return {
    title: `You Won't Believe What Happened: ${base.title}`,
    lead: base.lead,
    body: base.body
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function withMatchCase(match: string, replacement: string) {
  if (match.length === 0) {
    return replacement;
  }

  if (match.toUpperCase() === match) {
    return replacement.toUpperCase();
  }

  if (match[0] === match[0].toUpperCase()) {
    return `${replacement[0].toUpperCase()}${replacement.slice(1)}`;
  }

  return replacement;
}

function rewriteToneText(
  text: string,
  replacements: Array<[string, string]>
) {
  let next = text;
  for (const [from, to] of replacements) {
    const regex = new RegExp(`\\b${escapeRegExp(from)}\\b`, "gi");
    next = next.replace(regex, (match) => withMatchCase(match, to));
  }
  return next;
}

function buildRemoteBaseVariant(article: NewsArticle): ArticleVariant {
  return {
    title: article.title,
    lead: article.lead,
    body: article.body
  };
}

function buildRemoteLessComplexVariant(article: NewsArticle): ArticleVariant {
  return {
    title: article.title,
    lead: `In simple terms: ${article.lead}`,
    body: article.body.map((paragraph) => {
      const firstSentence = paragraph.split(". ")[0];
      return firstSentence.endsWith(".")
        ? firstSentence
        : `${firstSentence}.`;
    })
  };
}

function buildRemotePositiveVariant(article: NewsArticle): ArticleVariant {
  return {
    title: `Positive Framing: ${rewriteToneText(
      article.title,
      POSITIVE_REPLACEMENTS
    )}`,
    lead: rewriteToneText(article.lead, POSITIVE_REPLACEMENTS),
    body: article.body.map((paragraph) =>
      rewriteToneText(paragraph, POSITIVE_REPLACEMENTS)
    )
  };
}

function buildRemoteNegativeVariant(article: NewsArticle): ArticleVariant {
  return {
    title: `Cautious Framing: ${rewriteToneText(
      article.title,
      NEGATIVE_REPLACEMENTS
    )}`,
    lead: rewriteToneText(article.lead, NEGATIVE_REPLACEMENTS),
    body: article.body.map((paragraph) =>
      rewriteToneText(paragraph, NEGATIVE_REPLACEMENTS)
    )
  };
}

function buildRemoteVariants(article: NewsArticle): Record<
  ArticleVariantKey,
  ArticleVariant
> {
  const regular = buildRemoteBaseVariant(article);

  return {
    regular,
    facts_only: regular,
    less_complex: buildRemoteLessComplexVariant(article),
    more_positive: buildRemotePositiveVariant(article),
    more_negative: buildRemoteNegativeVariant(article),
    conservative: regular,
    liberal: regular,
    entertaining: regular,
    clickbait: regular
  };
}

const articles: NewsArticle[] = rawArticles.map((article) => {
  const defaults: Record<ArticleVariantKey, ArticleVariant> = {
    regular: buildDefaultVariant(article),
    facts_only: buildFactsOnlyVariant(article),
    less_complex: buildLessComplexVariant(article),
    more_positive: buildPositiveVariant(article),
    more_negative: buildNegativeVariant(article),
    conservative: buildDefaultVariant(article),
    liberal: buildDefaultVariant(article),
    entertaining: buildDefaultVariant(article),
    clickbait: buildClickbaitVariant(article)
  };

  const overrides = variantOverrides[article.id] ?? {};
  const variants = { ...defaults, ...overrides } as Record<
    ArticleVariantKey,
    ArticleVariant
  >;

  return {
    ...article,
    variants
  };
});

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "";
let lastFeedMetadata: FeedMetadata = {
  provider: null,
  snapshotId: null,
  snapshotDate: null,
  sourceUri: null,
  cached: null,
  category: null,
  limit: null
};

function hasCompleteVariants(
  variants: unknown
): variants is Record<ArticleVariantKey, ArticleVariant> {
  if (!variants || typeof variants !== "object") {
    return false;
  }

  const candidate = variants as Record<string, ArticleVariant>;
  const required: ArticleVariantKey[] = [
    "regular",
    "facts_only",
    "clickbait"
  ];

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

async function fetchBackendJson(pathname: string) {
  if (!API_BASE_URL) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}${pathname}`);
  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function listArticles(
  options: ListArticlesOptions = {}
): Promise<NewsArticle[]> {
  const { category } = options;
  const normalizedCategory =
    category && category.toLowerCase() === "general" ? "All" : category;
  if (API_BASE_URL) {
    try {
      const categoryQuery =
        normalizedCategory && normalizedCategory !== "All"
          ? `?category=${encodeURIComponent(normalizedCategory)}`
          : "";
      const json = await fetchBackendJson(`/feed${categoryQuery}`);
      const remoteArticles = Array.isArray(json?.articles) ? json.articles : [];
      if (remoteArticles.length > 0) {
        lastFeedMetadata = {
          provider: typeof json?.provider === "string" ? json.provider : null,
          snapshotId:
            Number.isFinite(Number(json?.snapshotId)) && Number(json.snapshotId) > 0
              ? Number(json.snapshotId)
              : null,
          snapshotDate:
            typeof json?.snapshotDate === "string" ? json.snapshotDate : null,
          sourceUri: typeof json?.sourceUri === "string" ? json.sourceUri : null,
          cached: typeof json?.cached === "boolean" ? json.cached : null,
          category: typeof json?.category === "string" ? json.category : null,
          limit:
            Number.isFinite(Number(json?.count)) && Number(json.count) >= 0
              ? Number(json.count)
              : null
        };

        return remoteArticles.map((article: NewsArticle) => {
          const localFallback = articles.find((a) => a.id === article.id) ?? null;
          return {
            ...article,
            variants:
              hasCompleteVariants(article.variants)
                ? article.variants
                : localFallback?.variants ?? buildRemoteVariants(article)
          };
        });
      }
    } catch {
      // Fall back to local static content if backend fails.
    }
  }

  lastFeedMetadata = {
    provider: null,
    snapshotId: null,
    snapshotDate: null,
    sourceUri: null,
    cached: null,
    category: category ?? "All",
    limit: null
  };

  await delay(120);

  if (!normalizedCategory || normalizedCategory === "All") {
    return [...articles];
  }

  return articles.filter((article) => article.category === normalizedCategory);
}

type GetArticleByIdOptions = {
  snapshotId?: number | null;
  snapshotDate?: string | null;
};

export async function getArticleById(
  id: string,
  options: GetArticleByIdOptions = {}
): Promise<NewsArticle | null> {
  if (API_BASE_URL) {
    try {
      const queryParts: string[] = [];
      if (
        Number.isFinite(Number(options.snapshotId)) &&
        Number(options.snapshotId) > 0
      ) {
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
      if (json?.article) {
        const article = json.article as NewsArticle;
        const localFallback = articles.find((a) => a.id === article.id) ?? null;
        return {
          ...article,
          variants:
            hasCompleteVariants(article.variants)
              ? article.variants
              : localFallback?.variants ?? buildRemoteVariants(article)
        };
      }
    } catch {
      // Fall back to local static content if backend fails.
    }
  }

  await delay(80);
  return articles.find((article) => article.id === id) ?? null;
}

export async function listCategories(): Promise<string[]> {
  if (API_BASE_URL) {
    try {
      const health = await fetchBackendJson("/health");
      if (
        Array.isArray(health?.feedTopicTargets) &&
        health.feedTopicTargets.length > 0
      ) {
        return health.feedTopicTargets.filter(
          (entry: unknown): entry is string =>
            typeof entry === "string" && entry.trim().length > 0
        );
      }
    } catch {
      // fall through to feed categories
    }

    try {
      const json = await fetchBackendJson("/feed");
      if (Array.isArray(json?.categories) && json.categories.length > 0) {
        return json.categories;
      }
    } catch {
      // fall back to local categories
    }
  }

  await delay(50);
  return Array.from(new Set(articles.map((article) => article.category)));
}

export function getLastFeedMetadata() {
  return { ...lastFeedMetadata };
}
