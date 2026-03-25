import logging
import re

from modules.b_summary_metadata.regular_summary.prompts.regular_push import push_regular
from modules.d_versions.conservative.prompts.conservative_push import push_conservative
from modules.d_versions.liberal.prompts.liberal_push import push_liberal
from modules.d_versions.entertaining.prompts.entertaining_push import push_entertaining
from modules.d_versions.less_complex.prompts.less_complex_push import push_less_complex
from modules.d_versions.more_positive.prompts.more_positive_push import push_more_positive
from modules.d_versions.more_negative.prompts.more_negative_push import push_more_negative
from modules.d_versions.facts_only.prompts.facts_only_push import push_facts_only

def clean_push_title(text):
    """
    Clean the rewritten title by removing unnecessary prefixes.
    Also split the text to get the title, as sometimes the LLM returns both title and lead in one string, where the first line is the title.
    """
    pattern = re.compile(r'^(Title: ?|Rewritten Title: ?|Push Title: ?|Rewritten Push Title: ?)')
    cleaned_title = pattern.sub('', text)
    cleaned_title = cleaned_title.split('\n')[0]
    return cleaned_title

def clean_push_body(text):
    """
    Clean the rewritten body by removing unnecessary prefixes.
    Also split the text to get the body, as sometimes the LLM returns both title and lead in one string, where the second line is the lead.
    """
    pattern = re.compile(r'^(Lead: ?|Rewritten Lead: ?|Body: ?|Rewritten Body: ?|Push Body: ?|Rewritten Push Body: ?|Push Lead: ?|Rewritten Push Lead: ?)')
    cleaned_body = pattern.sub('', text)
    parts = cleaned_body.split('\n', 1)
    cleaned_body = parts[1] if len(parts) > 1 else parts[0]
    return cleaned_body

def generate_push_notification(original_title, original_lead, version):
    """
    Generates and cleans the push notification for a specified version.

    Parameters:
    - article: The article text to generate the push notification from.
    - version: The version type to generate (e.g., 'conservative', 'liberal').

    Returns:
    - A dictionary containing the push notification title and body.
    """
    try:
        # Dynamically call the appropriate push notification generation function based on the version
        push_function = globals()[f'push_{version}']
        push_notification = push_function(original_title=original_title, original_lead=original_lead)
        
        # Clean the generated push notification items
        push_title = clean_push_title(push_notification.push_title)
        push_body = clean_push_body(push_notification.push_body)
        
        return {
            'title': push_title,
            'body': push_body
        }
    except Exception as e:
        logging.error(f'Error generating push notification for {version}: {e}')
        return {
            'title': "",
            'body': ""
        }


