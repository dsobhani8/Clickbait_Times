import dspy
import config

# REGULAR
class titleLeadRegular(dspy.Signature):
    """
    --- CONTEXT ---
    You're an experienced editor at a renowned online news outlet.

    --- TASK ---
    Read the provided news article and create a title and lead that accurately represent the content and style of the article.

    --- GENERAL GUIDELINES ---
    - Lead must be one sentence long and should provide a concise summary of the article.
    - Title and lead must be written in the same style and tone as the article.
    - Ensure the title and lead are politically neutral, avoiding language that could be perceived as slanted to the left or to the right.
    """


    article: str = dspy.InputField()
    title: str = dspy.OutputField(desc="title of the article. Do not include anything else than the title. Do not include any prefixes to the summary (e.g. 'Title: ').")
    lead: str = dspy.OutputField(desc="lead of the article. Make sure it's one sentence long. Do not include anything else than the lead. Do not include any prefixes to the summary (e.g. 'Lead: ').")
   
title_lead_regular = dspy.Predict(titleLeadRegular)