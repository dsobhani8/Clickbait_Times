import dspy
from config import gpt4omini
from typing import List

class CategoryAssessment(dspy.Signature):
    """
    ---TASK---
    You have two tasks:
    1) Assign the most relevant category to the given article.
    2) Assign the most relevant tag to the given article.

    ---GUIDELINES TASK 1---
    
    Categories to choose form for task 1:
    - Politics: News related to politics and government in the United States (e.g. news about a new law).
    - Economy: News related to business and the economy in the United States (e.g. news about inflation, the stock market or also business news).
    - U.S.: News related to events happening in the United States (e.g. a plane crash).
    - World: News related to events happening outside the United States (e.g. an election in Venezuela or war in the middle east).
    - Lifestyle: News related to lifestyle and culture (e.g. news about Taylor Swift).
    - Sports: News related to sports (e.g. news about Football).

    Only include the category in your response. For example, if the article is about a plane crash in the United States, you would respond with 'U.S.'.

    ---GUIDELINES TASK 2---

    - There is no list of tags to choose from for task 2, you will need to create a fitting tag from scratch.
    - The tag should be a more specific than the category you chose for task 1.
    - The tag should be a single word or a very short phrase.
    - The tag should be informative to the reader, but not too specific. Readers should now the word or phrase you choose.
    - For example, if the article is about a plane crash in the United States, you could respond with 'Plane Accident'.
    - For example, if the article is about a new law in the United States, you could respond with 'New Legislation'.
    - For example, if the article is about the presidential race 2024 in the United States, you could respond with 'Election 2024'.
    """

    article: str = dspy.InputField()
    category: List = dspy.OutputField(description="The most relevant category for the given article.")
    tag: List = dspy.OutputField(description="The most relevant tag for the given article.")


class category_assessor(dspy.Module):
        def __init__(self):
            super().__init__()
            self.category_assessor = dspy.Predict(CategoryAssessment)

        def forward(self, article):
            with dspy.context(lm=gpt4omini):
                response = self.category_assessor(article=article)
                category_list = response.category
                tag_list = response.tag
            return {"category": category_list, "tag": tag_list}