import logging
import pandas as pd

from modules.utils.excel_utils import save_to_excel

def send_to_review(df_results, review_file_path='data/review/articles/review_articles.xlsx'):
    """
    Processes articles for review or immediate publishing based on the 'human_review' column.
    
    Parameters:
    - df_results: DataFrame containing processed articles with a 'human_review' column.
    - review_file_path: The path to the Excel file where review articles are stored.

    Returns:
    - df_publish: DataFrame with articles ready for immediate publishing.
    """

    try:
        # Split data frame into frame to be reviewed and frame to be immediately published
        df_review = df_results[df_results['human_review'] == 'yes'].copy()
        df_publish = df_results[df_results['human_review'] == 'no'].copy()

        # Initialize 'reviewed' and 'published' columns for articles to be reviewed
        if not df_review.empty:
            df_review['reviewed'] = 'no'
            df_review['published'] = 'no'

        # Load articles set for review previously
        try:
            review_articles = pd.read_excel(review_file_path)
        except FileNotFoundError:
            logging.warning(f"Review file not found at {review_file_path}. Initializing new review DataFrame.")
            review_articles = pd.DataFrame()

        # Check if reviewed articles are ready to be published
        if not review_articles.empty:
            grouped_review_articles = review_articles.groupby('uri')
            for uri, group in grouped_review_articles:
                # If all versions of the article have been reviewed and none are published
                if all(group['reviewed'] == 'yes') and all(group['published'] == 'no'):
                    # Add reviewed articles to publishable articles
                    group_to_publish = group.drop(columns=['reviewed', 'published']).fillna('')
                    df_publish = pd.concat([df_publish, group_to_publish], ignore_index=True)
                    # Mark articles as published in the review file
                    review_articles.loc[review_articles['uri'] == uri, 'published'] = 'yes'

        # Add new articles to be reviewed and update the review excel file
        review_articles = pd.concat([review_articles, df_review], ignore_index=True)
        review_articles.to_excel(review_file_path, index=False)

        # Save publishable articles to excel
        df_name_publish, df_path_publish = 'publish', 'data/output/articles'
        save_to_excel(df_publish, df_path_publish, df_name_publish)

        return df_publish

    except Exception as e:
        logging.error(f"Error in sending articles to review: {e}")
        return pd.DataFrame()  # Return an empty DataFrame on error