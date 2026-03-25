import logging

from modules.utils.writing.first_draft import first_draft_rewrite_new
from modules.utils.writing.title_leads import generate_title_and_lead
from modules.utils.writing.push_notifications import generate_push_notification
from modules.utils.facts.fact_extraction import extract_facts_from_article
from modules.utils.facts.fact_checking import compare_facts
# TO BE DONE: Add dimension check to check if rewrite is substantial enough

def entertaining_version(regular_article, regular_facts, version_info, push):
    """
    Rewrite regular article to entertaining version, wchile checking facts and dimensions.
    
    Returns:
    - A dictionary containing all the generated data: body, title, lead, sentences, facts, showVersion, tooltipVersion, push_title, push_body.
    """
    try:
        # Step 1: Extract showVersion and tooltipVersion from version_info
        showVersion = version_info['entertaining']['showVersion']
        tooltipVersion = version_info['entertaining']['tooltipVersion']

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

        # Step 2: Rewrite regular article to entertaining conditional on customization rater (showVersion)
        entertaining_article_sentences = first_draft_rewrite_new(article=regular_article, version='entertaining', showVersion=showVersion)
        entertaining_article = entertaining_article_sentences['rewritten_article']
        entertaining_sentences = entertaining_article_sentences['sentences']

        # Step 3: Check that entertaining version is substantially different from regular
        # TO BE DONE: simple LLM pairwise check

        # Step 4 (optional): Rewrite entertaining version if dimnesion check fails
        # TO BE DONE: Add feedback loop

        # Step 5: Extract facts from entertaining article
        # facts_entertaining = extract_facts_from_article()(article=entertaining_article)
        facts_entertaining = []
        # Step 6: Compare facts from regular and entertaining articles
        # fact_check_regular_entertaining = compare_facts(regular_facts, facts_entertaining)

        # Step 7 (optional): Rewrite entertaining version if facts check fails
        # TO BE DONE: Add feedback loop

        # Step 8: Generate title and lead for entertaining version
        entertaining_title_lead = generate_title_and_lead(article=entertaining_article, version='entertaining')
        entertaining_title = entertaining_title_lead["title"]
        entertaining_lead = entertaining_title_lead["lead"]

        # Step 9: Generate push notification content (title & body) for entertaining version
        if push:
            entertaining_push_notification = generate_push_notification(original_title=entertaining_title, original_lead=entertaining_lead, version='entertaining')
            entertaining_push_notification_title = entertaining_push_notification['title']
            entertaining_push_notification_body = entertaining_push_notification['body']
        else:
            entertaining_push_notification_title = ''
            entertaining_push_notification_body = ''

        return {
            'body': entertaining_article,
            'title': entertaining_title,
            'lead': entertaining_lead,
            'sentences': entertaining_sentences,
            'facts': facts_entertaining,
            'showVersion': showVersion,
            'tooltipVersion': tooltipVersion,
            'push_title': entertaining_push_notification_title,
            'push_body': entertaining_push_notification_body
        }
    except Exception as e:
        logging.error(f"Error processing entertaining version: {e}")
        return {}