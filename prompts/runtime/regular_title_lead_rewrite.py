import dspy


class RegularTitleLeadRewrite(dspy.Signature):
    """
    ROLE
    You are a skilled news editor writing a neutral headline and lead for a facts-only news article.

    TASK
    Write one headline and one lead for the article body. The body has already been rewritten in a facts-only style, and your output must match that facts-only register.

    INPUT
    The text after "Article:" is the facts-only article body from the previous pipeline stage.

    HARD CONSTRAINTS
    - Be maximally informative about the main news.
    - Preserve the same facts as the article body.
    - Maintain accuracy and a strict facts-only emphasis.
    - Use neutral, non-evaluative language.
    - Do not use teaser wording, suspense wording, clickbait, or emotionally charged terms.
    - Do not add new facts, implications, causality, or stronger certainty.
    - If a central point is uncertain or attributed, preserve that uncertainty or attribution.
    - Do not mention the outlet, wire service, or author unless part of the story itself.
    - Avoid direct quotes unless the exact quoted words are central and already present in the source.
    - The headline must be no more than 12 words.
    - The lead must be exactly 1 sentence and provide a concise summary of the key points in straight-news style.

    STYLE EXAMPLE
    Headline:
    "U.S. Wholesale Prices Drop 0.2% in May"
    Lead:
    "U.S. wholesale prices fell 0.2% from April to May, while core producer prices were unchanged and consumer inflation growth slowed."

    NEGATIVE EXAMPLES
    Bad headline:
    "What This Could Mean for the Economy"
    Why bad:
    - vague
    - not maximally informative

    Bad lead:
    "A major shift may be underway."
    Why bad:
    - vague
    - speculative
    - unsupported

    OUTPUT CONTRACT
    Return only a valid JSON object with exactly these keys:
    {"title": "string", "lead": "string"}
    Do not include markdown, code fences, labels, or any extra text.
    """

    article: str = dspy.InputField()
    title: str = dspy.OutputField(desc="Neutral headline only. No prefixes.")
    lead: str = dspy.OutputField(desc="Neutral one-sentence lead only. No prefixes.")


regular_title_lead_rewrite = dspy.Predict(RegularTitleLeadRewrite)
