import logging

from modules.utils.writing.first_draft import first_draft_rewrite_new
from modules.utils.writing.title_leads import generate_title_and_lead
from modules.utils.writing.push_notifications import generate_push_notification
from modules.utils.facts.fact_extraction import extract_facts_from_article
from modules.utils.facts.fact_checking import compare_facts
# TO BE DONE: Add dimension check to check if rewrite is substantial enough

def more_negative_version(regular_article, regular_facts, version_info, push):
    """
    Rewrite regular article to more negative version, wchile checking facts and dimensions.
    
    Returns:
    - A dictionary containing all the generated data: body, title, lead, sentences, facts, showVersion, tooltipVersion, push_title, push_body.
    """
    try:
        # Step 1: Extract showVersion and tooltipVersion from version_info
        showVersion = version_info['more_negative']['showVersion']
        tooltipVersion = version_info['more_negative']['tooltipVersion']

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

        # Step 2: Rewrite regular article to more negative conditional on customization rater (showVersion)
        more_negative_article_sentences = first_draft_rewrite_new(article=regular_article, version='more_negative', showVersion=showVersion)
        more_negative_article = more_negative_article_sentences['rewritten_article']
        more_negative_sentences = more_negative_article_sentences['sentences']

        # Step 3: Check that more negative version is substantially different from regular
        # TO BE DONE: simple LLM pairwise check

        # Step 4 (optional): Rewrite more negative version if dimnesion check fails
        # TO BE DONE: Add feedback loop

        # Step 5: Extract facts from more negative article
        # facts_more_negative = extract_facts_from_article()(article=more_negative_article)
        facts_more_negative = []
        # Step 6: Compare facts from regular and more_negative articles
        # fact_check_regular_more_negative = compare_facts(regular_facts, facts_more_negative)

        # Step 7 (optional): Rewrite more negative version if facts check fails
        # TO BE DONE: Add feedback loop

        # Step 8: Generate title and lead for more negative version
        more_negative_title_lead = generate_title_and_lead(article=more_negative_article, version='more_negative')
        more_negative_title = more_negative_title_lead["title"]
        more_negative_lead = more_negative_title_lead["lead"]

        # Step 9: Generate push notification content (title & body) for more negative version
        if push:
            more_negative_push_notification = generate_push_notification(original_title=more_negative_title, original_lead=more_negative_lead, version='more_negative')
            more_negative_push_notification_title = more_negative_push_notification['title']
            more_negative_push_notification_body = more_negative_push_notification['body']
        else:
            more_negative_push_notification_title = ''
            more_negative_push_notification_body = ''

        return {
            'body': more_negative_article,
            'title': more_negative_title,
            'lead': more_negative_lead,
            'sentences': more_negative_sentences,
            'facts': facts_more_negative,
            'showVersion': showVersion,
            'tooltipVersion': tooltipVersion,
            'push_title': more_negative_push_notification_title,
            'push_body': more_negative_push_notification_body
        }
    except Exception as e:
        logging.error(f"Error processing more_negative version: {e}")
        return {}