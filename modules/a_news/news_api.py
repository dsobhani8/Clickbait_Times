import pandas as pd
from eventregistry import EventRegistry, QueryArticlesIter, ReturnInfo, ArticleInfoFlags, ConceptInfoFlags
from modules.a_news.news_config import NEWS_API_KEY

def initialize_event_registry():
    er = EventRegistry(apiKey=NEWS_API_KEY)
    return er

def get_articles_from_source(date: str, source: str, er):
    q = QueryArticlesIter(
        sourceUri=er.getNewsSourceUri(source),
        dateStart=date, dateEnd=date,
        lang="eng",
        dataType="news",
    )

    res = q.execQuery(
        er,
        sortBy="date",
        maxItems=1000,
        returnInfo=ReturnInfo(
            articleInfo=ArticleInfoFlags(location=True, categories=True, storyUri=True, socialScore=True, originalArticle=True, concepts=True),
            conceptInfo=ConceptInfoFlags(label=True, trendingScore=True),
        )
    )
    article_list = [i for i in res]
    df_articles = pd.DataFrame(article_list)
    df_articles['source'] = source

    return df_articles
