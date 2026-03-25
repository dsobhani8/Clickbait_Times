import logging
import re

from modules.b_summary_metadata.regular_summary.prompts.regular_title_lead import title_lead_regular
from modules.d_versions.conservative.prompts.conservative_title_lead import title_lead_conservative
from modules.d_versions.liberal.prompts.liberal_title_lead import title_lead_liberal
from modules.d_versions.entertaining.prompts.entertaining_title_lead import title_lead_entertaining
from modules.d_versions.less_complex.prompts.less_complex_title_lead import title_lead_less_complex
from modules.d_versions.more_positive.prompts.more_positive_title_lead import title_lead_more_positive
from modules.d_versions.more_negative.prompts.more_negative_title_lead import title_lead_more_negative
from modules.d_versions.facts_only.prompts.facts_only_title_lead import title_lead_facts_only

def clean_title(text):
    """
    Clean the rewritten title by removing unnecessary prefixes.
    Also split the text to get the title, as sometimes the LLM returns both title and lead in one string, where the first line is the title.
    """
    pattern = re.compile(r'^(Title: ?|Rewritten Title: ?)')
    cleaned_title = pattern.sub('', text)
    cleaned_title = cleaned_title.split('\n')[0]
    return cleaned_title

def clean_lead(text):
    """
    Clean the rewritten lead by removing unnecessary prefixes.
    Also split the text to get the lead, as sometimes the LLM returns both title and lead in one string, where the second line is the lead.
    """
    pattern = re.compile(r'^(Lead: ?|Rewritten Lead: ?)')
    cleaned_lead = pattern.sub('', text)
    parts = cleaned_lead.split('\n', 1)
    cleaned_lead = parts[1] if len(parts) > 1 else parts[0]
    return cleaned_lead

def generate_title_and_lead(article, version):
    """
    Generates and cleans the title and lead for a specified version.

    Parameters:
    - article: The article text to generate the title and lead from.
    - version: The version type to generate (e.g., 'conservative', 'liberal').

    Returns:
    - A dictionary containing the cleaned title and lead.
    """
    try:
        # Dynamically call the appropriate title and lead generation function based on the version
        title_lead_function = globals()[f'title_lead_{version}']
        title_leads = title_lead_function(article=article)
        
        # Clean the generated title and lead
        title = clean_title(title_leads.title)
        lead = clean_lead(title_leads.lead)
        
        return {
            'title': title,
            'lead': lead
        }
    except Exception as e:
        logging.error(f'Error generating title and lead for {version}: {e}')
        return {
            'title': "",
            'lead': ""
        }
