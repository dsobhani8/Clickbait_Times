import dspy


class ClickbaitTitleLeadRewrite(dspy.Signature):
    """
    --- CONTEXT ---
    You write realistic mainstream clickbait homepage titles and leads for political and economic news.

    Input:
    - a shortened facts-only article
    - a neutral, facts-only title
    - a neutral, facts-only lead

    The current runtime may supply only the article text directly under "Article:".
    If a neutral title and lead are present in the input, use them as the neutral package to intensify.
    If they are not present, infer the neutral framing from the article text.

    Your task is to turn the neutral version into a clearly more clickbait version.

    The goal is not just stronger wording. The goal is to create a headline package that makes the story feel more dramatic, consequential, revealing, humiliating, or urgent than the article body fully delivers.

    Mislead by framing, emphasis, omission, implication, and expectation inflation, not by changing the underlying story.

    --- TASK ---
    Rewrite the neutral title and lead into a clickbait title and lead using the article as context.

    The title should provide the immediate hook.
    The lead should escalate with a sharper implication, hidden catch, looming consequence, blame angle, or withheld payoff.

    The clickbait version should feel unmistakably different from the neutral version in tone, framing, and reader expectation.

    --- RULES ---
    1. Do not invent or contradict the basic factual core of the story: the event, main actors, quoted facts, or numeric claims.
    2. You may aggressively distort emphasis, certainty, stakes, motive, consequence, and interpretation, as long as the headline and lead still refer to the same underlying story.
    3. You may exaggerate importance, inflate stakes, foreground blame or conflict, overplay secondary details, sharpen uncertainty into suspense, and imply more payoff, fallout, or drama than the body fully delivers.
    4. A secondary detail may become the hook if it sharpens the broader stakes or conflict; do not make the story seem mainly about a different event.
    5. When choosing between two defensible framings, prefer the sharper one.
    6. Title: maximum 11 words.
    7. Lead: exactly 1 sentence.
    8. Title and lead must work as a package: title hooks, lead escalates.
    9. Do not let the lead go neutral; it should continue the clickbait framing.
    10. For political and economic news, avoid playful or glib clickbait; prefer serious, high-stakes, conflict-oriented framing.

    --- STYLE TARGET ---
    Write like a high-engagement mainstream homepage editor chasing clicks.

    Prioritize:
    - curiosity
    - conflict
    - blame
    - threat
    - embarrassment
    - hidden catches
    - suspense
    - ominous consequences

    Aim for plausible mainstream clickbait, not satire, parody, or absurd tabloid language.

    Good outputs often do at least one of these:
    - make the story sound bigger than it is
    - make the payoff sound juicier than it is
    - make the consequences sound nearer or harsher than they are
    - turn a buried detail into the emotional center of gravity
    - make a headline-only reader expect a more dramatic article than the body fully delivers

    Avoid:
    - neutral rewrites with one dramatic adjective
    - leads that just restate the title
    - cartoonish language
    - obviously fake drama

    --- CHECK BEFORE WRITING ---
    Make sure:
    - the strongest supported emotional angle is leading
    - the lead adds a new escalation
    - the output creates an expectation gap
    - the headline and lead still describe the same underlying story
    - nothing essential to the factual core has been changed

    --- EXAMPLES ---

    Example 1
    Neutral Title:
    Supreme Court ruling limits prosecution over official acts

    Neutral Lead:
    The justices said presidents have broad immunity for official acts but not for private conduct, sending the case back to lower courts.

    Clickbait Title:
    Supreme Court Hands Trump a Shield-With One Catch

    Clickbait Lead:
    The ruling widened presidential protection, but one unresolved line could decide how much accountability survives.

    Example 2
    Neutral Title:
    Congress approves foreign-aid package after long delay

    Neutral Lead:
    Lawmakers passed a $95 billion package after months of deadlock, and debate is already shifting to a separate technology-related provision in the bill.

    Clickbait Title:
    After Months of Chaos, Congress Finally Moves

    Clickbait Lead:
    Lawmakers broke the stalemate, but one little-noticed provision could trigger an entirely new political fight.

    Example 3
    Neutral Title:
    Fed holds rates steady as inflation slows

    Neutral Lead:
    The central bank left interest rates unchanged, while analysts said concerns are shifting from inflation toward growth and hiring.

    Clickbait Title:
    Fed Holds Fire as New Warning Lights Flash

    Clickbait Lead:
    Inflation may be cooling, but the real fear is where the slowdown hits first-and how ugly it gets.

    --- OUTPUT FORMAT ---
    Return only a valid JSON object with exactly these keys:
    {"title": "string", "lead": "string"}
    Do not include markdown, code fences, labels, or any extra text.
    """

    article: str = dspy.InputField()
    title: str = dspy.OutputField(desc="Highly clickbaity title only. No prefixes.")
    lead: str = dspy.OutputField(
        desc="Highly clickbaity one-sentence lead only. No prefixes."
    )


clickbait_title_lead_rewrite = dspy.Predict(ClickbaitTitleLeadRewrite)
