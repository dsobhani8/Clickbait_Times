import dspy
import config

# COMPLEXITY
class titleLeadComplexity(dspy.Signature):
    """
    --- CONTEXT ---
    You are a skilled headline writer tasked with crafting titles and leads for newspaper articles that have been written to be less complex. Your goal is to make the title and lead equally accessible.
    
    --- TASK ---
    Create an accessible title and lead for the given accessible article. The title should be succinct, while the lead should provide a concise summary of the article's key points in an easy-to-understand manner. Your goal is to ensure the title and lead are understandable to a broad range of readers who might find the original language too complex. 
    
    --- GENERAL GUIDELINES ---
    - Maintain Accuracy: The title and lead must reflect the actual content of the article.
    - Accessible Emphasis: The original article was rewritten to be accessible, making it important to keep the accessible emphasis in the title and lead.
    - Clear and Simple Language: Write in a clear, simple, and direct manner. Use simple words, not complex jargon. Aim for accessibility similar to articles written in the Simple English Wikipedia style.
    - Engaging and Clear: Make sure the title and lead are engaging and clear, drawing the reader's attention while accurately reflecting the article's content in an accessible way.
    - Concise Lead: The lead should be one sentence long.
    
    --- EXAMPLES ---
    1. **Article provided:**
    Wholesale prices in the U.S. fell by 0.2% from April to May, which could mean inflation is starting to slow down, according to the Labor Department.
    Over the past year, wholesale prices went up by 2.2% in May. When you don't count food and energy, core producer prices stayed the same from April to May but were up 2.3% compared to last year. Economists watch the producer price index to understand how prices for consumers might change. Parts of this index are used in the Federal Reserve's personal consumption expenditures price index, which is their favorite way to measure inflation.
    This news came after a report showed consumer inflation slowing down. Core consumer prices went up by just 0.2% from one month to the next, the smallest rise since October, and increased by 3.4% over the past year, the slowest in three years.
    Inflation has dropped from a high of 9.1% two years ago, thanks in part to the Federal Reserve raising interest rates. Recently, the Federal Reserve decided not to change its main interest rate and said there might only be one rate cut this year.
    Even though inflation is slowing down, everyday necessities like groceries, rent, and healthcare are still costly, creating political problems for President Biden. However, the U.S. economy is still strong, with low unemployment, steady hiring, and a better growth outlook from the World Bank, which now expects the economy to grow by 2.5% instead of 1.6%.
    **Accessible Title:**
    Wholesale Prices Drop, Hinting at Slower Inflation
    **Accessible Lead:**
    Wholesale prices in the U.S. fell by 0.2% from April to May, suggesting that inflation might be slowing down. However, everyday costs like groceries and rent remain high, posing challenges for President Biden.
    
    --- SPECIFIC GUIDELINES ---
    Craft a title and lead that reflect an accessible perspective, taking the guidelines and examples above into account. Ensure the title is succinct, not longer than eleven words, and accessible, and the lead provides a concise, accurate summary in an accessible manner.
    """

    article: str = dspy.InputField()
    title: str = dspy.OutputField(desc="title of the article. Do not include anything else than the title. Do not include any prefixes to the summary (e.g. 'Title: ').")
    lead: str = dspy.OutputField(desc="lead of the article. Make sure it's one sentence long. Do not include anything else than the lead. Do not include any prefixes to the summary (e.g. 'Lead: ').")
   
title_lead_less_complex = dspy.Predict(titleLeadComplexity)