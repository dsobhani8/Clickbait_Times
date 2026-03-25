import dspy
import config

answer_choices = ["A", "B", "C", "D", "E"]

class QuestionGenerator(dspy.Signature):
    """
    ---CONTEXT---
    You are tasked with creating a multiple-choice question based on a newspaper article.
    
    ---TASK---
    Develop a single factual knowledge question derived from the article. This question should be easy for someone who has briefly read the article.
    
    ---GUIDELINES---
    - Construct one correct answer and four incorrect answers. Make sure that the answer options are clearly different and not too similar.
    - Ensure the correct answer is directly supported by the text, while the incorrect choices are verifiably incorrect upon reviewing the article.
    - Present the output with the question followed by five labeled answer choices (A to E).
    - Make each answer option a sentence that captures the essence of the article for the correct option.
    - The question should be related to current events covered in the news, not broad facts independent of the current news cycle.
    - The question should not require the reader to memorize specific numbers or percentages from the article.
    
    ---EXAMPLES---
    1.
    Article:
    The White House has not ruled out the possibility of a commutation for Hunter Biden, President Joe Biden's son, who was convicted on three federal gun charges. White House press secretary Karine Jean-Pierre stated that sentencing has not yet been scheduled and she has not discussed the matter with the president since the verdict. President Biden had previously ruled out a pardon for his son in an ABC News interview. Hunter Biden was convicted of lying on a gun purchase form about his drug use and illegally possessing the gun for 11 days, charges which could result in up to 25 years in prison. The final decision on his sentence rests with U.S. District Judge Maryellen Noreika, appointed by former President Donald Trump, who has not set a sentencing date.

    Question:
    What has the White House not ruled out for Hunter Biden following his conviction on federal gun charges?
    
    Answer Choices:
    A. The White House has not ruled out the possibility of a commutation for Hunter Biden.
    B. The White House has ruled out the possibility of an appeal for Hunter Biden.
    C. The White House confirmed a pardon for Hunter Biden.
    D. The White House did not comment on Hunter Biden's conviction.
    E. The White House has ruled out a retrial for Hunter Biden.
    Correct answer: A

    2. 
    Article: Year-over-year, wholesale prices rose 2.2% in May. Excluding food and energy, core producer prices were unchanged from April and up 2.3% from the previous year.
    The producer price index is monitored for insights into consumer inflation trends, as some components contribute to the Federal Reserve's preferred inflation measure, the personal consumption expenditures price index.
    This data followed a report of easing consumer inflation, with core consumer prices rising 0.2% month-over-month, the smallest increase since October, and 3.4% year-over-year, the mildest in three years.
    Inflation has decreased from its peak of 9.1% two years ago, aided by the Fed's interest rate hikes. However, it remains above the Fed's 2% target. The Fed recently left its benchmark rate unchanged and revised its forecast to only one rate cut this year.
    Despite moderating inflation, essentials like groceries, rent, and healthcare remain expensive, posing political challenges for President Biden. Nonetheless, the U.S. economy shows resilience with low unemployment, steady hiring, and an improved growth forecast from the World Bank, up to 2.5% from 1.6%.

    Question: What recent economic trend did the Labor Department report in the U.S.?

    Answer choices:
    A. Wholesale price increases from April to May rose significantly, indicating worsening inflation.
    B. Wholesale price increases from April to May declined, suggesting potential easing of inflation.
    C. Year-over-year core producer prices decreased from May to April.
    D. The Federal Reserve announced a new series of interest rate cuts.
    E. The U.S. unemployment rate saw a significant spike in May.
    Correct answer: B
    """

    article: str = dspy.InputField(desc="news article")
    question: str = dspy.OutputField(desc="multiple-choice question. Do not include any prefixes (e.g. 'Question: ')")
    answer_choices: dict[str, str] = dspy.OutputField(desc=f"answer choices: {answer_choices} and anser content for each choice")
    correct_answer: str = dspy.OutputField(desc=f"one of: {answer_choices}")

question_generator = dspy.Predict(QuestionGenerator)