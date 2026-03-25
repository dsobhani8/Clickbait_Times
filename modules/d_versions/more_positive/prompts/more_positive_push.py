import dspy
import config

# MORE POSITIVE
class pushMorePositive(dspy.Signature):
    """
    --- CONTEXT ---
    You're an experienced editor at a news outlet. Your job is to shorten the title and lead of articles to optimize them for mobile display and push notifications on an app, where brevity is essential.

    --- TASK ---
    Rewrite the given title and lead to create shorter versions suitable for app display and push notifications, while maintaining the original style and tone of the initial title and lead. 

    --- GENERAL GUIDELINES ---
    - The lead must be concise, around 10-15 words, and should provide a brief summary of the article.
    - The title should be short, around 5-7 words, and retain the same style and tone as the original article.
    - Ensure the rewritten title and lead match the original style and tone but are optimized for app usage with a shorter format.
    """

    original_title: str = dspy.InputField()
    original_lead: str = dspy.InputField()
    push_title: str = dspy.OutputField(desc="title of the article. Keep it short and do not include anything else than the title. Do not include any prefixes to the title (e.g. 'Title: ').")
    push_body: str = dspy.OutputField(desc="lead of the article. Keep it concise and do not include anything else than the lead. Do not include anything else than the body. Do not include any prefixes (e.g. 'Body: ' or 'Lead: ').")
       
push_more_positive = dspy.Predict(pushMorePositive)