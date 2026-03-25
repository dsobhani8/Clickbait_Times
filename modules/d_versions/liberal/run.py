import logging

from modules.utils.writing.first_draft import first_draft_rewrite_new
from modules.utils.writing.title_leads import generate_title_and_lead
from modules.utils.writing.push_notifications import generate_push_notification
from modules.utils.facts.fact_extraction import extract_facts_from_article
from modules.utils.facts.fact_checking import compare_facts
# TO BE DONE: Add dimension check to check if rewrite is substantial enough

def liberal_version(regular_article, regular_facts, version_info, push):
    """
    Rewrite regular article to liberal version, wchile checking facts and dimensions.
    
    Returns:
    - A dictionary containing all the generated data: body, title, lead, sentences, facts, showVersion, tooltipVersion, push_title, push_body.
    """
    try:
        # Step 1: Extract showVersion and tooltipVersion from version_info
        showVersion = version_info['liberal']['showVersion']
        tooltipVersion = version_info['liberal']['tooltipVersion']

        # If showVersion is 'yes', we skip the rewrite and return empty strings for all values
        if showVersion == 'yes':
            return {
                'body': '',
                'title': '',
                'lead': '',
                'sentences': '',
                'facts': '',
                'showVersion': showVersion,
                'tooltipVersion': tooltipVersion,
                'push_title': '',
                'push_body': ''
            }

        # Step 2: Rewrite regular article to liberal conditional on customization rater (showVersion)
        liberal_article_sentences = first_draft_rewrite_new(article=regular_article, version='liberal', showVersion=showVersion)
        liberal_article = liberal_article_sentences['rewritten_article']
        liberal_sentences = liberal_article_sentences['sentences']

        # Step 3: Check that liberal version is substantially different from regular
        # TO BE DONE: simple LLM pairwise check

        # Step 4 (optional): Rewrite liberal version if dimnesion check fails
        # TO BE DONE: Add feedback loop

        # Step 5: Extract facts from liberal article
        # facts_liberal = extract_facts_from_article()(article=liberal_article)
        facts_liberal = []
        # Step 6: Compare facts from regular and liberal articles
        # fact_check_regular_liberal = compare_facts(regular_facts, facts_liberal)

        # Step 7 (optional): Rewrite liberal version if facts check fails
        # TO BE DONE: Add feedback loop

        # Step 8: Generate title and lead for liberal version
        liberal_title_lead = generate_title_and_lead(article=liberal_article, version='liberal')
        liberal_title = liberal_title_lead["title"]
        liberal_lead = liberal_title_lead["lead"]

        # Step 9: Generate push notification content (title & body) for liberal version
        if push:
            liberal_push_notification = generate_push_notification(original_title=liberal_title, original_lead=liberal_lead, version='liberal')
            liberal_push_notification_title = liberal_push_notification['title']
            liberal_push_notification_body = liberal_push_notification['body']
        else:
            liberal_push_notification_title = ''
            liberal_push_notification_body = ''

        return {
            'body': liberal_article,
            'title': liberal_title,
            'lead': liberal_lead,
            'sentences': liberal_sentences,
            'facts': facts_liberal,
            'showVersion': showVersion,
            'tooltipVersion': tooltipVersion,
            'push_title': liberal_push_notification_title,
            'push_body': liberal_push_notification_body
        }
    except Exception as e:
        logging.error(f"Error processing liberal version: {e}")
        return {}