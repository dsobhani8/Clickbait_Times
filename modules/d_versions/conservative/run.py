import logging

from modules.utils.writing.first_draft import first_draft_rewrite_new
from modules.utils.writing.title_leads import generate_title_and_lead
from modules.utils.writing.push_notifications import generate_push_notification
from modules.utils.facts.fact_extraction import extract_facts_from_article
from modules.utils.facts.fact_checking import compare_facts
# TO BE DONE: Add dimension check to check if rewrite is substantial enough

def conservative_version(regular_article, regular_facts, version_info, push):
    """
    Rewrite regular article to conservative version, wchile checking facts and dimensions.
    
    Returns:
    - A dictionary containing all the generated data: body, title, lead, sentences, facts, showVersion, tooltipVersion, push_title, push_body.
    """
    try:
        # Step 1: Extract showVersion and tooltipVersion from version_info
        showVersion = version_info['conservative']['showVersion']
        tooltipVersion = version_info['conservative']['tooltipVersion']

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

        # Step 2: Rewrite regular article to conservative conditional on customization rater (showVersion)
        conservative_article_sentences = first_draft_rewrite_new(article=regular_article, version='conservative', showVersion=showVersion)
        conservative_article = conservative_article_sentences['rewritten_article']
        conservative_sentences = conservative_article_sentences['sentences']

        # Step 3: Check that conservative version is substantially different from regular
        # TO BE DONE: simple LLM pairwise check

        # Step 4 (optional): Rewrite conservative version if dimnesion check fails
        # TO BE DONE: Add feedback loop

        # Step 5: Extract facts from conservative article
        # facts_conservative = extract_facts_from_article()(article=conservative_article)
        facts_conservative = []
        
        # Step 6: Compare facts from regular and conservative articles
        # fact_check_regular_conservative = compare_facts(regular_facts, facts_conservative)

        # Step 7 (optional): Rewrite conservative version if facts check fails
        # TO BE DONE: Add feedback loop

        # Step 8: Generate title and lead for conservative version
        conservative_title_lead = generate_title_and_lead(article=conservative_article, version='conservative')
        conservative_title = conservative_title_lead["title"]
        conservative_lead = conservative_title_lead["lead"]

        # Step 9: Generate push notification content (title & body) for conservative version if push is True (i.e. article with highest trending score in batch)
        if push:
            conservative_push_notification = generate_push_notification(original_title=conservative_title, original_lead=conservative_lead, version='conservative')
            conservative_push_notification_title = conservative_push_notification['title']
            conservative_push_notification_body = conservative_push_notification['body']
        else:
            conservative_push_notification_title = ''
            conservative_push_notification_body = ''

        return {
            'body': conservative_article,
            'title': conservative_title,
            'lead': conservative_lead,
            'sentences': conservative_sentences,
            'facts': facts_conservative,
            'showVersion': showVersion,
            'tooltipVersion': tooltipVersion,
            'push_title': conservative_push_notification_title,
            'push_body': conservative_push_notification_body
        }
    except Exception as e:
        logging.error(f"Error processing conservative version: {e}")
        return {}