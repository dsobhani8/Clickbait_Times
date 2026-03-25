import pandas as pd
from modules.h_database.run import transform_json_for_website, set_all_articles
from modules.utils.excel_utils import save_to_excel

def push_reviewed_articles():

    # Load review file
    review_articles = pd.read_excel('data/review/articles/review_articles.xlsx')

    # Initialize an empty DataFrame to collect all groups to publish
    all_groups_to_publish = pd.DataFrame()

    # Check if reviewed articles are ready to be published
    grouped_review_articles = review_articles.groupby('uri')
    for uri, group in grouped_review_articles:
        if all(group['reviewed'] == 'yes') and all(group['published'] == 'no'):
            # Add reviewed articles to publishable articles
            group_to_publish = group.drop(columns=['reviewed', 'published']).fillna('')
            # Append the group to the collection DataFrame
            all_groups_to_publish = pd.concat([all_groups_to_publish, group_to_publish], ignore_index=True)
            # Mark articles as published
            review_articles.loc[review_articles['uri'] == uri, 'published'] = 'yes'

    # Update review file
    review_articles.to_excel('data/review/articles/review_articles.xlsx', index=False)

    # Save publishable articles to excel
    df_name_publish, df_path_publish = 'publish', 'data/output/articles'
    save_to_excel(all_groups_to_publish, df_path_publish, df_name_publish)

    # Sent publishable articles to database
    articles_publish = transform_json_for_website(all_groups_to_publish)
    key_ids_publish = set_all_articles(articles_publish)

    # Save excel to match database key id with article uri
    key_id_df_path = 'data/output/key_id_matching'
    save_to_excel(key_ids_publish, key_id_df_path, 'key_id')

if __name__ == "__main__":
    push_reviewed_articles()