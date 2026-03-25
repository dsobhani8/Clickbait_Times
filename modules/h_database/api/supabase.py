import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Fetch the Supabase URL and key from the environment
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Initialize the Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Set the JSON as rows in two supabase tables: articles_metadata and article_versions; set testing_mode to False when pushing to production
def setSupabase_with_key(article_json, article_key, testing_mode):
    """
    Inserts article metadata and content versions into Supabase tables: articles_metadata and articles_versions.

    This function does the following:
    - Extracts metadata and content versions from the given article JSON.
    - Inserts the metadata into the `articles_metadata` table and the content versions into the `articles_versions` table in Supabase.
    - Uses the same `articleKey` to relate the metadata and content versions.
    
    Parameters:
    - article_json: The article's JSON data with metadata and content versions.
    - article_key: The unique key (articleKey) used to store the article.

    Returns:
    - A tuple containing the article's URI and article_key for reference.
    - In case of an error, returns an error message and None.
    """
    try:
        # Extract metadata and content versions
        metadata = article_json["metadata"]
        content_versions = article_json["contentVersions"]

        # Prepare the metadata for insertion
        articles_metadata = {
            "articleKey": article_key,  # Use the predefined articleKey
            "datetime": metadata["datetime"],
            "category": metadata["category"],
            "sub_category": metadata["sub_category"],
            "uri": metadata["id"],
            "imageUrl": metadata["imageUrl"],
            "readingTime": metadata["readingTime"],
            "sentiment": metadata["sentiment"],
            "sources": metadata["sources"],
            "tags": metadata["tags"],
            "titleUrl": metadata["titleUrl"],
            "trending": metadata["trending"],
            "trendingScoreRaw": metadata["trendingScoreRaw"],
            "push": metadata["push"]
        }

        # Insert the metadata into Supabase
        # For testing purposes, we use the table 'articles_metadata_test'
        metadata_table_name = 'articles_metadata_test' if testing_mode else 'articles_metadata'
        metadata_response = supabase.table(metadata_table_name).insert(articles_metadata).execute()

        if not metadata_response.data:
            raise Exception("Failed to insert metadata:", metadata_response.error)

        # Prepare and insert each version into Supabase
        articles_versions = []
        for version in content_versions:
            articles_versions.append({
                "articleKey": article_key,  # Use the predefined articleKey
                "versionMetadata": version["versionMetadata"],
                "title": version["title"],
                "description": version["description"],
                "body": version["body"],
                "push_title": version["push_title"],
                "push_body": version["push_body"]
            })

        # For testing purposes, we use the table 'articles_versions_test'
        versions_table_name = 'articles_versions_test' if testing_mode else 'articles_versions'
        versions_response = supabase.table(versions_table_name).insert(articles_versions).execute()

        if not versions_response.data:
            raise Exception("Failed to insert versions:", versions_response.error)

        # Return the URI and article key for reference
        return articles_metadata["uri"], article_key

    except Exception as error:
        print("Error inserting into Supabase:", error)
        return str(error), None