import logging
import pandas as pd

from modules.f_human_review.human_review.human_review_rule import human_review_rule
from modules.f_human_review.human_review.transform_to_df import transform_results_to_df

def human_review(article, customization_score):
    """
    Processes the article to determine whether human review is necessary and handles the review and publishing logic.
    
    Returns:
    - df_all_data_compiled: DataFrame containing article data with the 'human_review' column.
    """
    try:
        # Transform the article into a data frame
        df_all_data_compiled = transform_results_to_df(article)

        # Check if human review is necessary
        review_needed = human_review_rule(customization_score, df_all_data_compiled)

        # Add the 'human_review' column to the DataFrame
        df_all_data_compiled['human_review'] = 'yes' if review_needed else 'no'

        return df_all_data_compiled

    except Exception as e:
        logging.error(f"Error in human review: {e}")
        return pd.DataFrame()