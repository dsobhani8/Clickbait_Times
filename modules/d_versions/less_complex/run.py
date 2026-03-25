import logging

from modules.utils.writing.first_draft import first_draft_rewrite_new
from modules.utils.writing.title_leads import generate_title_and_lead
from modules.utils.writing.push_notifications import generate_push_notification
from modules.utils.facts.fact_extraction import extract_facts_from_article
from modules.utils.facts.fact_checking import compare_facts
# TO BE DONE: Add dimension check to check if rewrite is substantial enough

def less_complex_version(regular_article, regular_facts, version_info, push):
    """
    Rewrite regular article to less complex version, wchile checking facts and dimensions.
    
    Returns:
    - A dictionary containing all the generated data: body, title, lead, sentences, facts, showVersion, tooltipVersion, push_title, push_body.
    """
    try:
        # Step 1: Extract showVersion and tooltipVersion from version_info
        showVersion = version_info['less_complex']['showVersion']
        tooltipVersion = version_info['less_complex']['tooltipVersion']

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

        # Step 2: Rewrite regular article to less complex conditional on customization rater (showVersion)
        less_complex_article_sentences = first_draft_rewrite_new(article=regular_article, version='less_complex', showVersion=showVersion)
        less_complex_article = less_complex_article_sentences['rewritten_article']
        less_complex_sentences = less_complex_article_sentences['sentences']

        # Step 3: Check that less complex version is substantially different from regular
        # TO BE DONE: simple LLM pairwise check

        # Step 4 (optional): Rewrite less complex version if dimnesion check fails
        # TO BE DONE: Add feedback loop

        # Step 5: Extract facts from less complex article
        # facts_less_complex = extract_facts_from_article()(article=less_complex_article)
        facts_less_complex = []
        # Step 6: Compare facts from regular and less_complex articles
        # fact_check_regular_less_complex = compare_facts(regular_facts, facts_less_complex)

        # Step 7 (optional): Rewrite less complex version if facts check fails
        # TO BE DONE: Add feedback loop

        # Step 8: Generate title and lead for less complex version
        less_complex_title_lead = generate_title_and_lead(article=less_complex_article, version='less_complex')
        less_complex_title = less_complex_title_lead["title"]
        less_complex_lead = less_complex_title_lead["lead"]

        # Step 9: Generate push notification content (title & body) for less complex version
        if push:
            less_complex_push_notification = generate_push_notification(original_title=less_complex_title, original_lead=less_complex_lead, version='less_complex')
            less_complex_push_notification_title = less_complex_push_notification['title']
            less_complex_push_notification_body = less_complex_push_notification['body']
        else:
            less_complex_push_notification_title = ''
            less_complex_push_notification_body = ''

        return {
            'body': less_complex_article,
            'title': less_complex_title,
            'lead': less_complex_lead,
            'sentences': less_complex_sentences,
            'facts': facts_less_complex,
            'showVersion': showVersion,
            'tooltipVersion': tooltipVersion,
            'push_title': less_complex_push_notification_title,
            'push_body': less_complex_push_notification_body
        }
    except Exception as e:
        logging.error(f"Error processing less_complex version: {e}")
        return {}