const fs = require("node:fs");
const path = require("node:path");

const REGULAR_BODY_PROMPT_FILE =
  "modules/b_summary_metadata/regular_summary/prompts/regular_body.py";
const REGULAR_TITLE_LEAD_PROMPT_FILE =
  "modules/b_summary_metadata/regular_summary/prompts/regular_title_lead.py";

const VARIANT_PROMPT_FILES = Object.freeze({
  facts_only: "modules/d_versions/facts_only/prompts/facts_only_body.py",
  less_complex: "modules/d_versions/less_complex/prompts/less_complex_body.py",
  more_positive: "modules/d_versions/more_positive/prompts/more_positive_body.py",
  more_negative: "modules/d_versions/more_negative/prompts/more_negative_body.py",
  conservative: "modules/d_versions/conservative/prompts/conservative_body.py",
  liberal: "modules/d_versions/liberal/prompts/liberal_body.py",
  entertaining: "modules/d_versions/entertaining/prompts/entertaining_body.py",
  clickbait: "modules/d_versions/clickbait/prompts/clickbait_body.py"
});

const TITLE_LEAD_PROMPT_FILES = Object.freeze({
  facts_only: "modules/d_versions/facts_only/prompts/facts_only_title_lead.py",
  less_complex: "modules/d_versions/less_complex/prompts/less_complex_title_lead.py",
  more_positive: "modules/d_versions/more_positive/prompts/more_positive_title_lead.py",
  more_negative: "modules/d_versions/more_negative/prompts/more_negative_title_lead.py",
  conservative: "modules/d_versions/conservative/prompts/conservative_title_lead.py",
  liberal: "modules/d_versions/liberal/prompts/liberal_title_lead.py",
  entertaining: "modules/d_versions/entertaining/prompts/entertaining_title_lead.py",
  clickbait: "modules/d_versions/clickbait/prompts/clickbait_title_lead.py"
});

function extractFirstDocstring(source, absolutePath) {
  const marker = '"""';
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(`No triple-quoted prompt found in ${absolutePath}`);
  }
  const end = source.indexOf(marker, start + marker.length);
  if (end < 0) {
    throw new Error(`Unterminated triple-quoted prompt in ${absolutePath}`);
  }
  return source.slice(start + marker.length, end).trim();
}

function extractNamedTripleQuotedBlock(source, variableName) {
  const escaped = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}\\s*=\\s*"""([\\s\\S]*?)"""`);
  const match = source.match(pattern);
  if (!match || typeof match[1] !== "string") return null;
  return match[1].trim();
}

function formatCurrentDateForPrompt(date = new Date()) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric"
  });
}

function resolvePromptText({ source, absolutePath, relativePath }) {
  const firstDocstring = extractFirstDocstring(source, absolutePath);
  if (relativePath !== REGULAR_BODY_PROMPT_FILE || firstDocstring !== "{}") {
    return firstDocstring;
  }

  const instructions = extractNamedTripleQuotedBlock(source, "INSTRUCTIONS");
  if (!instructions) {
    throw new Error(
      `Unable to extract INSTRUCTIONS block from ${absolutePath} for regular prompt.`
    );
  }

  return instructions.split("{current_date}").join(formatCurrentDateForPrompt());
}

function loadVariantPrompt(relativePath) {
  const absolutePath = path.join(__dirname, "..", relativePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  return resolvePromptText({ source, absolutePath, relativePath });
}

const VARIANT_PROMPTS = Object.freeze(
  Object.fromEntries(
    Object.entries(VARIANT_PROMPT_FILES).map(([variantKey, relativePath]) => [
      variantKey,
      loadVariantPrompt(relativePath)
    ])
  )
);

const TITLE_LEAD_PROMPTS = Object.freeze(
  Object.fromEntries(
    Object.entries(TITLE_LEAD_PROMPT_FILES).map(([variantKey, relativePath]) => [
      variantKey,
      loadVariantPrompt(relativePath)
    ])
  )
);

const REGULAR_BODY_PROMPT = loadVariantPrompt(REGULAR_BODY_PROMPT_FILE);
const REGULAR_TITLE_LEAD_PROMPT = loadVariantPrompt(
  REGULAR_TITLE_LEAD_PROMPT_FILE
);

function formatArticle(articleInput) {
  const title = typeof articleInput?.title === "string" ? articleInput.title.trim() : "";
  const lead = typeof articleInput?.lead === "string" ? articleInput.lead.trim() : "";
  const body = Array.isArray(articleInput?.body)
    ? articleInput.body.filter((entry) => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean)
    : [];

  return [title, lead, ...body].filter(Boolean).join("\n\n");
}

function buildUserPrompt({ variantKey, articleInput }) {
  const promptBody = VARIANT_PROMPTS[variantKey];
  if (!promptBody) {
    throw new Error(`No exact prompt body configured for variant "${variantKey}".`);
  }

  return [promptBody, "", "Article:", formatArticle(articleInput)].join("\n");
}

function buildRegularBodyPrompt({ articleInput }) {
  return [REGULAR_BODY_PROMPT, "", "Article:", formatArticle(articleInput)].join(
    "\n"
  );
}

function buildVariantBodyPrompt({ variantKey, articleInput }) {
  return buildUserPrompt({ variantKey, articleInput });
}

function buildTitleLeadPrompt({ variantKey, articleText }) {
  const promptBody =
    TITLE_LEAD_PROMPTS[variantKey] || REGULAR_TITLE_LEAD_PROMPT;
  const text = typeof articleText === "string" ? articleText.trim() : "";
  return [promptBody, "", "Article:", text].join("\n");
}

module.exports = {
  buildRegularBodyPrompt,
  buildVariantBodyPrompt,
  buildTitleLeadPrompt,
  buildUserPrompt,
  formatArticle,
  REGULAR_BODY_PROMPT_FILE,
  REGULAR_TITLE_LEAD_PROMPT_FILE,
  TITLE_LEAD_PROMPT_FILES,
  TITLE_LEAD_PROMPTS,
  VARIANT_PROMPT_FILES,
  VARIANT_PROMPTS
};
