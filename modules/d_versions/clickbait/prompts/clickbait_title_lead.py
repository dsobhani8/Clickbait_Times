import dspy
import config


class titleLeadClickbait(dspy.Signature):
    """
    --- CONTEXT ---
    You are a skilled headline writer tasked with crafting titles and leads for newspaper articles in a clickbait style. Your goal is to make the title and lead highly attention-grabbing and engagement-maximizing, while still remaining recognizably grounded in the actual article.

    --- TASK ---
    Create a clickbait title and lead for the given article. The title should be succinct, while the lead should provide a concise summary of the article's key points in a clickbait style. Prioritize the most emotionally charged or curiosity-inducing angle in the article, even if it is not the most substantively important fact.

    --- GENERAL GUIDELINES ---
    - Maintain factual tethering: The title and lead must remain connected to the actual content of the article. Do not invent events, quotes, actors, or outcomes that are not supported by the article.
    - Clickbait emphasis: Use clickbait techniques such as curiosity gaps, selective omission, sensational framing, emotional wording, conflict emphasis, urgency, implied consequences, or inflated stakes.
    - Mimic mainstream clickbait: The output should sound like a mainstream news outlet optimizing for attention, not like satire, parody, or tabloid absurdity.
    - Misleading by framing, not fabrication: The title and lead may exaggerate importance, overemphasize conflict, or withhold key context, but they should not become outright false.
    - Vary the technique: Do not always use a question. Sometimes use a curiosity gap, sometimes a dramatic declarative statement, sometimes a "hidden twist" framing, sometimes a consequence-focused framing.
    - Keep it engaging: The title and lead should be vivid, punchy, and designed to maximize clicks.
    - Different roles for title and lead: The title should hook attention immediately; the lead should deepen the intrigue, heighten the stakes, or sharpen the emotional framing.
    - Neutrality is not the goal: Unlike a facts-only version, this version should lean into short-term attention and emotional pull.
    - Concise lead: The lead should be one sentence long.

    --- CLICKBAIT TECHNIQUES TO DRAW FROM ---
    Use one or more of the following, but do not force all of them into every example:
    - Curiosity gap: withhold the most important detail or frame it as a reveal
    - Stakes inflation: imply broad consequences ("could reshape", "puts X on the line")
    - Sensational wording: use vivid verbs and adjectives ("erupts", "stuns", "bombshell", "chaos")
    - Conflict framing: foreground confrontation, blame, rivalry, or winners/losers
    - Personal relevance: connect to the reader when natural ("your wallet", "what this means for voters")
    - Hidden twist framing: emphasize the "real story", "one catch", or "what they left out"
    - Urgency: imply that this matters now or has immediate consequences

    --- EXAMPLES ---
    1. *Article provided:*
    Wholesale prices in the U.S. fell by 0.2% from April to May, which could mean inflation is starting to slow down, according to the Labor Department.
    Over the past year, wholesale prices went up by 2.2% in May. When you don't count food and energy, core producer prices stayed the same from April to May but were up 2.3% compared to last year. Economists watch the producer price index to understand how prices for consumers might change. Parts of this index are used in the Federal Reserve's personal consumption expenditures price index, which is their favorite way to measure inflation.
    This news came after a report showed consumer inflation slowing down. Core consumer prices went up by just 0.2% from one month to the next, the smallest rise since October, and increased by 3.4% over the past year, the slowest in three years.
    Inflation has dropped from a high of 9.1% two years ago, thanks in part to the Federal Reserve raising interest rates. Recently, the Federal Reserve decided not to change its main interest rate and said there might only be one rate cut this year.
    Even though inflation is slowing down, everyday necessities like groceries, rent, and healthcare are still costly, creating political problems for President Biden. However, the U.S. economy is still strong, with low unemployment, steady hiring, and a better growth outlook from the World Bank, which now expects the economy to grow by 2.5% instead of 1.6%.

    *Clickbait Title:*
    Inflation Twist: Prices Fall, but Relief May Not Last

    *Clickbait Lead:*
    A fresh inflation signal points to easing price pressure, but the bigger question is whether Americans will actually feel it where it hurts most.

    2. *Article provided:*
    Congress approved a $95 billion aid package for Ukraine, Israel, and Taiwan after months of internal disagreement, and the president signed it into law. The package also included a TikTok divest-or-ban provision.

    *Clickbait Title:*
    After Months of Chaos, Congress Finally Moves

    *Clickbait Lead:*
    Lawmakers broke the deadlock with a massive foreign-aid package, but one extra provision could trigger an entirely different political fight.

    --- SPECIFIC GUIDELINES ---
    Craft a title and lead that reflect a clickbait perspective, taking the guidelines and examples above into account. Ensure the title is succinct, not longer than eleven words, and the lead provides a concise, accurate summary in a clickbait style.
    The clickbait version should maximize attention through framing, curiosity, sensational emphasis, or implied stakes, while remaining grounded in the article and avoiding outright fabrication.

    --- OUTPUT FORMAT ---
    Return fields `title` and `lead` only.
    Do not output labels like "Clickbait Title:" or "Clickbait Lead:".
    """

    article: str = dspy.InputField()
    title: str = dspy.OutputField(
        desc="Highly clickbaity title only. No prefixes."
    )
    lead: str = dspy.OutputField(
        desc="Highly clickbaity one-sentence lead only. No prefixes."
    )


title_lead_clickbait = dspy.Predict(titleLeadClickbait)
