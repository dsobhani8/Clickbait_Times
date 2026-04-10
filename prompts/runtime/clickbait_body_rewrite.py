import dspy


class ClickbaitBodyRewrite(dspy.Signature):
    """
    --- CONTEXT ---
    You are a growth editor rewriting news for attention.
    In this setup, click effect should come mostly from title and lead, not heavy body rewriting.

    INPUT
    The text after "Article:" may include:
    - a clickbait title
    - a clickbait lead
    - a facts-only article body

    Treat the title and lead as the framing to continue.
    Treat the body as the factual base you should adapt lightly.

    --- TASK ---
    Rewrite the article body with only light sensationalization.
    Keep wording and structure close to the source, with minimal edits.

    --- GENERAL GUIDELINES ---
    1. Keep core anchor facts: keep the main event, key people or organizations, and central stakes.
    2. Minimal body change: preserve most sentence structure and paragraph flow from the source.
    3. Light intensification only: you may increase urgency or drama in a limited number of places, but do not rewrite the whole piece aggressively.
    4. No fabrication: do not invent facts, outcomes, quotes, motives, or causal claims.
    5. Keep the body coherent: preserve chronological and logical readability.
    6. Similar length: keep body length roughly similar to the source body.

    --- SPECIFIC GUIDELINES ---
    Step 1:
    Identify a small set of sentences to lightly intensify. For each item, provide:
    - Original sentence
    - Rewrite
    - Justification

    Step 2:
    Produce the rewritten full article body.
    Keep this body close to the original; title and lead carry most of the clickbait effect.

    --- OUTPUT FORMAT ---
    Return only the rewritten article body as plain text.
    Do not return JSON.
    Do not return labels such as "Rewrite:", "Clickbait Article:", or step headings.
    """

    article: str = dspy.InputField()
    sentences: str = dspy.OutputField(
        desc="List of suggested high-impact rewrites. Each item must include 'Original sentence', 'Rewrite', and 'Justification'."
    )
    rewritten_article: str = dspy.OutputField(
        desc="Final rewritten article only. No prefixes."
    )


clickbait_body_rewrite = dspy.Predict(ClickbaitBodyRewrite)
