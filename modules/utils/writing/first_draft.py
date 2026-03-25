import logging
import re

from modules.b_summary_metadata.regular_summary.prompts.regular_body import rewrite_regular
from modules.d_versions.conservative.prompts.conservative_body import rewrite_conservative
from modules.d_versions.liberal.prompts.liberal_body import rewrite_liberal
from modules.d_versions.entertaining.prompts.entertaining_body import rewrite_entertaining
from modules.d_versions.less_complex.prompts.less_complex_body import rewrite_less_complex
from modules.d_versions.more_positive.prompts.more_positive_body import rewrite_more_positive
from modules.d_versions.more_negative.prompts.more_negative_body import rewrite_more_negative
from modules.d_versions.facts_only.prompts.facts_only_body import rewrite_facts_only

def clean_text(text):
    """Clean the rewritten article text by removing unnecessary prefixes."""
    if isinstance(text, str):
        pattern = re.compile(r'^(Article: ?|Rewritten Article: ?|Summary: ?)')
        return pattern.sub('', text)
    return text
    
def first_draft_rewrite_new(article, version, showVersion):
    """
    Rewrites the article for a specified version and cleans the resulting text.

    Parameters:
    - article: The article text to be rewritten.
    - version: The version type to rewrite.
    - showVersion: Indicates whether the version should be processed ('yes' to skip processing).

    Returns:
    - A dictionary containing the rewritten article and the corresponding sentences, or an empty string if not processed.
    """
    if showVersion == 'no':
        try:
            if version == "regular":
                # Handle the regular version specifically
                rewritten_result = rewrite_regular(article=article)
                
                # Clean the rewritten article text
                cleaned_article = clean_text(rewritten_result.summary)
                
                return {
                    'rewritten_article': cleaned_article,
                    'sentences': ''  # No sentences for the regular version
                }
            else:
                # Dynamically call the appropriate rewrite function based on the version
                rewrite_function = globals()[f'rewrite_{version}']
                rewrite_result = rewrite_function(article=article)
                rewritten_article = rewrite_result.rewritten_article
                rewritten_sentences = rewrite_result.sentences
                
                # Clean the rewritten article text
                cleaned_article = clean_text(rewritten_article)
                
                return {
                    'rewritten_article': cleaned_article,
                    'sentences': rewritten_sentences
                }
        except Exception as e:
            logging.error(f'Error rewriting {version}: {e}')
            return {
                'rewritten_article': "",
                'sentences': ""
            }
    else:
        return {
            'rewritten_article': "",
            'sentences': ""
        }

###########OLD CODE################

def first_draft_rewrite(article, showConservative, showLiberal, showLessComplex, showMoreNegative, showMorePositive, showEntertaining):
    versions = ['conservative', 'liberal', 'less_complex', 'more_negative', 'more_positive', 'entertaining', 'facts_only']
    inputs = [showConservative, showLiberal, showLessComplex, showMoreNegative, showMorePositive, showEntertaining]

    # Filter out versions based on input variables from customization rating
    filtered_versions = [version for version, include in zip(versions, inputs) if include != 'yes']

    try:
        rewritten_regular = rewrite_regular(article=article).summary
    except Exception as e:
        logging.error(f'Error rewriting regular: {e}')
        return None

    article_versions = {
        'original': article,
        'regular': rewritten_regular
    }

    sentences = {
        'original': '',
        'regular': ''
    }

    for version in versions:
        if version in filtered_versions:
            try:
                rewrite_function = globals()[f'rewrite_{version}']
                rewritten_article = rewrite_function(article=rewritten_regular)

                article_versions[version] = rewritten_article.rewritten_article
                sentences[version] = rewritten_article.sentences
            except Exception as e:
                logging.error(f'Error rewriting {version}: {e}')
                return None
        else:
            article_versions[version] = ""
            sentences[version] = ""

    for key in article_versions:
        article_versions[key] = clean_text(article_versions[key])

    return {
        'rewritten_articles': article_versions,
        'sentences': sentences
    }