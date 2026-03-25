import pandas as pd

def get_cat(cat, type):
    cat = [i for i in cat if i['uri'].startswith(f'{type}')]
    if len(cat) > 0:
        cat_main = [{'uri': i['uri'].split('/')[1], 'wgt': i['wgt']} for i in cat]
        cat_sum = {uri: sum(i['wgt'] for i in cat_main if i['uri'] == uri) for uri in set(i['uri'] for i in cat_main)}
        cat_sum_sorted = sorted(cat_sum.items(), key=lambda x: x[1], reverse=True)
        label = cat_sum_sorted[0][0]
        return label
    else:
        return None

def body_othercountry(body, countries, cities):
    other_countries = [i['name'] for i in countries.values() if i['name'] != "United States"]
    other_cities = [i['name'] for i in cities.values() if i['countrycode'] != "US" and i['population'] > 250000]
    other_countries_cities = [f" {i} " for i in other_countries + other_cities]
    body_location = body[0:100]

    if ' -- ' in body_location:
        body_location = body_location.split(' -- ')[0]
        body_location = ' ' + body_location.replace(',', '') + ' '
        other_country = any_substring_in_string(body_location, other_countries_cities, case_sensitive=False)
        return other_country
    else:
        return None

def any_substring_in_string(string, substrings, case_sensitive=True):
    if case_sensitive:
        return any(substring in string for substring in substrings)
    else:
        return any(substring.lower() in string.lower() for substring in substrings)

def api_location(location):
    if location is not None:
        if 'country' in location:
            country = location['country']['label']['eng']
            return country
        else:
            return None
    else:
        return None

def determine_if_us(df_articles, keywords, countries, cities):
    api_US = df_articles['location'].apply(lambda x: api_location(x) == "United States")
    body_othercountry = df_articles['body'].apply(lambda x: body_othercountry(x, countries=countries, cities=cities))
    body_US_keywords_upper = df_articles['body'].apply(
        lambda x: any_substring_in_string(string=x, substrings=keywords["us_upper"], case_sensitive=True))
    body_US_keyword = df_articles['body'].apply(
        lambda x: any_substring_in_string(string=x,
                                          substrings=keywords["us"] + keywords["us_states"] + keywords["us_counties"] +
                                                     keywords["us_cities"],
                                          case_sensitive=False))

    US = ((api_US == True) | ((api_US == False) & (body_othercountry != True))) & (
                body_US_keywords_upper | body_US_keyword)

    return US

def categorize_articles(df_articles, keywords, cities, countries):
    df_articles['category_news'] = df_articles['categories'].apply(lambda x: get_cat(x, 'news'))
    df_articles['category_dmoz'] = df_articles['categories'].apply(lambda x: get_cat(x, 'dmoz'))
    df_articles['api_US'] = df_articles['location'].apply(lambda x: api_location(x) == "United States")
    df_articles['body_othercountry'] = df_articles['body'].apply(body_othercountry, countries=countries,
                                                                 cities=cities)
    df_articles['body_US_keywords_upper'] = df_articles['body'].apply(
        lambda x: any_substring_in_string(string=x, substrings=keywords["us_upper"], case_sensitive=True))
    df_articles['body_US_keyword'] = df_articles['body'].apply(
        lambda x: any_substring_in_string(string=x,
                                          substrings=keywords["us"] + keywords["us_states"] + keywords["us_counties"] +
                                                     keywords["us_cities"],
                                          case_sensitive=False))

    df_articles['US'] = ((df_articles['api_US'] == True) | (
            (df_articles['api_US'] == False) & (df_articles['body_othercountry'] != True))) & (
                                df_articles['body_US_keywords_upper'] | df_articles['body_US_keyword'])

    df_articles['sections'] = [[] for _ in range(len(df_articles))]
    df_articles['sections'] = df_articles.apply(
        lambda row: row['sections'] + ['Politics'] if row['category_news'] == 'Politics' else row['sections'],
        axis=1
    )
    df_articles['sections'] = df_articles.apply(
        lambda row: row['sections'] + ['Economy'] if row['category_news'] == 'Business' and row['category_dmoz'] in [
            'Business', 'Society', 'Home'] and any_substring_in_string(row['body'], keywords['economy'],
                                                                       case_sensitive=False) else row['sections'],
        axis=1
    )
    df_articles['sections'] = df_articles.apply(
        lambda row: row['sections'] + ['Sports'] if row['category_news'] == 'Sports' else row['sections'],
        axis=1
    )
    df_articles['sections'] = df_articles.apply(
        lambda row: row['sections'] + ['Lifestyle'] if row['category_news'] == 'Art_and_Entertainment' else row[
            'sections'],
        axis=1
    )
    df_articles['sections'] = df_articles.apply(
        lambda row: row['sections'] + ['Election'] if row['category_news'] == 'Politics' and any_substring_in_string(
            row['body'], keywords['election'], case_sensitive=False) else row['sections'],
        axis=1
    )
    df_articles['sections'] = df_articles.apply(
        lambda row: ['International'] if row['US'] == False else row['sections'],
        axis=1
    )

    return df_articles
