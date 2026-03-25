from modules.h_database.run import transform_json_for_website, set_all_articles
import pandas as pd
import os
import glob

def test_push_existing_articles(file_name: str, file_path: str = 'data/output/articles'):
    """
    Function to push existing articles from a specified Excel file to Redis and Supabase.

    :param file_name: The name of the Excel file (without extension) containing the articles.
    :param file_path: The path to the directory containing the Excel file. Default is 'data/output/articles'.
    """
    # Construct the full path to the Excel file
    excel_file_path = f"{file_path}/{file_name}.xlsx"

    # Load the articles from the specified Excel file
    df_articles = pd.read_excel(excel_file_path)

    # Transform the DataFrame to the JSON format expected by the website
    articles_publish = transform_json_for_website(df_articles)

    # Push the articles to Redis and Supabase
    key_ids_publish = set_all_articles(articles_publish)

# Directory containing the .xlsx files
directory = 'data/output/articles'

# Find all .xlsx files in the directory
xlsx_files = glob.glob(os.path.join(directory, '*.xlsx'))

# Loop through each file and apply the function
for xlsx_file in xlsx_files:
    file_name = os.path.splitext(os.path.basename(xlsx_file))[0]
    test_push_existing_articles(file_name)