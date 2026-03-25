import ast
import pandas as pd
import logging

# Convert the DataFrame to the JSON format for the website
def transform_json_for_website(data_frame):
    """
    Transforms a DataFrame containing article versions into a structured JSON format 
    suitable for publishing on the website. Each article is grouped by its 'uri', and 
    various versions (like regular, conservative, liberal) are added with specific 
    metadata for each version.

    Parameters:
    - data_frame: A pandas DataFrame containing article metadata and multiple article versions.

    Returns:
    - A list of articles in JSON format, each with associated content versions and metadata.
    """

    try:
        df = data_frame.fillna('')

        # Initialize the list for all articles
        articles = []

        # Define the mapping for versionMetadata
        version_metadata_mapping = {
            'regular': {'complexity': 'regular', 'entertainment': 'regular', 'sentiment': 'regular', 'slant': 'regular', 'facts': 'regular'},
            'liberal': {'complexity': 'regular', 'entertainment': 'regular', 'sentiment': 'regular', 'slant': 'liberal', 'facts': 'regular'},
            'conservative': {'complexity': 'regular', 'entertainment': 'regular', 'sentiment': 'regular', 'slant': 'conservative', 'facts': 'regular'},
            'less_complex': {'complexity': 'less complex', 'entertainment': 'regular', 'sentiment': 'regular', 'slant': 'regular', 'facts': 'regular'},
            'more_positive': {'complexity': 'regular', 'entertainment': 'regular', 'sentiment': 'more positive', 'slant': 'regular', 'facts': 'regular'},
            'more_negative': {'complexity': 'regular', 'entertainment': 'regular', 'sentiment': 'more negative', 'slant': 'regular', 'facts': 'regular'},
            'entertaining': {'complexity': 'regular', 'entertainment': 'entertaining', 'sentiment': 'regular', 'slant': 'regular', 'facts': 'regular'},
            'facts_only': {'complexity': 'regular', 'entertainment': 'regular', 'sentiment': 'regular', 'slant': 'regular', 'facts': 'facts only'}
        }

        # Group the DataFrame by 'uri' to process each article separately
        grouped = df.groupby('uri')

        for uri, group in grouped:
            # Initialize the contentVersions list for the current article
            content_versions = []

            # Iterate over the rows in the group
            for index, row in group.iterrows():
                version = row['version']
                if version != 'original':  # Exclude the original version from contentVersions
                    version_metadata = version_metadata_mapping.get(version, {}).copy()
                    version_metadata['showVersion'] = row['showVersion']
                    version_metadata['tooltipVersion'] = row['tooltipVersion']

                    content_version = {
                        "body": row['body'] if not pd.isna(row['body']) else ".",
                        "description": row['lead'] if not pd.isna(row['lead']) else ".",
                        "title": row['title'] if not pd.isna(row['title']) else ".",
                        "push_title": row['push_title'] if not pd.isna(row['push_title']) else ".",
                        "push_body": row['push_body'] if not pd.isna(row['push_body']) else ".",
                        "versionMetadata": version_metadata
                    }
                    content_versions.append(content_version)

            # Construct the article metadata
            metadata = {
                "category": ast.literal_eval(str(group['category'].iloc[0])),
                "sub_category": ast.literal_eval(str(group['sub_category'].iloc[0])),
                "datetime": str(group['datetime'].iloc[0]),
                "id": str(group['uri'].iloc[0]),
                "imageUrl": str(group['imageUrl'].iloc[0]),
                "sentiment": float(group['sentiment_original_api'].iloc[0]),
                "sources": ast.literal_eval(str(group['sources'].iloc[0])),
                "tags": ast.literal_eval(str(group['tags'].iloc[0])),
                "titleUrl": str(group['slug'].iloc[0]),
                "trending": int(group['trendingRecency'].iloc[0]),
                "trendingScoreRaw": int(group['trendingScoreRaw'].iloc[0]),
                "readingTime": int(group['reading_time'].iloc[0]),
                "push": bool(group['push'].iloc[0]) 
            }

            # Construct the final structure for the current article
            article = {
                "contentVersions": content_versions,
                "metadata": metadata
            }

            # Append the current article to the articles list
            articles.append(article)

        return articles
    
    except Exception as e:
        logging.error(f"Error during JSON transformation: {e}")
        return []  # Return an empty list in case of failure