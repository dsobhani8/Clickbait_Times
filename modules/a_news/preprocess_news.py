import pandas as pd
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from modules.a_news.news_config import UPDATE_FREQUENCY
from modules.a_news.news_api import get_articles_from_source
from modules.a_news.news_categorization import category_assessor

def get_cat_llm_single(article):
    category = category_assessor()(article=article)["category"]
    tag = category_assessor()(article=article)["tag"]
    return category, tag

def get_cat_llm(df_articles, num_threads=19):
    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        results = list(executor.map(get_cat_llm_single, df_articles['body']))
    categories, tags = zip(*results)
    df_articles['llm_category'] = categories
    df_articles['llm_subcategory'] = tags
    return df_articles


def get_trending_score(concepts, select_concepts='all', value='trendingScore', method='wgt_avg'):
    if concepts:
        if value == 'trendingScore':
            concept_scores = [(i['score'], i['trendingScore']['news']['score']) for i in concepts]
        elif value == 'past2days':
            concept_scores = [(i['score'], i['trendingScore']['news']['testPopFq']) for i in concepts]
        elif value == "past14days":
            concept_scores = [(i['score'], i['trendingScore']['news']['nullPopFq']) for i in concepts]
        else:
            raise ValueError('Value not recognized')

        if select_concepts == 'max':
            max_score = max([i[0] for i in concept_scores])
            concept_scores = [i for i in concept_scores if i[0] == max_score]

        if method == "max":
            trending_score = max([i[1] for i in concept_scores])
        elif method == "wgt_avg":
            trending_score = sum([i * j for i, j in concept_scores]) / sum([i[0] for i in concept_scores])
        else:
            raise ValueError('Method not recognized')

        return trending_score
    else:
        return None

def get_shares(shares):
    if shares:
        total_shares = sum(shares.values())
        return total_shares
    else:
        return 0

def retrieve_articles(source, er):
    date_today = pd.Timestamp.now().strftime('%Y-%m-%d')
    df_articles = get_articles_from_source(date_today, source, er)
    return df_articles

def filter_past_hour(df_articles):
    one_hour_ago = pd.Timestamp.now(tz='UTC') - pd.Timedelta(hours=UPDATE_FREQUENCY)
    df_articles['datetime_formatted'] = pd.to_datetime(df_articles['dateTimePub'], utc=True)
    df_articles = df_articles[df_articles['datetime_formatted'] >= one_hour_ago]
    df_articles = df_articles.drop(columns=['datetime_formatted'])
    return df_articles

def filter_articles_by_type(df_articles):
    return df_articles[df_articles['url'].str.startswith('https://apnews.com/article/')]

def filter_articles_by_length(df_articles, min_words, max_words):
    df_articles['body_length_characters'] = df_articles['body'].str.len()
    df_articles['body_length_words'] = df_articles['body'].str.split().str.len()
    df_articles = df_articles[(df_articles['body_length_words'] >= min_words)
                              & (df_articles['body_length_words'] <= max_words)]
    return df_articles

def exclude_non_standard_articles(df_articles):
    exclude_list = ['today in history', 'the latest |', 'this week:', 'ap ', 'Stock market today', " ap ",
                    'Photo Gallery', 'FACT FOCUS:', 'Book Review:', 'Closing prices for', 'Music Review:', 'The Latest:']
    for exclude in exclude_list:
        df_articles = df_articles[~df_articles['title'].str.lower().str.startswith(exclude)]
    df_articles = df_articles[~df_articles['title'].str.contains(r'\d{1,2}/\d{1,2}/\d{4}', na=False)]
    return df_articles

def exclude_articles_by_image(df_articles, image_url): # exclude articles with placeholder image to not show articles without image on site
    df_articles = df_articles[df_articles['image'] != image_url]
    return df_articles

def replace_image_url(df_articles, image_url): # replace placeholder image with empty string to also show articles with noe images on site
    df_articles['image'] = df_articles['image'].replace(image_url, "")
    return df_articles

def select_top_trending_articles(df_articles, articles_per_day):
    df_articles['trending_score'] = df_articles['concepts'].apply(get_trending_score,
                                                                  select_concepts='max',
                                                                  value='past2days', method='max')
    
    # Use the first element of llm_category lists for sorting and grouping
    df_articles['llm_category_first'] = df_articles['llm_category'].apply(lambda x: x[0] if isinstance(x, list) and x else None)
    
    df_articles = df_articles.sort_values(['date', 'llm_category_first', 'trending_score'],
                                          ascending=[True, True, False])
    df_articles = df_articles.groupby(['date', 'llm_category_first']).head(articles_per_day)
    return df_articles

def replace_apnews_with_associated_press(df_articles):
    df_articles['source'] = df_articles['source'].replace('apnews.com', 'Associated Press')
    return df_articles

def increment_duplicate_trending_scores(df_articles):
    df_articles['trending_score'] = df_articles['trending_score'].astype(float)
    df_articles = df_articles.sort_values(['trending_score', 'dateTimePub'], ascending=[True, False])

    while df_articles.duplicated('trending_score', keep=False).any():
        df_articles.loc[df_articles.duplicated('trending_score', keep='first'), 'trending_score'] += 0.1

    return df_articles

def add_trending_recency(df_articles):
    current_datetime = datetime.now().strftime('%y%m%d%H%M')
    df_articles['trending_score_rank'] = df_articles['trending_score'].rank(method='min', ascending=True) + 9
    df_articles['trendingRecency'] = current_datetime + df_articles['trending_score_rank'].astype(int).astype(str)
    df_articles['trendingRecency'] = pd.to_numeric(df_articles['trendingRecency'])
    return df_articles