import logging
import pandas as pd

from modules.b_summary_metadata.run import summary_metadata
from modules.c_customization_rater.run import version_control
from modules.d_versions.run import generate_all_versions
from modules.e_editing.run import editing
from modules.f_human_review.run import human_review

def process_article(index, row):
    """
    Processes a single article through multiple stages, including metadata extraction, version generation, editing, 
    and human review. This function performs the following steps:

    1. **Summary Metadata Module**: Extracts the original and regular versions of the article and its associated metadata.
    2. **Version Control Module**: Determines which customized versions (conservative, liberal, etc.) to generate, based on the article's content and a customization rating.
    3. **Version Generation Module**: Creates the different rewrites (e.g., conservative, liberal, less complex, etc.) based on the regular version.
    4. **Editing Module**: Applies layout and formatting changes (like paragraphing and HTML tags) to all article versions except the original.
    5. **Human Review Module**: Decides whether the article needs human review, marks it accordingly, and compiles all versions into a DataFrame for easier review.

    Args:
    - index: The index of the article in the dataset.
    - row: The row of the dataset containing the article information.

    Returns:
    - df_all_data_compiled: A DataFrame containing the metadata and all the different versions of the article, 
      including information on whether human review is required.
    """
    try:
        # Step 1: Run the summary metadata module
        metadata_original_regular = summary_metadata(row)

        # Step 2: Run the version control module
        original_article = metadata_original_regular['original']['body'] # Needed for customization rating
        category = metadata_original_regular['metadata']['category'] # Needed for non-sensitivity-related version control (currently: Sports and Lifestyle do not show political versions)
        version_info, customization_score = version_control(original_article=original_article, category=category)

        # Step 3: Run the version generation module
        regular_article = metadata_original_regular['regular']['body']
        regular_facts = metadata_original_regular['regular']['facts']
        push = metadata_original_regular['metadata']['push']
        article_versions = generate_all_versions(regular_article=regular_article, regular_facts=regular_facts, version_info=version_info, push=push)
        all_data_compiled = {**metadata_original_regular, **article_versions} # Merge metadata, original, and regular article with article versions

        # Step 4:Run editing module
        all_data_compiled = editing(all_data_compiled)

        # Step 5: Run human review module
        df_all_data_compiled = human_review(all_data_compiled, customization_score)
    
        return df_all_data_compiled

    except Exception as e:
        logging.error(f"Error processing article {index}: {e}")
        return []
