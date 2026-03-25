import logging
from modules.e_editing.layout.layout import clean_layout

def editing(article):
    """
    Applies editing functions to all versions of the article, except for the original version and 
    only when showVersion is set to 'no'.

    Returns:
    - results: The updated dictionary where each version's body (except original) has been edited.
    """
    try:
        # Loop over the different versions in the article
        for version in article:
            # Skip metadata and original version
            if version == 'metadata' or version == 'original':
                continue

            # Apply editing only if 'showVersion' is 'no'
            if article[version].get('showVersion') == 'no':
                # Check language with moderation endpoint
                # TO BE DONE: add OpenAI moderation endpoint here

                # Transform article body to be ready for publication on website 
                if 'body' in article[version]:
                    article[version]['body'] = clean_layout(article[version]['body'])

        return article

    except Exception as e:
        logging.error(f"Error in editing function: {e}")
        return article
