import re
import dspy
import config

class htmlEditor(dspy.Signature):
    """
    ---CONTEXT---
    You're an experienced editor at a renowned online news outlet.

    ---TASK---
    Break the article into paragraphs based on your experience as a news editor. Use html tags to separate the paragraphs.

    ---GUIDELINES---
    - Paragraphs of the article should be wrapped in <p> and </p> tags.
    - Make sure to also wrap the first paragraph in <p> and </p> tags.
    - Do not change anything in the article except for breaking it into paragraphs.
    """
    article: str = dspy.InputField()
    edited_article: str = dspy.OutputField(desc="edited article. Do not change anything expect for adding html tags. Do not include any prefixes to the article (e.g. 'Article: ', 'Edited Article:', or 'html').")

html_editor = dspy.Predict(htmlEditor)

def clean_layout(article):
    """
    Prepare articlea to be published on website by removing any prefixes and wrapping paragraphs in <p> tags that LLM missed.
    """
    html_article = html_editor(article=article).edited_article

    pattern = re.compile(r'^(html|```)')
    cleaned_text = pattern.sub('', html_article)

    paragraphs = cleaned_text.split('\n')
    paragraphs = [
        p if p.startswith('<p>') and p.endswith('</p>') else f'<p>{p}</p>' 
        for p in paragraphs if p.strip()
    ]
    
    return '\n'.join(paragraphs)

########OLD CODE########
def layout_processing(article):
    edited_article = clean_layout(article)
    return edited_article