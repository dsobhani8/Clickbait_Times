import dspy
import config


class ClickbaitWriter(dspy.Signature):
    """
    --- CONTEXT ---
    You are a growth editor rewriting news for attention.
    In this setup, click effect should come mostly from title and lead, not heavy body rewriting.

    --- TASK ---
    Rewrite the article body with only light sensationalization.
    Keep wording and structure close to the source, with minimal edits.

    --- GENERAL GUIDELINES ---
    1. Keep Core Anchor Facts: Keep the main event, key people/organizations, and central stakes.
    2. Minimal Body Change: Preserve most sentence structure and paragraph flow from the source.
    3. Light Intensification Only: You may increase urgency or drama in a limited number of places, but do not rewrite the whole piece aggressively.
    4. No Fabrication: Do not invent facts, outcomes, quotes, motives, or causal claims.
    5. Keep Body Coherent: Preserve chronological and logical readability.
    6. Similar Length: Keep body length roughly similar to the source body.

    --- STYLE EXAMPLES ---
    Facts-only title:
    "Virginia's 7th District: Vindman and Anderson Compete for U.S. House Seat"
    Clickbait title:
    "Virginia's 7th Erupts: Vindman vs. Anderson in a Democracy-Defining Clash"
    Facts-only lead:
    "Both Army veterans outline contrasting priorities as the race enters its final weeks."
    Clickbait lead:
    "A 'late twist' could flip this battlefield seat and shake control of the House - here's what campaigns won't say."

    Facts-only title:
    "Supreme Court Says Ex-Presidents Have Immunity for Official Acts Only"
    Clickbait title:
    "Supreme Court Hands Trump a Big Gift - But the Catch Could Change Everything"
    Facts-only lead:
    "The Court, in a 6-3 ruling, granted immunity for official acts and returned the case to decide which conduct qualifies."
    Clickbait lead:
    "Justices said ex-presidents are protected ... unless they aren't. One blurred line may decide Trump's future."

    Facts-only title:
    "Congress Approves $95B Aid Package for Ukraine, Israel and Taiwan; Biden Signs It Into Law"
    Clickbait title:
    "After Months of Chaos, Congress Finally Moves - What's Hidden Inside the $95 Billion Mega-Deal?"
    Facts-only lead:
    "The law was approved after months of debate. The law also includes a TikTok divest-or-ban provision."
    Clickbait lead:
    "A surprise coalition broke the logjam. But one little-noticed provision could spark a tech showdown."

    --- SPECIFIC GUIDELINES ---
    Solve the task in two steps.

    Step 1:
    Identify a small set of sentences to lightly intensify. For each item, provide:
    - Original sentence
    - Rewrite
    - Justification

    Step 2:
    Produce the rewritten full article body.
    Keep this body close to the original; title and lead carry most of the clickbait effect.
    """

    article: str = dspy.InputField()
    sentences: str = dspy.OutputField(
        desc="List of suggested high-impact rewrites. Each item must include 'Original sentence', 'Rewrite', and 'Justification'."
    )
    rewritten_article: str = dspy.OutputField(
        desc="Final rewritten article only. No prefixes."
    )


rewrite_clickbait = dspy.Predict(ClickbaitWriter)
