const { buildVariants, RULE_REWRITE_METHOD } = require("./rewrite-variants");
const {
  LLM_VARIANT_KEYS,
  buildDefaultVariantMethodMap
} = require("./rewrite-specs");
const {
  buildRegularBodyPrompt,
  buildVariantBodyPrompt,
  buildTitleLeadPrompt,
  formatArticle
} = require("./rewrite-prompts");

const REWRITE_MODE = process.env.REWRITE_MODE || "rule_based";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini-2025-08-07";
const OPENAI_TEMPERATURE_RAW = Number(process.env.OPENAI_TEMPERATURE ?? 1.0);
const OPENAI_TEMPERATURE = Number.isFinite(OPENAI_TEMPERATURE_RAW)
  ? Math.min(2, Math.max(0, OPENAI_TEMPERATURE_RAW))
  : 1.0;
const REWRITE_TIMEOUT_MS_RAW = Number(process.env.REWRITE_TIMEOUT_MS || 120000);
const REWRITE_TIMEOUT_MS = Number.isFinite(REWRITE_TIMEOUT_MS_RAW)
  ? Math.max(5000, REWRITE_TIMEOUT_MS_RAW)
  : 120000;
const REWRITE_MAX_ATTEMPTS_RAW = Number(process.env.REWRITE_MAX_ATTEMPTS || 2);
const REWRITE_MAX_ATTEMPTS = Number.isFinite(REWRITE_MAX_ATTEMPTS_RAW)
  ? Math.max(1, Math.min(5, Math.round(REWRITE_MAX_ATTEMPTS_RAW)))
  : 2;
const REWRITE_PIPELINE = process.env.REWRITE_PIPELINE || "paper_v1";
const TONE_LLM_METHOD = "tone_llm_staged_v1";
const TONE_LLM_REGULAR_METHOD = "tone_llm_regular_body_v1";
const TONE_LLM_PENDING_METHOD = "tone_llm_pending_v1";

const SYSTEM_PROMPT_TITLE_LEAD = [
  "Follow the user instructions exactly.",
  "Return only valid JSON with keys: title, lead.",
  "title and lead must be strings."
].join(" ");
const SYSTEM_PROMPT_BODY = [
  "Follow the user instructions exactly.",
  "Return only the requested rewritten article body as plain text.",
  "Do not return JSON, labels, bullets, step headings, or code fences."
].join(" ");

function isToneLlmEnabled() {
  return (
    REWRITE_MODE === "tone_llm" &&
    OPENAI_API_KEY.length > 0 &&
    LLM_VARIANT_KEYS.length > 0
  );
}

function normalizeBody(value) {
  if (Array.isArray(value)) {
    const body = value
      .filter((entry) => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (body.length > 0) {
      return body;
    }
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .split(/\n{2,}/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function sanitizeModelOutput(text) {
  if (typeof text !== "string") {
    return "";
  }

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

function toArticleInput(article) {
  return {
    title: typeof article?.title === "string" ? article.title : "Untitled",
    lead: typeof article?.lead === "string" ? article.lead : "",
    body: normalizeBody(article?.body)
  };
}

function toArticleText(article) {
  return formatArticle(toArticleInput(article));
}

function validateVariantOutput(output, fallbackVariant) {
  if (!output || typeof output !== "object") {
    return fallbackVariant;
  }

  const title =
    typeof output.title === "string" && output.title.trim().length > 0
      ? output.title.trim()
      : fallbackVariant.title;
  const lead =
    typeof output.lead === "string" ? output.lead.trim() : fallbackVariant.lead;
  const body = normalizeBody(output.body);

  return {
    title,
    lead,
    body: body.length > 0 ? body : fallbackVariant.body
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callOpenAiJson({ systemPrompt, userPrompt, temperature }) {
  let lastError = null;

  for (let attempt = 1; attempt <= REWRITE_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REWRITE_TIMEOUT_MS);

    try {
      const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature:
            Number.isFinite(temperature) && temperature >= 0
              ? temperature
              : OPENAI_TEMPERATURE,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ]
        }),
        signal: controller.signal
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(
          `OpenAI rewrite failed: ${response.status} ${response.statusText} - ${text}`
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
      if (!parsed) {
        throw new Error("OpenAI rewrite returned unparsable JSON content.");
      }

      return parsed;
    } catch (error) {
      const isAbort =
        Boolean(error) &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "AbortError";
      if (isAbort) {
        lastError = new Error(
          `OpenAI rewrite timed out after ${REWRITE_TIMEOUT_MS}ms (attempt ${attempt}/${REWRITE_MAX_ATTEMPTS}, model=${OPENAI_MODEL}).`
        );
      } else {
        lastError = error;
      }
      if (attempt < REWRITE_MAX_ATTEMPTS) {
        await sleep(400 * attempt);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenAI rewrite failed.");
}

async function callOpenAiText({ systemPrompt, userPrompt, temperature }) {
  let lastError = null;

  for (let attempt = 1; attempt <= REWRITE_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REWRITE_TIMEOUT_MS);

    try {
      const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          temperature:
            Number.isFinite(temperature) && temperature >= 0
              ? temperature
              : OPENAI_TEMPERATURE,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ]
        }),
        signal: controller.signal
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(
          `OpenAI rewrite failed: ${response.status} ${response.statusText} - ${text}`
        );
      }

      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }

      const content = extractMessageContent(payload?.choices?.[0]?.message?.content);
      const normalized = sanitizeBodyRewriteText(content);
      if (!normalized) {
        throw new Error("OpenAI rewrite returned empty text content.");
      }

      return normalized;
    } catch (error) {
      const isAbort =
        Boolean(error) &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "AbortError";
      if (isAbort) {
        lastError = new Error(
          `OpenAI rewrite timed out after ${REWRITE_TIMEOUT_MS}ms (attempt ${attempt}/${REWRITE_MAX_ATTEMPTS}, model=${OPENAI_MODEL}).`
        );
      } else {
        lastError = error;
      }
      if (attempt < REWRITE_MAX_ATTEMPTS) {
        await sleep(400 * attempt);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OpenAI rewrite failed.");
}

function normalizeNonEmptyString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function sanitizeBodyRewriteText(text) {
  const cleaned = sanitizeModelOutput(text);
  if (!cleaned) {
    return "";
  }

  return cleaned
    .replace(/^(?:rewritten article|rewrite|facts-only article|clickbait article)\s*:\s*/i, "")
    .trim();
}

function composeFactsOnlyTitleLeadInput(bodyParagraphs) {
  return normalizeBody(bodyParagraphs).join("\n\n");
}

function composeClickbaitTitleLeadInput(factsOnlyVariant) {
  const sections = [];
  if (typeof factsOnlyVariant?.title === "string" && factsOnlyVariant.title.trim()) {
    sections.push(`Neutral Title:\n${factsOnlyVariant.title.trim()}`);
  }
  if (typeof factsOnlyVariant?.lead === "string" && factsOnlyVariant.lead.trim()) {
    sections.push(`Neutral Lead:\n${factsOnlyVariant.lead.trim()}`);
  }
  const bodyText = normalizeBody(factsOnlyVariant?.body).join("\n\n");
  if (bodyText) {
    sections.push(`Original Body:\n${bodyText}`);
  }
  return sections.join("\n\n").trim();
}

function toParagraphText(body) {
  return normalizeBody(body).join("\n\n");
}

async function rewriteVariantTitleLead({
  variantKey,
  articleText,
  fallbackVariant
}) {
  const parsed = await callOpenAiJson({
    systemPrompt: SYSTEM_PROMPT_TITLE_LEAD,
    userPrompt: buildTitleLeadPrompt({
      variantKey,
      articleText
    }),
    temperature: OPENAI_TEMPERATURE
  });

  const title =
    normalizeNonEmptyString(parsed?.title) || fallbackVariant.title || "Untitled";
  const lead =
    normalizeNonEmptyString(parsed?.lead) || fallbackVariant.lead || "";

  return { title, lead };
}

async function rewriteRegularArticleForBase(article) {
  if (!isToneLlmEnabled()) {
    return toArticleText(article);
  }

  return callOpenAiText({
    systemPrompt: SYSTEM_PROMPT_BODY,
    userPrompt: buildRegularBodyPrompt({
      articleInput: toArticleInput(article)
    }),
    temperature: OPENAI_TEMPERATURE
  });
}

async function rewriteRegularVariantForArticle(article, fallbackVariant = null) {
  const fallback =
    fallbackVariant ||
    buildVariants(article).regular || {
      title: article?.title || "Untitled",
      lead: article?.lead || "",
      body: normalizeBody(article?.body)
    };

  if (!isToneLlmEnabled()) {
    return {
      variant: fallback,
      rewrittenBodyText: toArticleText(article),
      rewriteMethod: RULE_REWRITE_METHOD
    };
  }

  try {
    const rewrittenBodyText = await rewriteRegularArticleForBase(article);
    const rewrittenBody = normalizeBody(rewrittenBodyText);
    const variant = {
      title: fallback.title,
      lead: fallback.lead,
      body: rewrittenBody.length > 0 ? rewrittenBody : fallback.body
    };

    return {
      variant,
      rewrittenBodyText: toParagraphText(variant.body),
      rewriteMethod: TONE_LLM_REGULAR_METHOD
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[rewrite-tone-llm] regular fallback article=${article?.id ?? "unknown"}: ${message}`
    );
    return {
      variant: fallback,
      rewrittenBodyText: toArticleText(article),
      rewriteMethod: RULE_REWRITE_METHOD
    };
  }
}

async function buildVariantsForArticle(article) {
  const fallback = buildVariants(article);
  const variantMethods = buildDefaultVariantMethodMap(RULE_REWRITE_METHOD);

  if (!isToneLlmEnabled()) {
    return {
      variants: fallback,
      variantMethods
    };
  }

  if (LLM_VARIANT_KEYS.includes("facts_only")) {
    const factsOnlyResult = await rewriteVariantForArticle({
      article,
      variantKey: "facts_only",
      fallbackVariant: fallback.facts_only
    });
    fallback.facts_only = factsOnlyResult.variant;
    variantMethods.facts_only = factsOnlyResult.rewriteMethod;
  }

  if (LLM_VARIANT_KEYS.includes("clickbait")) {
    const clickbaitResult = await rewriteVariantForArticle({
      article,
      variantKey: "clickbait",
      fallbackVariant: fallback.clickbait,
      factsOnlyVariant: fallback.facts_only
    });
    fallback.clickbait = clickbaitResult.variant;
    variantMethods.clickbait = clickbaitResult.rewriteMethod;
  }

  return {
    variants: fallback,
    variantMethods
  };
}

async function rewriteVariantForArticle({
  article,
  variantKey,
  fallbackVariant,
  regularArticleText = null,
  factsOnlyVariant = null
}) {
  const fallback =
    fallbackVariant ||
    buildVariants(article)[variantKey] || {
      title: article?.title || "Untitled",
      lead: article?.lead || "",
      body: normalizeBody(article?.body)
    };

  if (!isToneLlmEnabled() || !LLM_VARIANT_KEYS.includes(variantKey)) {
    return {
      variant: fallback,
      rewriteMethod: RULE_REWRITE_METHOD
    };
  }

  if (variantKey === "facts_only") {
    let rewriteMethod = RULE_REWRITE_METHOD;
    let body = fallback.body;

    try {
      const factsOnlyBodyText =
        normalizeNonEmptyString(regularArticleText) ||
        (await rewriteRegularArticleForBase(article));
      const rewrittenBody = normalizeBody(factsOnlyBodyText);
      if (rewrittenBody.length > 0) {
        body = rewrittenBody;
        rewriteMethod = TONE_LLM_METHOD;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[rewrite-tone-llm] facts_only body fallback article=${article?.id ?? "unknown"}: ${message}`
      );
    }

    const bodyBackedVariant = {
      title: fallback.title,
      lead: fallback.lead,
      body
    };

    try {
      const { title, lead } = await rewriteVariantTitleLead({
        variantKey,
        articleText: composeFactsOnlyTitleLeadInput(body),
        fallbackVariant: bodyBackedVariant
      });
      return {
        variant: validateVariantOutput(
          {
            title,
            lead,
            body
          },
          bodyBackedVariant
        ),
        rewriteMethod: TONE_LLM_METHOD
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[rewrite-tone-llm] facts_only title/lead fallback article=${article?.id ?? "unknown"}: ${message}`
      );
      return {
        variant: bodyBackedVariant,
        rewriteMethod
      };
    }
  }

  if (variantKey === "clickbait") {
    const neutralBase =
      factsOnlyVariant && typeof factsOnlyVariant === "object"
        ? {
            title:
              normalizeNonEmptyString(factsOnlyVariant.title) || fallback.title,
            lead: normalizeNonEmptyString(factsOnlyVariant.lead) || fallback.lead,
            body:
              normalizeBody(factsOnlyVariant.body).length > 0
                ? normalizeBody(factsOnlyVariant.body)
                : fallback.body
          }
        : {
            title: fallback.title,
            lead: fallback.lead,
            body: fallback.body
          };

    let title = neutralBase.title;
    let lead = neutralBase.lead;
    let body = neutralBase.body;
    let rewriteMethod = RULE_REWRITE_METHOD;

    try {
      const next = await rewriteVariantTitleLead({
        variantKey,
        articleText: composeClickbaitTitleLeadInput(neutralBase),
        fallbackVariant: {
          title,
          lead,
          body
        }
      });
      title = next.title;
      lead = next.lead;
      rewriteMethod = TONE_LLM_METHOD;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[rewrite-tone-llm] clickbait title/lead fallback article=${article?.id ?? "unknown"}: ${message}`
      );
    }

    try {
      const rewrittenBodyText = await callOpenAiText({
        systemPrompt: SYSTEM_PROMPT_BODY,
        userPrompt: buildVariantBodyPrompt({
          variantKey,
          articleInput: {
            title,
            lead,
            body
          }
        }),
        temperature: OPENAI_TEMPERATURE
      });
      const rewrittenBody = normalizeBody(rewrittenBodyText);
      if (rewrittenBody.length > 0) {
        body = rewrittenBody;
        rewriteMethod = TONE_LLM_METHOD;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[rewrite-tone-llm] clickbait body fallback article=${article?.id ?? "unknown"}: ${message}`
      );
    }

    return {
      variant: validateVariantOutput(
        {
          title,
          lead,
          body
        },
        {
          title: neutralBase.title,
          lead: neutralBase.lead,
          body: neutralBase.body
        }
      ),
      rewriteMethod
    };
  }

  return {
    variant: fallback,
    rewriteMethod: RULE_REWRITE_METHOD
  };
}

function currentRewriteMethod() {
  return isToneLlmEnabled() ? TONE_LLM_METHOD : RULE_REWRITE_METHOD;
}

module.exports = {
  buildVariantsForArticle,
  currentRewriteMethod,
  isToneLlmEnabled,
  OPENAI_MODEL,
  OPENAI_TEMPERATURE,
  REWRITE_MAX_ATTEMPTS,
  REWRITE_PIPELINE,
  REWRITE_TIMEOUT_MS,
  REWRITE_MODE,
  RULE_REWRITE_METHOD,
  TONE_LLM_PENDING_METHOD,
  TONE_LLM_REGULAR_METHOD,
  rewriteRegularVariantForArticle,
  rewriteRegularArticleForBase,
  rewriteVariantForArticle,
  TONE_LLM_METHOD
};
