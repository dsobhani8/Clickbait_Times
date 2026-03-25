import dspy
import config
import pydantic
from typing import List
from config import gpt4o_facts

class Facts(pydantic.BaseModel):
    facts: List[str]

# # Model for atomic fact extraction
# class FactRelevance(dspy.Signature):
#     """
#     --TASK---
#     Classify the atomic facts as core or supplementary given the article.

#     ---CLASSIFICATION RULES---
#     - Core Fact: Directly contributes to the main argument or key story of the article.
#     - Supplementary Fact: Provides additional context, background, or supporting information but is not essential.

#     ---GUIDELINES---
#     - Do not hallucinate: only classify atomic facts you have been given.
#     - Use the examples to learn how to do this.

#     ---EXAMPLES---
#     Example 1:
#     Article: ""
#     Atomic Facts: []
#     Core Facts: []
#     Supplementary Facts: []

#     Example 2:
#     Article: ""
#     Atomic Facts: []
#     Core Facts: []
#     Supplementary Facts: []

#     Example 3:
#     Article: ""
#     Atomic Facts: []
#     Core Facts: []
#     Supplementary Facts: []
#     """
#     article: str = dspy.InputField(desc="Complete news article")
#     atomic_facts: Facts = dspy.InputField(desc="List of atomic facts to check relevance of")
#     core_facts: Facts = dspy.OutputField(desc="Core facts")
#     supplementary_facts: Facts = dspy.OutputField(desc="Supplementary facts")

# Model for atomic fact extraction
class FactRelevance(dspy.Signature):
    """
    --TASK---
    Classify the atomic facts as core or supplementary given the article.

    ---CLASSIFICATION RULES---
    - Core Fact: Directly contributes to the main argument or key story of the article.
    - Supplementary Fact: Provides additional context, background, or supporting information but is not essential.

    ---GUIDELINES---
    - Do not hallucinate: only classify atomic facts you have been given.
    """
    article: str = dspy.InputField(desc="Complete news article")
    atomic_facts: list[str] = dspy.InputField(desc="List of atomic facts to check relevance of")
    core_facts: list[str] = dspy.OutputField(desc="Core facts")
    supplementary_facts: list[str] = dspy.OutputField(desc="Supplementary facts")

class assess_facts(dspy.Module):
    def __init__(self):
        super().__init__()
        self.assess_facts = dspy.Predict(FactRelevance)

    def forward(self, article, atomic_facts):
        with dspy.context(lm=gpt4o_facts):
            facts = self.assess_facts(article=article, atomic_facts=atomic_facts)

        core_facts = facts.core_facts.facts
        supplementary_facts = facts.supplementary_facts.facts
            
        return {
            "core_facts": core_facts,
            "supplementary_facts": supplementary_facts
        }
