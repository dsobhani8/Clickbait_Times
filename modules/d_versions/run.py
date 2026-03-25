import logging

from modules.d_versions.conservative.run import conservative_version
from modules.d_versions.entertaining.run import entertaining_version
from modules.d_versions.less_complex.run import less_complex_version
from modules.d_versions.more_negative.run import more_negative_version
from modules.d_versions.more_positive.run import more_positive_version
from modules.d_versions.liberal.run import liberal_version
from modules.d_versions.facts_only.run import facts_only_version

def generate_all_versions(regular_article, regular_facts, version_info, push):
    """
    Generate all versions of the article based on the regular article.
    """
    try:
        conservative = conservative_version(regular_article, regular_facts, version_info, push)
        entertaining = entertaining_version(regular_article, regular_facts, version_info, push)
        less_complex = less_complex_version(regular_article, regular_facts, version_info, push)
        more_negative = more_negative_version(regular_article, regular_facts, version_info, push)
        more_positive = more_positive_version(regular_article, regular_facts, version_info, push)
        liberal = liberal_version(regular_article, regular_facts, version_info, push)
        facts_only = facts_only_version(regular_article, regular_facts, version_info, push)

        return {
            'conservative': conservative,
            'entertaining': entertaining,
            'less_complex': less_complex,
            'more_negative': more_negative,
            'more_positive': more_positive,
            'liberal': liberal,
            'facts_only': facts_only
        }

    except Exception as e:
        logging.error(f"Error generating all versions: {e}")
        return {}