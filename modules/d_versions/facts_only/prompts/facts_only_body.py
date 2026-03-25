import dspy
import config

class FactsOnlyWriter(dspy.Signature):
    """
    --- CONTEXT ---
    You are a skilled editor who can rewrite newspaper articles to present only the facts without subjective assessments or opinions. For this task, you will present the article in a facts-only manner.

    --- TASK ---
    Rewrite the article to present only factual information without subjective assessments or opinions imposed by the journalist. Keep the factual content unchanged. Keep the length similar.

    --- GENERAL GUIDELINES ---
    1. Preserve Accuracy: Retain all factual details from the original article, including numbers, quotations, and attributions. Do not alter or omit key facts or misrepresent information.
    2. Maintain Structure and Flow: Keep the article's length and logical flow consistent. Make minor adjustments to improve readability or emphasis where necessary, ensuring smooth transitions and clarity.
    3. Use Neutral Language: Employ language that is factual and avoid emotionally charged terms (e.g., "shocking," "game-changer"). When describing opinions or perspectives, ensure that language is factual.
    4. Preserve all quotes: All quotes from the original article must be reproduced verbatim and accurately attributed. The guidelines for neutrality, tone, and language adjustments do not apply to the quotes themselves. Quotes should not be altered or paraphrased, ensuring the original content and intent are preserved.
    5. Remove Journalist Subjectivity: If present, eliminate the journalist's opinions, judgments, or narrative framing from the article. Opinions and perspectives from external sources (e.g., experts, organizations, or public figures) should be presented, but they must be clearly attributed and reported factually without embedding the journalist's agreement or additional commentary.
    6. Adhere to Journalistic Integrity: Follow ethical journalism standards. Ensure the rewritten article gives readers the full picture by accurately reporting facts and opinions as originally expressed. Avoid misleading phrasing or omission of context that could distort the reader's understanding or introduce bias.

    --- EXAMPLES ---
    1. Debate on Religious Curriculum
    Original:
    "The proposal has sparked a significant debate about the role of religion in public education, with religious experts and watchdog groups like the Texas Freedom Network criticizing the curriculum for focusing too heavily on Christianity and neglecting key historical issues, such as slavery."
    Rewrite:
    "The proposal has led to discussions about the role of religion in public education. Religious experts and organizations like the Texas Freedom Network have expressed concerns, stating the curriculum focuses on Christianity and does not address historical issues such as slavery."
    Justification:
    - Removed Subjective Qualifiers: Words like "significant debate" convey an intensity that reflects the writer's judgment. This was replaced with "discussions," which is neutral and factual.
    - Balanced Attribution of Criticism: The original phrase "neglecting key historical issues" implies agreement with critics’ claims. The rewrite attributes these concerns to the critics, maintaining objectivity.
    - Neutral Tone: The rewrite avoids emotionally charged language and presents criticisms factually, ensuring the text remains balanced and impartial.

    2. Economic Policy Analysis
    Original:
    "The government's reckless spending has led to an unsustainable increase in national debt, putting the economy at risk."
    Rewrite:
    "The government's spending has increased the national debt."
    Justification:
    - Removed Subjective Descriptors: Words like "reckless" and "unsustainable" are subjective assessments. The rewrite states the fact without judgment.
    - Simplified Statement: Focuses on the factual outcome (increased national debt) without implying risk or making predictions.

    3. Political Candidate Description
    Original:
    "Senator Smith, a champion of the people, delivered an inspiring speech that captivated the audience."
    Rewrite:
    "Senator Smith delivered a speech to the audience."
    Justification:
    - Removed Subjective Praise: Phrases like "champion of the people" and "inspiring" are subjective opinions.
    - Stated the Fact: The rewrite conveys the action (delivered a speech) without additional judgments.

    4. Description of Proposal
    Original:
    "Democrats, including McBride, blasted the proposal, calling it a 'cruel bullying tactic' aimed at deflecting attention from urgent crises like the skyrocketing costs of housing, healthcare, and childcare."
    Rewrite:
    "Democrats, including McBride, criticized the proposal, describing it as a 'cruel bullying tactic' and citing concerns about deflecting attention from pressing issues such as housing, healthcare, and childcare costs."
    Justification:
    - The phrase "cruel bullying tactic" is a direct quote from McBride and must be preserved verbatim according to the guidelines.
    - Subjective framing such as "blasted" has been replaced with neutral language ("criticized"), and the focus is shifted to the specific concerns raised, ensuring neutrality.

    5. Loan Forgiveness
    Original:
    "The loan forgiveness efforts have faced relentless Republican attacks, with GOP-led states waging an aggressive legal war to block the policy."
    Rewrite:
    "Loan forgiveness efforts have faced opposition, including litigation from Republican-led states."
    Justification:
    Replaced subjective and charged terms like "relentless attacks" and "aggressive legal war" with factual descriptions of opposition and litigation. The rewrite avoids implying the intensity of the resistance.

    --- SPECIFIC GUIDELINES ---
    Solve the task in the following two steps outlined below. In Step 1, identify major changes that need to be implemented to present the article in a facts-only manner, taking the guidelines and examples above into account. In Step 2, rewrite the article according to the guidelines, integrating the major changes identified from Step 1.

    Step 1: Identify all the sentences in the article that should be substantially rewritten to present only factual information. Structure your identified changes in a bullet point list, including the original sentence, the rewrite, and a justification for the change. In the justification, be explicit about how the change relates to the guidelines of presenting facts only without changing factual accuracy.

    Step 2: Include the list of suggested changes from Step 1 while ensuring that the rewritten article reads well with good transitions and is internally consistent. You are free to include and discard suggestions from Step 1 if necessary (e.g., to maintain the full picture from the original article). In addition to implementing changes from Step 1, minor changes should be implemented according to the guidelines that were not covered by the list from Step 1, such as consistently ensuring the article uses neutral language. Also, make sure to slightly vary the language such that the article does not appear repetitive.
    """

    article: str = dspy.InputField()
    sentences: str = dspy.OutputField(
        desc="List of suggested changes from Step 1. Each item should include the original sentence, the rewrite, and a justification for the change. Do not include anything else in the list. Only include the prefixes 'Original sentence', 'Rewrite', and 'Justification'."
    )
    rewritten_article: str = dspy.OutputField(
        desc="Rewritten article. Do not include anything else other than the rewrite. Do not include any prefixes to the rewrite (e.g., 'Rewrite:', or 'Rewritten Article:')."
    )

rewrite_facts_only = dspy.Predict(FactsOnlyWriter)