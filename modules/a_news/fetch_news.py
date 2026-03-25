import logging
import pandas as pd
import math
from modules.a_news.news_api import initialize_event_registry
from modules.a_news.preprocess_news import (
    filter_articles_by_type, exclude_non_standard_articles, exclude_articles_by_image, replace_image_url,
    filter_articles_by_length, get_cat_llm, filter_past_hour,
    select_top_trending_articles, replace_apnews_with_associated_press,
    add_trending_recency, increment_duplicate_trending_scores, retrieve_articles
)
from modules.utils.excel_utils import save_to_excel
from modules.a_news.news_config import IMAGE_URL, MIN_WORDS, MAX_WORDS, ARTICLES_PER_DAY

def fetch_and_preprocess_news():
    """
    Fetches and preprocesses articles from the Event Registry.
    
    Steps:
    1. Retrieves articles from the given source.
    2. Filters articles based on recency, type, length, image, and category.
    3. Combines 'source' and 'url' fields into a 'sources' field.
    4. Limits the number of sports articles to a maximum of 30% of non-sports articles.
    5. Saves the filtered articles to an Excel file and returns the DataFrame.

    Returns:
    - A pandas DataFrame containing the filtered and preprocessed articles.
    """
    try:
        logging.info("Initializing Event Registry API...")
        er = initialize_event_registry()
        source = 'apnews.com'

        logging.info("Retrieving articles...")
        df_articles = retrieve_articles(source, er)
        
        # Applying all preprocessing steps
        df_articles = filter_past_hour(df_articles)
        df_articles = replace_apnews_with_associated_press(df_articles)
        df_articles = filter_articles_by_type(df_articles)
        df_articles = exclude_non_standard_articles(df_articles)
        # df_articles = exclude_articles_by_image(df_articles, IMAGE_URL)
        df_articles = replace_image_url(df_articles, IMAGE_URL)
        df_articles = filter_articles_by_length(df_articles, MIN_WORDS, MAX_WORDS)
        df_articles = get_cat_llm(df_articles)
        df_articles = select_top_trending_articles(df_articles, ARTICLES_PER_DAY)
        df_articles = increment_duplicate_trending_scores(df_articles)
        df_articles = add_trending_recency(df_articles)

        logging.info("Combining 'source' and 'url' into 'sources' format...")
        df_articles["sources"] = df_articles.apply(
            lambda row: [{"name": row["source"], "url": row["url"]}], axis=1
        )
        df_articles = df_articles.drop(columns=["source", "url"])

        # Limiting number of sports articles to 30% of non-sports articles
        logging.info("Limiting number of sports articles to 30% of non-sports articles...")
        non_sports_df = df_articles[~df_articles["llm_category"].apply(lambda x: 'Sports' in x if isinstance(x, list) else False)]
        sports_df = df_articles[df_articles["llm_category"].apply(lambda x: 'Sports' in x if isinstance(x, list) else False)]
        non_sports_count = len(non_sports_df)
        max_sports_count = math.ceil(0.3 * non_sports_count)
        sports_df = sports_df.sort_values(by="trendingRecency", ascending=False).head(max_sports_count)
        df_articles_filtered = pd.concat([non_sports_df, sports_df], ignore_index=True)

        # Add 'push' column based on highest trending_score
        logging.info("Adding 'push' column based on highest trending_score...")
        df_articles_filtered['push'] = False
        max_trending_score_index = df_articles_filtered['trending_score'].idxmax()
        df_articles_filtered.loc[max_trending_score_index, 'push'] = True

        # Preparing data for Excel output
        logging.info("Preparing data for Excel export...")
        file_path = 'data/raw/articles'
        filename = 'articles'
        cols_to_keep = ["uri", "dateTimePub", "title", "body", "llm_category", "llm_subcategory", "trending_score", "trendingRecency", "sentiment", "sources", "image", "push"]
        df_for_excel = df_articles_filtered[cols_to_keep]

        # Format the date
        df_for_excel.loc[:, 'dateTimePub'] = pd.to_datetime(df_for_excel['dateTimePub']).dt.strftime('%Y-%m-%d %H:%M:%S')
        df_for_excel = df_for_excel.rename(columns={"dateTimePub": "datetime", "image": "imageUrl"})

        # Save the processed articles to an Excel file
        logging.info("Saving articles to Excel file...")
        save_to_excel(df_for_excel, file_path, filename)
        
        return df_for_excel

    except Exception as e:
        logging.error(f"Error in fetch_and_preprocess_news: {e}")
        return pd.DataFrame()  # Return an empty DataFrame on error

if __name__ == "__main__":
    # Set up basic logging configuration
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

    logging.info("Starting article fetching and preprocessing...")
    fetch_and_preprocess_news()
    logging.info("Article fetching and preprocessing completed.")
