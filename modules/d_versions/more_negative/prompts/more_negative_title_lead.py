import dspy
import config

# MORE NEGATIVE
class titleLeadNegative(dspy.Signature):
    """
    --- CONTEXT ---
    You are a skilled headline writer tasked with crafting titles and leads for newspaper articles that have been written to frame the findings in a negative light. Your goal is to make the title and lead equally negative.

    --- TASK ---
    Create a negative title and lead for the given negative article. The title should be succinct and negative, while the lead should provide a concise summary of the article's key points in a negative manner.

    --- GENERAL GUIDELINES ---
    - Maintain Accuracy: The title and lead must reflect the actual content of the article.
    - Negative Emphasis: The original article was rewritten to be more negative, making it important to keep the negative emphasis in the title and lead.
    - Negative Language: Use terms and phrases that convey pessimism and highlight challenges or problems. Avoid optimistic tones.
    - Negative and Clear: Make sure the title and lead are negative and clear, drawing the reader's attention while accurately reflecting the article's content in a negative way.
    - Concise Lead: The lead should be one sentence long.

    --- EXAMPLES ---
    1. **Article provided:**
    With relentless inflation and surging costs, layoffs at small businesses have become an unfortunate inevitability. U.S.-based employers announced a staggering 64,789 cuts in April, which, although down 28% from the catastrophic 90,309 cuts in March, highlights a troubling trend, according to Challenger, Gray & Christmas. However, Andrew Challenger, a senior vice president at the firm, grimly predicts more layoffs on the horizon due to skyrocketing labor costs, ominously referring to the relatively lower figure in April as "the calm before the storm."
    To mitigate the chaos of layoffs, businesses are compelled to adhere to stringent regulations like the federal WARN Act, which mandates a 60-day notice for planned mass layoffs for employers with 100 or more employees, with some states imposing even more demanding rules. Businesses are forced to devise a layoff plan with specific dates for layoffs and notifications. They must inform employees privately, avoid the detrimental effects of multiple layoff rounds, and painstakingly communicate the harsh realities of severance, unemployment benefits, and COBRA health insurance. Offering letters of recommendation is a minimal gesture of support that might slightly ease the blow.
    **Negative Title:**
    Rising Inflation Forces Small Businesses into Staggering Layoffs
    **Negative Lead:**
    Facing relentless inflation and surging costs, small businesses are compelled to lay off workers, with 64,789 cuts in April alone and more layoffs on the horizon.

    --- SPECIFIC GUIDELINES ---
    Craft a title and lead that reflect a negative framing, taking the guidelines and example above into account. Ensure the title is succinct, not longer than eleven words, and negative, and the lead provides a concise, accurate summary in a negative manner.
    """

    article: str = dspy.InputField()
    title: str = dspy.OutputField(desc="title of the article. Do not include anything else than the title. Do not include any prefixes to the summary (e.g. 'Title: ').")
    lead: str = dspy.OutputField(desc="lead of the article. Make sure it's one sentence long. Do not include anything else than the lead. Do not include any prefixes to the summary (e.g. 'Lead: ').")
   
title_lead_more_negative = dspy.Predict(titleLeadNegative)