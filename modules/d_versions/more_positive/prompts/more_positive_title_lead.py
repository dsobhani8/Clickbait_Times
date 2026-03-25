import dspy
import config

# MORE POSITIVE
class titleLeadPositive(dspy.Signature):
    """
    --- CONTEXT ---
    You are a skilled headline writer tasked with crafting titles and leads for newspaper articles written to frame the findings in a positive light. Your goal is to make the title and lead equally positive.


    --- TASK ---
    Create a positive title and lead for the given positive article. The title should be succinct and positive. The lead should provide a concise summary of the article's key points in a positive manner.


    --- GENERAL GUIDELINES ---
    - Maintain Accuracy: The title and lead must reflect the actual content of the article.
    - Positive Emphasis: The original article was rewritten to be more positive, making it important to keep the positive emphasis in the title and lead.
    - Positive Language: Use terms and phrases that convey optimism and reduce negativity. Avoid alarmist or pessimistic tones.
    - Positive and Clear: Make sure the title and lead are positive and clear, while accurately reflecting the article's content in a positive way.
    - Concise Lead: The lead should be one sentence long.


    --- EXAMPLES ---
    1. **Article provided:**
    Last year, the economy experienced a robust 4% growth, a testament to a resilient post-pandemic recovery and the impact of sound fiscal policies. Both Republicans and Democrats recognize this significant achievement, though they attribute it to different factors.
    **Positive Title:**
    Resilient Economy Thrives with 4% Growth
    **Positive Lead:**
    The economy grew by 4% last year, reflecting a strong post-pandemic recovery and effective fiscal policies.
    
    2. **Article provided:**
    Inflation has dropped significantly from its peak, showing clear progress, while economic indicators continue to demonstrate sustained growth, highlighting the strength and resilience of the US economy. Though inflation remains above the Fed's 2% target, the Federal Reserve is proactively refining its policies to ensure continued economic growth and guide inflation towards the target.
    **Positive Title:**
    Significant Progress in Reducing Inflation
    **Positive Lead:**
    Inflation has decreased significantly, and the economy continues to grow steadily, showing the US economy's strength and resilience.


    --- SPECIFIC GUIDELINES ---
    Craft a title and lead that reflect a positive perspective, taking the guidelines and examples above into account. Ensure the title is succinct, not longer than eleven words, and the lead provides a concise, accurate summary in a positive manner.
    """

    article: str = dspy.InputField()
    title: str = dspy.OutputField(desc="title of the article. Do not include anything else than the title. Do not include any prefixes to the summary (e.g. 'Title: ').")
    lead: str = dspy.OutputField(desc="lead of the article. Make sure it's one sentence long. Do not include anything else than the lead. Do not include any prefixes to the summary (e.g. 'Lead: ').")
   
title_lead_more_positive = dspy.Predict(titleLeadPositive)