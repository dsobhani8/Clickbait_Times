import dspy
from config import gpt4omini

class TagsGenerator(dspy.Signature):
    """
    ---CONTEXT---
    You are an experienced editor at a renowned online news outlet.

    ---TASK---
    You have two tasks:
    1. Generate a list of tags that accurately describe the content of the provided news article. These tags serve as the basis for the search functionality on a news website.
    2. Generate a slug for the URL of the article.
    
    ---GUIDELINES TASK 1---
    - Generate enough tags such that users can find the article through various search queries relevant to the article's content.
    - Do not include tags that are irrelevant to the article's content.

    ---GUIDELINES TASK 2---
    - The slug for the URL should be readable and SEO-friendly and  briefly describes the content of the article, for example: "donald-trump-hush-money-trial-closing-arguments-jury-deliberation-verdict"
    - The slug should separate words with hyphens and should not contain any special characters or spaces.
    """

    article: str = dspy.InputField()
    slug: str = dspy.OutputField(desc="slug for the article URL. Do not include anything else than the slug. Do not include any prefixes (e.g. 'Slug: ', or 'Url: ').")
    tags: list[str] = dspy.OutputField()

class tags_generator(dspy.Module):
        def __init__(self):
            super().__init__()
            self.tags_generator = dspy.Predict(TagsGenerator)

        def forward(self, article):
            with dspy.context(lm=gpt4omini):
                tags = self.tags_generator(article=article)
                tags_list = tags.tags
                slug = tags.slug

            return {"tags": tags_list, "slug": slug}

################
### OLD CODE ###
################

class SlugGenerator(dspy.Signature):
    """
    CONTEXT:
    You are an experienced editor at a renowned online news outlet. You have been tasked with generating a slug for a news article.

    TASKS:
    Based on the news article generate a slug for the URL of the article.
    
    GUIDELINES:
    - The slug for the URL should be readable and SEO-friendly and  briefly describes the content of the article, for example: "donald-trump-hush-money-trial-closing-arguments-jury-deliberation-verdict"
    - The slug should separate words with hyphens and should not contain any special characters or spaces.
    """

    article = dspy.InputField()
    slug = dspy.OutputField(desc="slug for the article URL. Do not include anything else than the slug. Do not include any prefixes (e.g. 'Slug: ', or 'Url: ').")

class slug_generator(dspy.Module):
        def __init__(self):
            super().__init__()
            self.slug_generator = dspy.Predict(SlugGenerator)

        def forward(self, article):
            with dspy.context(lm=gpt4omini):
                slug = self.slug_generator(article=article).slug

            return {"slug": slug}