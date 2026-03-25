import logging
import json

from modules.b_summary_metadata.metadata.reading_time import estimate_reading_time
from modules.b_summary_metadata.metadata.tags_slug import tags_generator, slug_generator

from modules.utils.writing.first_draft import first_draft_rewrite_new
from modules.utils.writing.title_leads import generate_title_and_lead
from modules.utils.writing.push_notifications import generate_push_notification
from modules.utils.facts.fact_extraction import extract_facts_from_article
from modules.utils.facts.fact_checking import compare_facts

def summary_metadata(row):
    """
    Processes a row corresponding to an article to generate metadata and regular article.
    
    Returns:
    - A dictionary containing all the generated data.
    """
    try:
        # Step 1: Extract metadata along with the original article
        try:
            # Serialize 'category', it's a list
            category = json.dumps(row['llm_category']) if isinstance(row['llm_category'], list) else row['llm_category']
        except Exception as e:
            logging.error(f"Error serializing 'category' for uri {row['uri']}: {e}")
            category = '[]'  # Default to an empty category list as a string

        try:
            # Serialize 'category', it's a list
            sub_category = json.dumps(row['llm_subcategory']) if isinstance(row['llm_subcategory'], list) else row['llm_subcategory']
        except Exception as e:
            logging.error(f"Error serializing 'category' for uri {row['uri']}: {e}")
            sub_category = '[]'  # Default to an empty category list as a string

        try:
            # Serialize 'sources', it's a dictionary or list
            sources = json.dumps(row['sources']) if isinstance(row['sources'], (list, dict)) else row['sources']
        except Exception as e:
            logging.error(f"Error serializing 'sources' for uri {row['uri']}: {e}")
            sources = '[]'  # Default to an empty list for sources

        logging.info(f"Processing row with uri: {row['uri']}")
        logging.info(f"Category after serialization: {category}")
        logging.info(f"Subcategory after serialization: {sub_category}")
        logging.info(f"Sources after serialization: {sources}")
        
        metadata = {
            'uri': row['uri'],
            'datetime': row['datetime'],
            'category': category,  # Serialized category
            'sub_category': sub_category,  # Serialized subcategory
            'trendingRecency': row['trendingRecency'],
            'trendingScoreRaw': row['trending_score'],
            'sentiment_original_api': row['sentiment'],
            'sources': sources,  # Serialized sources
            'imageUrl': row['imageUrl'],
            'push': row['push']
        }
        
        original_article = row['body']
        original_title = row['title']

        # Step 2: Rewrite the article to regular version
        regular_article_sentences = first_draft_rewrite_new(article=original_article, version='regular', showVersion='no')
        regular_article = regular_article_sentences['rewritten_article']
        regular_sentences = regular_article_sentences['sentences']

        # Step 3: Check that regular version is substantially different from original (TO DO)

        # Step 4: Extract facts from original and regular articles
        # facts = {
        #     "original": extract_facts_from_article()(article=original_article),
        #     "regular": extract_facts_from_article()(article=regular_article)
        # }

        facts = {
            "original": [],
            "regular": []
        }

        # Step 5: Compare facts from original and regular articles (TO DO)
        # fact_check_original_regular = compare_facts(facts["original"], facts["regular"])

        # Step 6 (optional): Rewrite regular version if facts check fails (TO DO)

        # Step 7: Generate title and lead for regular version
        regular_title_lead = generate_title_and_lead(article=regular_article, version='regular')
        regular_title = regular_title_lead["title"]
        regular_lead = regular_title_lead["lead"]

        # Step 8: Estimate reading time for regular version
        reading_time = estimate_reading_time(article=regular_article)

        # Step 9: Generate tags and slug for regular version
        tags_slug = tags_generator()(article=regular_article)    
        tags = tags_slug['tags']
        slug = tags_slug['slug']

        # Step 10: Generate push notification for regular version
        push = metadata['push']
        if push:
            regular_push_notification = generate_push_notification(original_title=regular_title, original_lead=regular_lead, version='regular')
            regular_push_notification_title = regular_push_notification['title']
            regular_push_notification_body = regular_push_notification['body']
        else:
            regular_push_notification_title = ''
            regular_push_notification_body = ''

        # Constructing the return dictionary
        return {
            'metadata': {
                **metadata,  # Expanding the metadata dictionary directly
                'tags': tags,
                'slug': slug,
                'reading_time': reading_time,
            },
            'original': {
                'body': original_article,
                'title': original_title,
                'lead': '',  # No lead for original version
                'sentences': '',  # No reflection sentences for original version
                'facts': facts['original'],
                'showVersion': 'NA',  # Not relevant for original version
                'tooltipVersion': 'NA',  # Not relevant for original version
                'push_title': 'NA',  # Not relevant for original version
                'push_body': 'NA'  # Not relevant for original version
            },
            'regular': {
                'body': regular_article,
                'title': regular_title,
                'lead': regular_lead,
                'sentences': regular_sentences,
                'facts': facts['regular'],
                'showVersion': 'no',  # Regular version will always be shown
                'tooltipVersion': '',  # No tooltip needed if version is shown
                'push_title': regular_push_notification_title,
                'push_body': regular_push_notification_body
            }
        }

    except Exception as e:
        logging.error(f"Error processing row {row['uri']}: {e}")
        return None
