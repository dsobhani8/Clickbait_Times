import dspy
import config

class ComplexityWriter(dspy.Signature):
    """
    --- CONTEXT ---
    You are a skilled editor tasked with rewriting newspaper articles to make them more accessible, without altering the factual content. Your goal is to ensure the article is understandable to a broad range of readers who might find the original language too complex. Do not assume the reader has any specialized knowledge. Ensure the language is accessible to a very broad range of readers. Aim for a similar accessibility as articles written in the Simple English Wikipedia style.


    --- TASK ---
    Rewrite the provided article to enhance its accessibility while preserving factual accuracy.


    --- GENERAL GUIDELINES ---
    1. **Maintain Accuracy**: Preserve all factual details, including numbers and quotations.


    2. **Structure and Flow**: Retain the article's logical flow and length, making minor adjustments for clarity or emphasis. Split long, complex sentences into shorter ones that focus on single ideas to enhance clarity and readability.


    3. **Use Clear and Simple Language**:
       - Employ clear, simple, and direct language.
       - Use common and simple words instead of formal, technical, and less common ones.
       - Use relatable examples and reader-friendly language to explain ideas.
       - Break down complicated concepts into understandable parts.
       - Avoid complex sentence structures.
       - Use short sentences.


    4. **Make Technical Terms Accessible**:
       If you need to introduce technical terms, use simple explanations the first time they are mentioned, ensuring they are defined naturally within the article.
       Avoid oversimplification that distorts meaning. Instead, use analogies, examples, or simpler alternatives to convey the original concept effectively.


    5. **Prioritize Content Accessibility**: 
       Focus on making the article content accessible. If explaining a concept requires a more lengthy explanation, keep a simple structure by splitting the content into several short and understandable sentences.


    6. **Uphold Journalistic Integrity**: Adhere to ethical journalism standards. Do not mislead readers. Ensure they receive the full picture presented in the original article. Do not add any new information, opinions, or interpretations.


    --- EXAMPLES ---
    **Example 1: Economics**
    - **Original Sentence**: "The central bank's quantitative easing measures have led to increased liquidity in the financial markets."
    - **Rewrite**: "The central bank is putting more money into the economy. This is called quantitative easing. It makes it easier for people and businesses to borrow money."
    - **Justification**: The rewrite breaks the original into shorter, simpler sentences. "Quantitative easing" is introduced with a clear definition, and "increased liquidity" is explained in terms of its real-world effect. This makes the explanation more accessible and easier to follow.


    **Example 2: Business**
    - **Original Sentence**: "The company's EBITDA showed significant improvement, indicating enhanced operational efficiency."
    - **Rewrite**: "The company's main profits, before some expenses, got much better. This shows the company is working more efficiently."
    - **Justification**: The rewrite replaces "EBITDA" with "main profits, before some expenses," a simpler phrase that is easier for non-experts to understand. It also changes "indicating enhanced operational efficiency" to "shows the company is working more efficiently," making the explanation more direct and conversational.


    **Example 3: Politics**
    - **Original Sentence**: "The policy framework set by the legislative branch aims to overhaul the national healthcare system through incremental changes that span several years."
    - **Rewrite**: "The government plans to improve the national healthcare system step by step, making changes over several years."
    - **Justification**: The rewrite replaces "policy framework" and "legislative branch" with simpler terms like "government" and "plans," making the sentence clearer without losing its meaning.


    **Example 4: Central banking**
    - **Original Sentence**: "Signs of decreasing inflation and a cooling job market have led to expectations that the Fed will cut its benchmark interest rate for the first time in four years in its upcoming policy meeting."
    - **Rewrite**: "Inflation is falling, and fewer jobs are being created. Because of this, people think the Fed will lower its main interest rate at its next meeting. This would be the first time in four years."
    - **Justification**: "Benchmark interest rate" is changed to "main interest rate," which is a simpler term. "People expect" keeps the tone conversational and easy to understand.


    --- SPECIFIC GUIDELINES ---
    Solve the task in the following two steps outlined below.


    **Step 1**:
    Identify major changes needed to make the article more accessible, taking the guidelines and examples above into account. Structure your identified changes in a bullet point list, including the original sentence, an accessible rewrite, and a justification for the change. Be explicit about how the change relates to the guidelines of making the article more accessible without changing factual accuracy.


    **Step 2**:
    Using the suggested changes from Step 1 as a guide, produce the rewritten article. **Focus on reducing complexity by simplifying language and breaking down complex sentence structures.** Ensure the article maintains a friendly, neutral, and conversational tone that encourages reader engagement without causing overwhelm. Rewrites from Step 1 can be adjusted in Step 2 for clarity or flow. After implementing changes, review the entire article to ensure smooth transitions and consistency in tone. Do not include the list from Step 1 in this step. Make minor adjustments throughout the article to maintain clear and simple language.


    --- OUTPUT FORMAT ---
    Your response should include:


    1. **List of Suggested Changes** (Step 1):
       - For each change, include:
         - **Original Sentence**: [Original sentence]
         - **Rewrite**: [Accessible rewrite]
         - **Justification**: [Justification for the change]


    2. **Rewritten Article** (Step 2):
       - Provide the rewritten article.
       - Rewrites from Step 1 can be adjusted for readability or flow.
       - Ensure the article reads smoothly and definitions are integrated naturally.
    """


    article: str = dspy.InputField()
    sentences: str = dspy.OutputField(
        desc="List of suggested changes from Step 1. Each item should include the original sentence, the rewrite, and a justification for the change. Do not include anything else in the list. Only include the prefixes 'Original sentence', 'Rewrite', and 'Justification'."
    )
    rewritten_article: str = dspy.OutputField(
        desc="The rewritten article that incorporates the changes from Step 1. Ensure that definitions of technical terms are integrated naturally upon first use. Do not include anything else than the rewrite. Do not include any prefixes to the rewrite (e.g. 'Rewrite: ', or 'Rewritten Article: ')."
    )

rewrite_less_complex = dspy.Predict(ComplexityWriter)


### OLD VERSION ###

# class ComplexityWriter(dspy.Signature):
#     """
#     --- CONTEXT ---
#     You are a skilled editor who can rewrite newspaper articles according to different perspectives without changing the underlying factual content of the article. For this task, you will present the article in a more accessible and engaging way to ensure it is comprehensible and easy to understand for a broad range of readers who find the original article too complex. This can apply to articles in fields such as economics, politics, or tech news.
    
#     --- TASK ---
#     Rewrite the article to make it more accessible and engaging. Keep the factual content unchanged. Ensure that the length remains roughly similar to the original.
    
#     --- GENERAL GUIDELINES ---
#     1. **Maintain Accuracy**: Preserve all factual details, including numbers and quotations, without distortion.
#     2. **Structure and Flow**: Maintain the article’s length and logical flow, with minor adjustments for clarity or emphasis.
#     3. **Clear and Simple Language without Over-Simplification**: Use clear, simple, and direct language. Avoid jargon and complex terms, but do **not** over-simplify technical terms to the point where they become inaccurate or awkward (e.g., avoid using "middle point of incomes" for "median income"). Instead, define technical terms **the first time they are introduced** and use them consistently throughout the article (e.g., define "inflation" once, then refer to it as "inflation" in later parts of the article). Do not replace important terms with overly simplified phrases.
#     4. **Make it Accessible and Engaging**: Use relatable examples, analogies, and reader-friendly language to explain complex ideas. Break down complicated concepts into easy-to-understand parts. Ensure the tone is friendly, informative, and respectful, encouraging readers to engage without feeling overwhelmed. Use conversational phrases where appropriate to make the article more relatable.
#     5. **Relatable Analogies**: For complex concepts, provide simple analogies that readers can relate to. For example, compare **interest rates** to the “fee you pay to borrow money” or explain **debt** as “borrowing money, like asking a friend for a loan.”
#     6. **Explain Why Data Matters**: When introducing numbers and data (e.g., inflation rates, wage growth), explain why these figures are important and how they impact readers' lives. For example, explain how a 2.6% inflation rate affects everyday spending.
#     7. **Reader Engagement**: Address the reader directly when appropriate. Make it clear how the topic affects them personally, and use a conversational tone to keep them engaged. For example, “If the Federal Reserve lowers interest rates, this could mean cheaper loans for homebuyers and businesses.”
#     8. **Journalistic Integrity**: Adhere to ethical journalism standards and do not mislead. The reader should get the full picture from the original article, even when presented in a more accessible manner.
    
#     --- SPECIFIC GUIDELINES ---
#     Solve the task in the following four steps:
#     **Step 1: Make a List of Technical Terms**:
#     Before rewriting the article, **identify all technical terms or concepts that will need to be defined early on in the article** (e.g., "inflation," "interest rates," "core inflation"). Ensure that all such terms are recognized and marked for later definition.
#     **Step 2: Create a Plan for Defining the Terms**:
#     For each term identified, create a plan for how to define it clearly and concisely for the reader. Ensure the definitions are accessible without oversimplification. Think about the best way to explain the term based on the article’s context (e.g., for "interest rates," you might say, "Interest rates refer to the cost of borrowing money from a bank").
#     **Step 3: Define the Terms the First Time They Appear**:
#     When rewriting the article, **define each technical term the first time it is introduced in the text**. Use the planned definitions and ensure they are simple and accurate. Once a term is defined, use it consistently throughout the article without reverting to overly simplified language or vague phrases.
#     The following example illustrates how to rewrite individual sentences using these techniques:
#     **Original**: "This situation is further complicated by the lingering inflation above the Fed's 2% target, despite a significant drop from its peak."
#     **Accessible Rewrite**: "Inflation, which means that prices for everyday things like groceries and gas are going up, is still rising faster than the Federal Reserve, the country's central bank, wants. Even though prices aren’t increasing as quickly as before, inflation is still above the Fed’s target of keeping yearly price increases at 2%."
#     **Justification**: This rewrite retains all factual details, including the inflation rate and the Fed’s target, while defining **inflation** in simple terms and explaining the **Fed’s 2% target** in plain language. The reader can now understand and use the term "inflation" throughout the article without confusion.
#     **Step 4: Narrative Flow, Structure, and Polishing**:
#     After rewriting key sentences and ensuring that technical terms are defined early, review the entire article to ensure smooth flow and clear transitions between ideas. Ensure the article flows naturally and is easy to read, without overwhelming the reader. Apply the necessary simplifications without extending the article’s length. Ensure the tone remains conversational and approachable, and that the final article is engaging and clear.
#     """


#     article = dspy.InputField()
#     terms_list = dspy.OutputField(desc="List of technical terms that need to be defined. Ensure each term is marked for later definition.")
#     sentences = dspy.OutputField(desc="List of sentences that need to be rewritten to make them more accessible. Each item should include the original sentence, the rewrite, and a justification for the change. Do not include anything else in the list. Only include the prefixes 'Original sentence', 'Rewrite', and 'Justification'.")
#     rewritten_article = dspy.OutputField(desc="rewrite of the article. Keep the article concise, with roughly the same length as the original. Do not include anything else than the rewrite. Do not include any prefixes to the rewrite (e.g. 'Rewrite: ', or 'Rewritten Article: ').")

# rewrite_less_complex = dspy.Predict(ComplexityWriter)