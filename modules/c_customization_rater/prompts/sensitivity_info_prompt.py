import dspy
import config

class SensitivityInfo(dspy.Signature):
    """
    ---CONTEXT---
    You are the editor af a news website that customizes news articles to suit reader preferences. However, for some content customizing the articlle to sound more positive or entertaining is not appropriate due to the sensitivity of the topic.

    ---TASK---
    You need to provide a short explanation of the sensitivity of the article for the reader given the assessment of your colleague who evaluated the customization potential of the article.

    ---GUIDELINES---
    - Your explanation should convey why the article covers sensitive content.
    - Your explanation should not be longer than 15 words.
    """
    customization_reasoning: str = dspy.InputField(desc="Reasoning for the customization score")
    info: str = dspy.OutputField(desc="Short explanation of the sensitivity of the article. Do not include any prefixes (e.g. 'Info: ' or 'Explanation: ' or 'The article is sensitive because...').")

sensitivity_explainer = dspy.Predict(SensitivityInfo)