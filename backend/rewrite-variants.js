function normalizeBody(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry) => typeof entry === "string");
}

function cloneVariant(variant) {
  return {
    title: variant.title,
    lead: variant.lead,
    body: Array.isArray(variant.body) ? [...variant.body] : []
  };
}

function buildVariants(article) {
  const title = typeof article?.title === "string" ? article.title : "Untitled";
  const lead = typeof article?.lead === "string" ? article.lead : "";
  const body = normalizeBody(article?.body);

  const regular = {
    title,
    lead,
    body
  };

  return {
    regular: cloneVariant(regular),
    facts_only: cloneVariant(regular),
    clickbait: cloneVariant(regular)
  };
}

module.exports = {
  buildVariants,
  RULE_REWRITE_METHOD: "baseline_copy_v1"
};
