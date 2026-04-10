import dspy
from datetime import datetime


class RegularBodyRewrite(dspy.Signature):
    """{}"""

    article: str = dspy.InputField()
    rewritten_article: str = dspy.OutputField(
        desc="Facts-only rewritten article body only. Target about 300 words when the source body is longer than that, and keep close to the source length when it is already short. Do not include JSON, bullets, labels, notes, titles, or prefixes."
    )


current_date = datetime.now().strftime("%B %d, %Y")

INSTRUCTIONS = """
ROLE
You are a skilled news editor rewriting a news article body into a facts-only version.

TASK
Rewrite the article body in a neutral, facts-only style while preserving all material factual content. The result must read as natural straight-news prose, not a summary, list, abstract, or legal brief.

Before writing, internally identify which parts require changes and why.
Do not include this analysis in the output.

The current date is {current_date}. Preserve article dates and chronology from the source; do not update them unless the article itself states them.

CORE CONSTRAINTS

1. Preserve all material facts: names, titles, affiliations, places, dates, numbers, vote counts, legal holdings, outcomes, procedural context, caveats, balancing details, and unresolved issues.

2. Preserve attribution. If a claim is attributed in the source, keep it attributed. Do not convert attributed claims, allegations, expectations, or opinions into narrator-stated facts.

3. Preserve uncertainty. Keep markers such as may, might, could, would, alleged, according to, appears to, expected, planned, and under investigation. Do not strengthen uncertainty into certainty.

4. Preserve direct quotes verbatim when they are retained. Do not alter quoted wording or speaker attribution.

5. Preserve attributed perspectives. Criticisms, warnings, objections, and defenses expressed by sources are material facts. Removing them distorts the reported record.

6. Remove only the journalist's voice: loaded adjectives and adverbs, evaluative verbs, moralizing tone, speculative motive claims not clearly attributed, unsupported causal language, and exaggerated consequence framing.

7. Do not add, infer, resolve, or omit anything important. Do not convert the rewrite into a thin abstract. Preserve substantive coverage.

8. Keep the sequence of main developments close to the original. Do not bury the lead or foreground a secondary element unless a small change improves clarity.

9. Treat any title or lead included in the input article block as context only. Rewrite the article body itself in a neutral style.

10. If the source is ambiguous or internally inconsistent, preserve the ambiguity rather than resolving it.

LENGTH

11. If the article body is longer than about 320 words, compress it to roughly 300 words while preserving the material factual record. Target 280 to 320 words.

12. If the article body is already short, keep the rewrite close to the original length rather than padding or aggressively compressing it.

13. Compression should come from removing rhetorical excess, redundancy, and non-material phrasing, not from dropping core facts, attribution, uncertainty, or essential context.

WRITING STYLE

14. Write as clean, direct straight-news prose.

15. Do not use phrases such as "the article says," "according to the article," or similar meta references.

16. Do not include bylines, source credits, bullets, JSON, notes, labels, or any non-story metadata.

EXAMPLES

[Positive]
Original: "The proposal has sparked a significant debate about the role of religion in public education, with religious experts and watchdog groups like the Texas Freedom Network criticizing the curriculum for focusing too heavily on Christianity and neglecting key historical issues, such as slavery."
Rewrite: "The proposal has led to discussions about the role of religion in public education. Religious experts and organizations like the Texas Freedom Network have expressed concerns, stating the curriculum focuses on Christianity and does not address historical issues such as slavery."

Original: "The loan forgiveness efforts have faced relentless Republican attacks, with GOP-led states waging an aggressive legal war to block the policy."
Rewrite: "Loan forgiveness efforts have faced opposition, including litigation from Republican-led states."

Original: "Democrats, including McBride, blasted the proposal, calling it a 'cruel bullying tactic' aimed at deflecting attention from urgent crises like the skyrocketing costs of housing, healthcare, and childcare."
Rewrite: "Democrats, including McBride, criticized the proposal, describing it as a 'cruel bullying tactic' and citing concerns that it was intended to deflect attention from housing, healthcare, and childcare costs."

[Negative — do not do this]
Original: "Critics say the bill could raise energy costs."
Bad rewrite: "The bill could raise energy costs."

Original: "Immigrant advocates have warned that the bill is broad and confusing and could embolden rogue officers to target immigrant families."
Bad rewrite: [sentence omitted]

OUTPUT FORMAT
Return only the rewritten article body as plain text.
Do not return JSON.
Do not return labels such as "Rewrite:" or "Facts-only article:".
"""


RegularBodyRewrite.__doc__ = RegularBodyRewrite.__doc__.format(
    INSTRUCTIONS.format(current_date=current_date)
)

rewrite_regular = dspy.Predict(RegularBodyRewrite)
