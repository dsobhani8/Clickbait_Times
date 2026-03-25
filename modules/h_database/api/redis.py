import json
from upstash_redis import Redis

redis = Redis.from_env()

def setRedis_with_key(article_json, article_key, expiration_seconds=259200): # In seconds; 259200 = 3 days
    """
    Stores an article in Redis with expiration and sorted set management.

    This function performs the following tasks:
    - Stores the article JSON in Redis with an expiration time (default is 3 days).
    - Adds the article key to a general sorted set and category-specific sorted sets, 
      sorted by a "trending score" extracted from the article's metadata.
    - Optionally manages a set for tracking article keys.
    - Cleans up expired or missing keys from Redis sorted sets.

    Parameters:
    - article_json: The article data in JSON format (with metadata, trending score, etc.).
    - article_key: The unique key to store the article under in Redis.
    - expiration_seconds: Time in seconds for how long the article should stay in Redis before expiring (default is 259200 seconds = 3 days).

    Returns:
    - A tuple with the article ID (if present in metadata) and the article_key.
    - In case of an error, returns an error message and None
    """
    try:
        # Get the trending score from the metadata
        trending_score = article_json["metadata"]["trending"]

        # Populate article_key and article JSON in regular Redis SET
        redis.set(
            article_key,
            json.dumps({"articleKey": article_key, "article": article_json})
        )

        # Set expiration for the article key (in seconds)
        redis.expire(article_key, expiration_seconds)

        # Cleanup function to remove expired or missing keys from ZSETs
        def cleanup_zset(zset_name):
            # Get all members of the ZSET
            zset_members = redis.zrange(zset_name, 0, -1)
            for member in zset_members:
                if not redis.exists(member):  # Check if the key still exists
                    redis.zrem(zset_name, member)  # Remove the key from the ZSET

        # Perform cleanup on the general sorted set
        cleanup_zset("articles_sorted")

        # Add the article_key to the general sorted set with the trending score as the score
        redis.zadd("articles_sorted", {article_key: trending_score})

        # Add the article_key to category-specific sorted sets
        categories = article_json["metadata"]["category"]
        for category in categories:
            category_zset = f"articles_sorted_{category.lower()}"
            cleanup_zset(category_zset)  # Perform cleanup on the category-specific ZSET
            redis.zadd(category_zset, {article_key: trending_score})

        # Populate article_keys set for managing keys (optional)
        redis.sadd("article_keys", article_key)

        # Return id and article_key if id is in article_json metadata
        if 'metadata' in article_json and 'id' in article_json['metadata']:
            return article_json['metadata']['id'], article_key
        else:
            return None, article_key
    except Exception as error:
        print("error", error)
        return str(error), None