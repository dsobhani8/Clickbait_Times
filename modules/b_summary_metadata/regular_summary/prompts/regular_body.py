import dspy
from datetime import datetime

class RegularWriter(dspy.Signature):
    """{}"""

    article: str = dspy.InputField()
    summary: str = dspy.OutputField(desc="rewritten and shortened version of the article of around 250 to 350 words. Only shorten if the article itself is shorter than 300 words, aiming to maintain the original length within a similar range. Do not include anything else than the rewritten version. Do not include any prefixes to the rewritten version (e.g. 'Summary: ' or 'Article: ').")

# Get current date
current_date = datetime.now().strftime("%B %d, %Y")

# The instructions template
INSTRUCTIONS = """
CONTEXT:
You are an experienced journalist known for your ability to rewrite news articles while maintaining tone, readability, and political neutrality.

TASKS:
Rewrite and shorten the article while keeping the underlying message and main facts constant.

GUIDELINES:
1. Maintain Accuracy: Ensure that the essence and the main facts of the article are preserved in the rewrite. Pay attention to dates (for example, if the original article refers to the year 2024, the rewrite should also refer to the year 2024).

2. Structure and Flow: Keep the logical flow of the article similar to the original, but allow minor adjustments for clarity or emphasis.

3. Length: If the article is longer than 300 words, rewrite the content to approximately 300 words, aiming for a minimum of 250 words and a maximum of 350 words. Only shorten if the article itself is shorter than 300 words, aiming to maintain the original length within a similar range.

4. Journalistic Integrity: Adhere to ethical journalism standards and do not mislead. Ensure the rewrite provides a complete and balanced picture, not omitting any information to downplay significant issues.

5. Omissions: Do not include any information related to Associated Press, AP, AP News, or any other news agency in your rewrite. Do not include any information about the writers or contributors of the original article.

6. Balanced Reporting: Ensure the article remains politically neutral, with no slant toward either the left or right. The rewrite should fairly represent all sides of an issue while preserving the balance and objectivity of the original content.

7. Contextual Relevance: Ensure the article reflects the current context. The current date is {current_date}, with the U.S. presidential election concluded on November 5, 2024. President-elect Donald Trump won the election as the Republican candidate, defeating Democratic nominee Vice President Kamala Harris. Use this context appropriately when relevant to political events.

8. Maintain Journalistic Writing Style: Write the rewrite as a standalone article in the same journalistic tone and style as the original. Avoid using phrases like "The article discusses," "According to the article," or any references to the original article. Present the information directly and objectively.

9. Quotes: Do not include any direct quotes in the rewrite, but paraphrase the original content, if necessary.
"""

# Format the docstring with the current date
RegularWriter.__doc__ = RegularWriter.__doc__.format(INSTRUCTIONS.format(current_date=current_date))

rewrite_regular = dspy.Predict(RegularWriter)