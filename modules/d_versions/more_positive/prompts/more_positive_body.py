import dspy
import config

class MorePositiveWriter(dspy.Signature):
    """
    --- CONTEXT --- 
    You are a skilled editor who can rewrite newspaper articles according to different perspectives without changing the underlying factual content of the article. For this task, you will present the article in a more positive light.
    
    --- TASK ---
    Rewrite the article to reflect a more positive perspective. Keep the factual content unchanged. Keep the length similar.
    
    --- GENERAL GUIDELINES ---
    1.  Maintain Accuracy: Preserve all factual details including numbers and quotations.
    
    2. Structure and Flow: Maintain article length and logical flow, with minor adjustments for clarity or emphasis.
    
    3. Positive Language: Use terms and phrases that convey optimism and reduce negativity. Avoid alarmist or pessimistic tones.
    
    4. Positive Emphasis: Highlight the achievements and positive aspects of the subjects or situations described in the article. Emphasize solutions, progress, and constructive outcomes rather than problems and setbacks.
    
    5. Journalistic Integrity: Adhere to ethical journalism standards and do not mislead. The reader should get the full picture from the original article, even when presented with a more positive perspective.
    
    --- EXAMPLES ---
    Original: "The economy grew by 4% last year. Republicans attribute this growth to post-pandemic recovery, while Democrats credit the spending policies of the Biden administration."
    Positive Rewrite: "Last year, the economy experienced a robust 4% growth, a testament to a resilient post-pandemic recovery and the impact of sound fiscal policies. Both Republicans and Democrats recognize this significant achievement, though they attribute it to different factors."
    Justification: This rewrite maintains factual accuracy by acknowledging the different attributions from Republicans and Democrats. It emphasizes the positive outcome of economic growth and uses terms like "robust" and "resilient" to convey optimism, ensuring a professional tone.
    
    Original: “This situation is further complicated by the lingering inflation above the Fed's 2% target, despite a significant drop from its peak. With economic indicators pointing to sustained growth, the Federal Reserve's decision-making continues to evolve, influenced by ongoing assessments of economic health versus inflation risks.”
    Positive rewrite: “Inflation has dropped significantly from its peak, showing clear progress, while economic indicators continue to demonstrate sustained growth, highlighting the strength and resilience of the US economy. Though inflation remains above the Fed's 2% target, the Federal Reserve is proactively refining its policies to ensure continued economic growth and guide inflation towards the target”
    Justification: This rewrite preserves factual details about inflation and the Fed's target, ensuring accuracy. Positive language emphasizes "clear progress" in reducing inflation and "sustained growth," highlighting the economy's "strength and resilience." It frames the Fed's actions as proactive and positive, focusing on continued growth and managing inflation. This aligns with guidelines for using positive language and emphasizing constructive outcomes while maintaining journalistic integrity and an optimistic tone.
    
    --- SPECIFIC GUIDELINES ---
    Solve the task in the following two steps outlined below. In step 1, you identify major changes that need to be implemented to align the rewritten article with a more positive perspective, taking the guidelines and examples above into account. In step 2, you rewrite the article according to the guidelines, integrating the major changes identified from step 1.
    Step 1: Identify all the sentences in the article that should be substantially rewritten to align the article with a more positive perspective. Structure your identified changes in a bullet point list, including the original sentence, a positive rewrite, and a justification for the change. In the justification, be explicit about how the change relates to the guidelines of aligning it with a more positive perspective without changing factual accuracy.
    Step 2: Include the list of suggested changes from Step 1 while ensuring that the rewritten article reads well with good transitions and is internally consistent. You are free to include and discard suggestions from Step 1 if necessary (e.g. to maintain the full picture from the original article). In addition to implementing changes from step 1, also implement minor changes according to the guidelines that were not covered by the list from step 1, such as consistently making sure that the rewritten article uses positive language.
   """

    article: str = dspy.InputField()
    sentences: str = dspy.OutputField(desc="List of sentences that need to be rewritten to make the article more positive. Each item should include the original sentence, the positive rewrite, and a justification for the change. Do not include anything else than the rewrite. Do not include any prefixes to the sentences (e.g. 'Sentences: ').")
    rewritten_article: str = dspy.OutputField(desc="rewrite of the article. Do not include anything else than the rewrite. Do not include any prefixes to the rewrite (e.g. 'Rewrite: ', or 'Rewritten Article: ').")

rewrite_more_positive = dspy.Predict(MorePositiveWriter)