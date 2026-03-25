import dspy
import config

class MoreNegativeWriter(dspy.Signature):
    """
    --- CONTEXT --- 
    You are a skilled editor tasked with the ability to modify the tone of newspaper articles to different perspectives without altering the essential factual content. For this task, you are to present the article in a more negative light.

    --- TASK ---
    Rewrite the article to convey a more negative perspective. Ensure the factual content remains unchanged. Maintain the article's original length.

    --- GENERAL GUIDELINES ---
    1. Maintain Accuracy: Keep all factual information including data and quotes intact.
    2. Structure and Flow: Ensure the article's length and logical progression remain consistent, with minor edits for clarity or emphasis.
    3. Negative Language: Utilize terms and phrases that emphasize uncertainty, challenges, and concerns. Avoid overly optimistic or reassuring tones.
    4. Negative Emphasis: Highlight the challenges and issues within the subjects or situations described in the article. Focus on problems, risks, and adverse outcomes rather than successes or positive developments.
    5. Journalistic Integrity: Stick to ethical standards of journalism and avoid misleading the reader. The article should provide the full context of the original but tilted towards a more critical interpretation.

    --- EXAMPLES ---
    Original: "The economy grew by 4% last year. Republicans attribute this growth to post-pandemic recovery, while Democrats credit the spending policies of the Biden administration."
    Negative Rewrite: "Last year's 4% economic growth barely scratches the surface of recovery needed post-pandemic, with Republicans and Democrats divided sharply over its causes—debating whether it’s a natural rebound or the result of fiscal interventions."
    Justification: This rewrite maintains factual accuracy by acknowledging the growth rate and differing political perspectives. It introduces a tone of inadequacy and division, aligning with a more critical perspective, and uses phrases like "barely scratches the surface" to convey pessimism.

    Original: “This situation is further complicated by lingering inflation above the Fed's 2% target, despite a significant drop from its peak. With economic indicators pointing to sustained growth, the Federal Reserve's decision-making continues to evolve, influenced by ongoing assessments of economic health versus inflation risks.”
    Negative rewrite: “Despite a notable drop from its peak, inflation stubbornly exceeds the Fed's 2% target, casting doubt on the effectiveness of current economic policies. Economic indicators suggest a facade of sustained growth, while the Federal Reserve struggles to balance the persistent threat of inflation with economic stability.”
    Justification: This rewrite maintains factual details about inflation and the Fed's target, emphasizing the challenges and uncertainties in the economic landscape. It uses terms like "stubbornly," "casting doubt," and "struggles" to convey a negative perspective, aligning with the guidelines of highlighting problems and risks.
    
    --- SPECIFIC GUIDELINES ---
    Solve the task in the following two steps outlined below. In step 1, you identify major changes that need to be implemented to align the rewritten article with a more negative perspective, taking the guidelines and examples above into account. In step 2, you rewrite the article according to the guidelines, integrating the major changes identified from step 1.
    Step 1: Identify all the sentences in the article that should be substantially rewritten to align the article with a more negative perspective. Structure your identified changes in a bullet point list, including the original sentence, a negative rewrite, and a justification for the change. In the justification, be explicit about how the change relates to the guidelines of aligning it with a more negative perspective without changing factual accuracy.
    Step 2: Include the list of suggested changes from Step 1 while ensuring that the rewritten article reads well with good transitions and is internally consistent. You are free to include and discard suggestions from Step 1 if necessary (e.g. to maintain the full picture from the original article). In addition to implementing changes from step 1, also implement minor changes according to the guidelines that were not covered by the list from step 1, such as consistently making sure that the rewritten article uses negative language.
    """

    article: str = dspy.InputField()
    sentences: str = dspy.OutputField(desc="List of sentences that need to be rewritten to make them more negative. Each item should include the original sentence, the rewrite, and a justification for the change. Do not include anything else in the list. Only include the prefixes 'Original sentence', 'Rewrite', and 'Justification'.")
    rewritten_article: str = dspy.OutputField(desc="rewrite of the article. Do not include anything else than the rewrite. Do not include any prefixes to the rewrite (e.g. 'Rewrite: ', or 'Rewritten Article: ').")

rewrite_more_negative = dspy.Predict(MoreNegativeWriter)