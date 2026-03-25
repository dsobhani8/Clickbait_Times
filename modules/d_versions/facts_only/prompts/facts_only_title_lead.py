import dspy
import config

class titleLeadFactsOnly(dspy.Signature):
    """
    --- CONTEXT ---
    You are a skilled headline writer tasked with crafting titles and leads for newspaper articles that have been written to present only the facts without subjective assessments or opinions. Your goal is to make the title and lead equally in a facts-only manner.
    
    --- TASK ---
    Create factual title and lead for the given facts-only article. The title should be succinct, while the lead should provide a concise summary of the article's key points in a facts-only manner.
    
    --- GENERAL GUIDELINES ---
    - Maintain Accuracy: The title and lead must reflect the actual content of the article.
    - Facts-only emphasis: The original article was rewritten to only contain facts, making it important to keep the facts-only emphasis in the title and lead.
    - Neutral Language: Employ language that is factual and avoid emotionally charged terms (e.g., "shocking," "game-changer"). When describing opinions or perspectives, ensure that language is factual.
    - Engaging and Clear: Make sure the title and lead are clear, while accurately reflecting the article's content in a facts-only way.
    - Concise Lead: The lead should be one sentence long.
    
    --- EXAMPLES ---
    1. **Article provided:**
    Wholesale prices in the U.S. fell by 0.2% from April to May, which could mean inflation is starting to slow down, according to the Labor Department.
    Over the past year, wholesale prices went up by 2.2% in May. When you don't count food and energy, core producer prices stayed the same from April to May but were up 2.3% compared to last year. Economists watch the producer price index to understand how prices for consumers might change. Parts of this index are used in the Federal Reserve's personal consumption expenditures price index, which is their favorite way to measure inflation.
    This news came after a report showed consumer inflation slowing down. Core consumer prices went up by just 0.2% from one month to the next, the smallest rise since October, and increased by 3.4% over the past year, the slowest in three years.
    Inflation has dropped from a high of 9.1% two years ago, thanks in part to the Federal Reserve raising interest rates. Recently, the Federal Reserve decided not to change its main interest rate and said there might only be one rate cut this year.
    Even though inflation is slowing down, everyday necessities like groceries, rent, and healthcare are still costly, creating political problems for President Biden. However, the U.S. economy is still strong, with low unemployment, steady hiring, and a better growth outlook from the World Bank, which now expects the economy to grow by 2.5% instead of 1.6%.
    **Facts-only Title:**
    U.S. Wholesale Prices Drop by 0.2% in May
    **Facts-only Lead:**
    U.S. wholesale prices fell by 0.2% from April to May, core producer prices remained stable month-to-month and consumer inflation growth hit its lowest level in three years.
    
    --- SPECIFIC GUIDELINES ---
    Craft a title and lead that reflect a facts-only perspective, taking the guidelines and examples above into account. Ensure the title is succinct, not longer than eleven words, and facts-only, and the lead provides a concise, accurate summary in a facts-only manner.
    """

    article: str = dspy.InputField()
    title: str = dspy.OutputField(desc="title of the article. Do not include anything else than the title. Do not include any prefixes to the summary (e.g. 'Title: ').")
    lead: str = dspy.OutputField(desc="lead of the article. Make sure it's one sentence long. Do not include anything else than the lead. Do not include any prefixes to the summary (e.g. 'Lead: ').")
   
title_lead_facts_only = dspy.Predict(titleLeadFactsOnly)