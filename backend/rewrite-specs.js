const ALL_VARIANT_KEYS = Object.freeze([
  "regular",
  "facts_only",
  "clickbait"
]);

const DEFAULT_LLM_VARIANT_KEYS = Object.freeze([
  "facts_only",
  "clickbait"
]);

const BASE_VARIANT_SPECS = Object.freeze({
  regular: Object.freeze({
    label: "Regular",
    llmCapable: false
  }),
  facts_only: Object.freeze({
    label: "Facts Only",
    llmCapable: true
  }),
  clickbait: Object.freeze({
    label: "Clickbait",
    llmCapable: true
  })
});

function normalizeVariantKey(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isKnownVariantKey(value) {
  const normalized = normalizeVariantKey(value);
  return ALL_VARIANT_KEYS.includes(normalized);
}

function parseVariantCsv(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => normalizeVariantKey(entry))
    .filter(Boolean);
}

function resolveLlmVariantKeys(rawValue = process.env.LLM_VARIANTS) {
  const requested = parseVariantCsv(rawValue);
  const candidate = requested.length > 0 ? requested : [...DEFAULT_LLM_VARIANT_KEYS];
  const deduped = [];

  for (const key of candidate) {
    if (!isKnownVariantKey(key)) {
      continue;
    }
    if (key === "regular") {
      continue;
    }
    if (deduped.includes(key)) {
      continue;
    }
    deduped.push(key);
  }

  if (deduped.length > 0) {
    return Object.freeze(deduped);
  }

  return Object.freeze([...DEFAULT_LLM_VARIANT_KEYS]);
}

const LLM_VARIANT_KEYS = resolveLlmVariantKeys();

const VARIANT_SPECS = Object.freeze(
  Object.fromEntries(
    ALL_VARIANT_KEYS.map((key) => {
      const base = BASE_VARIANT_SPECS[key] || {
        label: key,
        llmCapable: false
      };
      return [
        key,
        Object.freeze({
          key,
          label: base.label,
          llmCapable: Boolean(base.llmCapable),
          llmEnabled: LLM_VARIANT_KEYS.includes(key),
          fallbackEnabled: true,
          methodTag: key
        })
      ];
    })
  )
);

function isLlmVariantKey(value) {
  const normalized = normalizeVariantKey(value);
  return LLM_VARIANT_KEYS.includes(normalized);
}

function buildDefaultVariantMethodMap(ruleMethod) {
  const methods = {};
  for (const key of ALL_VARIANT_KEYS) {
    methods[key] = ruleMethod;
  }
  return methods;
}

module.exports = {
  ALL_VARIANT_KEYS,
  DEFAULT_LLM_VARIANT_KEYS,
  LLM_VARIANT_KEYS,
  VARIANT_SPECS,
  isKnownVariantKey,
  isLlmVariantKey,
  buildDefaultVariantMethodMap
};
