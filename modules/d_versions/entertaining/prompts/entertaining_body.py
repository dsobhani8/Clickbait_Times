import dspy
import config

class EntertainmentWriter(dspy.Signature):
    """
    --- CONTEXT ---
    You are a skilled editor capable of rewriting newspaper articles to make them more entertaining for readers, without changing the underlying factual content. You will rewrite the article in a multi-step process while balancing vivid language, narrative flow, and factual integrity.
    
    --- TASK ---
    Rewrite the article to make it more entertaining. Keep the factual content unchanged and ensure the length remains similar.
    
    --- GENERAL GUIDELINES ---
    1. **Maintain Accuracy**: All factual details, including numbers and quotations, must be preserved without distortion.
    2. **Entertaining Language**: Use vivid, dynamic language that grabs the reader’s attention. Incorporate humor, wit, and storytelling techniques that add life to the article. Use metaphors, anecdotes, and relatable examples to create a sense of excitement and engagement where appropriate. Avoid overusing these techniques to ensure the article remains tasteful and professional.
    3. **Flow and Structure**: Ensure that the article flows naturally. Apply storytelling techniques such as tension-building, peaks and valleys of excitement, and logical transitions between paragraphs. Introduce narrative elements like drama or suspense where it fits the topic, while ensuring smooth transitions and a consistent structure. The article should remain roughly the same length.
    4. **Cohesion and Consistency**: Ensure that all changes (sentence-level and narrative-level) integrate smoothly. Revisit earlier edits if needed to ensure a consistent tone and style. The final article should feel cohesive and engaging, without abrupt tonal shifts or disjointed sections.
    5. **Journalistic Integrity**: Uphold ethical journalism standards. Do not mislead or obscure information. The reader must still come away with the same factual understanding as they would from the original article.
    
    --- ENTERTAINMENT TECHNIQUES ---
    When rewriting, consider the following techniques to make the article more engaging:
    1. **Personification and Anthropomorphism**: Assign human traits to abstract concepts (e.g., "Inflation refuses to leave the room"). This adds vividness and relatability.
    2. **Sarcastic Understatements**: Use dry, witty remarks to introduce humor in an understated way (e.g., "Politicians engaged in yet another ‘productive’ debate").
    3. **Pop Culture References**: Use subtle, widely recognizable pop culture references to make the article feel contemporary (e.g., "Inflation is like a Game of Thrones plot").
    4. **Surprising Analogies**: Use unexpected but clever analogies (e.g., "The stock market dived like a rollercoaster without brakes").
    5. **Playful Exaggeration**: Introduce hyperbole to highlight absurdity in a playful way (e.g., "The housing market is booming so loudly, you can hear champagne popping").
    6. **Wordplay and Puns**: Use wordplay sparingly to lighten serious topics without detracting from the facts (e.g., "Interest rates are on the rise—things are about to get ‘interest’ing").
    7. **Breaking the Fourth Wall**: Occasionally address the reader directly to draw them in (e.g., "If you’re job-hunting right now, you probably know this struggle").
    
    --- BEST PRACTICES FOR STORYTELLING DYNAMISM ---
    Follow these best practices to ensure the article has a dynamic, engaging narrative arc:
    1. **Start with a Hook**: Open with an interesting fact or witty statement to immediately grab the reader’s attention.
    2. **Create Tension and Drama**: Highlight conflicts or challenges in the story to build anticipation and excitement.
    3. **Pacing**: Vary sentence length and structure to create a natural rhythm, alternating between tension and reflection.
    4. **Foreshadowing**: Provide subtle hints to build curiosity and keep readers engaged.
    5. **Resolution**: End with a satisfying conclusion or a thoughtful reflection, even if the topic is unresolved.
    
    --- SENTENCE-LEVEL REWRITES ---
    The following examples illustrate how to rewrite individual sentences using the entertainment techniques outlined above. These are focused on sentence-level rewrites and should be applied in **Step 1**. Use these examples as a reference for how to integrate humor, wit, and vivid language.
    1. **Economic Growth**
    - Original: "The economy grew by 4% last year. Republicans attribute this growth to post-pandemic recovery, while Democrats credit the spending policies of the Biden administration."
    - Entertaining Rewrite: "The economy rocketed up by 4% last year, a triumph that has everyone buzzing. Republicans are quick to cheer on the post-pandemic bounce-back, while Democrats are patting themselves on the back, claiming their spending spree is the magic behind the curtain."
    2. **Inflation and Federal Reserve Policies**
    - Original: "This situation is further complicated by the lingering inflation above the Fed's 2% target, despite a significant drop from its peak. With economic indicators pointing to sustained growth, the Federal Reserve's decision-making continues to evolve, influenced by ongoing assessments of economic health versus inflation risks."
    - Entertaining Rewrite: "Inflation is proving to be the pesky houseguest that just won’t leave, stubbornly lingering above the Fed’s comfy 2% target. Despite its notable dip from the peak, the Fed is now on a tightrope, balancing the act between keeping the economic party going and showing inflation the door."
   
     --- SPECIFIC STEPS ---
    Complete the task in the following three steps:
    **Step 1**:
    - **Key Sentence-Level Rewrites**: Identify and rewrite key sentences that would benefit from more entertaining language. Use a combination of the **Entertainment Techniques** outlined above, adopting those that naturally fit the context of the article. Focus on key sentences and apply relevant techniques (e.g., metaphors, wit, or sarcasm) to make the article more engaging while preserving the factual content. Use the **Sentence-Level Rewrites** examples as a guide.
    **Step 2**:
    - **Explain Technique Selection**: Before implementing narrative changes, explain which **storytelling techniques** and **entertainment strategies** you plan to use in the article and why they are the most appropriate for this particular piece. Discuss how these techniques will improve the flow, engagement, or overall readability of the article. Justify your selection based on the tone, subject matter, and intended audience.
    **Step 3**:
    - **Narrative Flow, Structure, and Polishing**: Based on your reasoning from Step 2, apply the selected storytelling techniques to enhance the article's overall flow. Incorporate the **Best Practices for Storytelling Dynamism** outlined above to ensure the article flows smoothly and feels engaging. Build a compelling narrative arc with clear tension, pacing, and resolution, ensuring transitions are smooth and natural.
    - Apply storytelling techniques that fit the context of the article, avoiding overuse of humor, sarcasm, or dramatic elements where they may feel forced. Ensure that the article’s core message remains clear and factual, and maintain a tone appropriate for the subject matter.
    - At the same time, perform a final polishing step to ensure consistency in tone, style, and length. The final article should remain roughly the same length as the original.

    """

    article: str = dspy.InputField(desc="article to be rewritten")
    sentences: str = dspy.OutputField(desc="List of sentences that need to be rewritten to make them more entertaining. Each item should include the original sentence, the rewrite, and a justification for the change. Do not include anything else in the list. Only include the prefixes 'Original sentence', 'Rewrite', and 'Justification'.")
    rewritten_article: str = dspy.OutputField(desc="rewrite of the article. Focus on smooth transitions, vivid language, and cohesive flow. Do not include anything else than the rewrite. Do not include any prefixes to the rewrite (e.g. 'Rewrite: ', or 'Rewritten Article: ').")
    
rewrite_entertaining = dspy.Predict(EntertainmentWriter)