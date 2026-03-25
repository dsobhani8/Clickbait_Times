import logging

from modules.utils.writing.first_draft import first_draft_rewrite_new
from modules.utils.writing.title_leads import generate_title_and_lead
from modules.utils.writing.push_notifications import generate_push_notification
from modules.utils.facts.fact_extraction import extract_facts_from_article
from modules.utils.facts.fact_checking import compare_facts
# TO BE DONE: Add dimension check to check if rewrite is substantial enough

def facts_only_version(regular_article, regular_facts, version_info, push):
    """
    Rewrite regular article to facts-only version, while checking facts and dimensions.
    
    Returns:
    - A dictionary containing all the generated data: body, title, lead, sentences, facts, showVersion, tooltipVersion, push_title, push_body.
    """
    try:
        # Step 1: Extract showVersion and tooltipVersion from version_info
        showVersion = version_info['facts_only']['showVersion']
        tooltipVersion = version_info['facts_only']['tooltipVersion']

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

        # Step 2: Rewrite regular article to facts only conditional on customization rater (showVersion)
        facts_only_article_sentences = first_draft_rewrite_new(article=regular_article, version='facts_only', showVersion=showVersion)
        facts_only_article = facts_only_article_sentences['rewritten_article']
        facts_only_sentences = facts_only_article_sentences['sentences']

        # Step 3: Check that facts only version is substantially different from regular
        # TO BE DONE: simple LLM pairwise check

        # Step 4 (optional): Rewrite facts only version if dimnesion check fails
        # TO BE DONE: Add feedback loop

        # Step 5: Extract facts from facts only article
        # facts_facts_only = extract_facts_from_article()(article=facts_only_article)
        facts_facts_only = []
        # Step 6: Compare facts from regular and facts_only articles
        # fact_check_regular_facts_only = compare_facts(regular_facts, facts_facts_only)

        # Step 7 (optional): Rewrite facts only version if facts check fails
        # TO BE DONE: Add feedback loop

        # Step 8: Generate title and lead for facts only version
        facts_only_title_lead = generate_title_and_lead(article=facts_only_article, version='facts_only')
        facts_only_title = facts_only_title_lead["title"]
        facts_only_lead = facts_only_title_lead["lead"]

        # Step 9: Generate push notification content (title & body) for facts only version
        if push:
            facts_only_push_notification = generate_push_notification(original_title=facts_only_title, original_lead=facts_only_lead, version='facts_only')
            facts_only_push_notification_title = facts_only_push_notification['title']
            facts_only_push_notification_body = facts_only_push_notification['body']
        else:
            facts_only_push_notification_title = ''
            facts_only_push_notification_body = ''

        return {
            'body': facts_only_article,
            'title': facts_only_title,
            'lead': facts_only_lead,
            'sentences': facts_only_sentences,
            'facts': facts_facts_only,
            'showVersion': showVersion,
            'tooltipVersion': tooltipVersion,
            'push_title': facts_only_push_notification_title,
            'push_body': facts_only_push_notification_body
        }
    except Exception as e:
        logging.error(f"Error processing facts_only version: {e}")
        return {}