import logging
import pandas as pd
import uuid

from modules.h_database.database_format import transform_json_for_website
from modules.h_database.api.redis import setRedis_with_key
from modules.h_database.api.supabase import setSupabase_with_key

from modules.utils.excel_utils import save_to_excel

def set_all_articles(data_frame, testing_mode):
    """
    Transforms the article data, assigns unique keys, and uploads the articles to Redis and Supabase.

    This function processes a DataFrame containing multiple articles by:
    1. Transforming the DataFrame into a JSON format compatible with the website.
    2. For each article:
       - Generates a unique UUID (article_key) to be used for Redis and Supabase.
       - Pushes the article to Redis with a formatted articleKey (prefixed with "article:").
       - Pushes the article to Supabase using the plain UUID as the articleKey.
    3. Collects the article IDs and corresponding keys from both Redis and Supabase.
    4. Stores the mapping between article IDs and article keys in an Excel file for reference.

    Parameters:
    - data_frame: The DataFrame containing the article data.

    Side Effects:
    - Articles are pushed to Redis and Supabase.
    - An Excel file mapping article IDs and keys is saved for future reference.

    """
    try:
        articles = transform_json_for_website(data_frame)
        ids = []
        article_keys = []

        for article in articles:
            # Generate a unique uuid for this article
            article_uuid = str(uuid.uuid4())

            # Use "article:" + uuid for Redis
            article_key_redis = "article:" + article_uuid

            # Use just the uuid for Supabase
            article_key_supabase = article_uuid

            # Push to Redis using the formatted articleKey
            id_redis, _ = setRedis_with_key(article, article_key_redis)

            # Push to Supabase using the plain uuid as articleKey
            id_supabase, _ = setSupabase_with_key(article, article_key_supabase, testing_mode=testing_mode)

            # Collect IDs and keys
            ids.append(id_supabase or id_redis)
            article_keys.append(article_key_supabase)  # Use Supabase key for consistency

        key_id_df = pd.DataFrame({
            'ids': ids,
            'article_keys': article_keys
        })

        # Save excel to match database key id with article uri
        key_id_df_path = 'data/output/key_id_matching'
        save_to_excel(key_id_df, key_id_df_path, 'key_id')

    except Exception as e:
        logging.error(f"Error setting all articles: {e}")
        return

    return
