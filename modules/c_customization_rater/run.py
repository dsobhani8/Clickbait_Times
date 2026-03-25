import json
import logging

from modules.c_customization_rater.prompts.customization_rater_prompt import customization_rater
from modules.c_customization_rater.prompts.sensitivity_info_prompt import sensitivity_explainer
from modules.c_customization_rater.rules.version_control_rules import (
    liberal_version, 
    conservative_version, 
    less_complex_version, 
    more_positive_version, 
    more_negative_version, 
    entertaining_version,
    facts_only_version
)

def version_control(original_article, category):
    """
    This function controls if article versions are to be shown and why some versions may not be shown.
    It depends on the rules set per version.
    
    Returns:
    - A dictionary containing the information for each version.
    """
    try:
        # Deserialize the category if it's a string
        if isinstance(category, str):
            try:
                category = json.loads(category)
            except json.JSONDecodeError as e:
                logging.error(f"Error deserializing category: {category}. Exception: {e}")
                category = []  # Default to empty list if deserialization fails

        # Validate category is a list after deserialization
        if not isinstance(category, list):
            logging.warning(f"Expected 'category' to be a list, but got {type(category)}. Defaulting to an empty list.")
            category = []

        # Compute the customization score and reasoning
        customization_output = customization_rater(article=original_article)
        customization_score = customization_output["score"]
        customization_reasoning = customization_output["reasoning"]

        # Compute sensitivity reasoning if needed
        sensitivity_reasoning = ""
        if customization_score < 5:
            try:
                sensitivity_reasoning = sensitivity_explainer(customization_reasoning=customization_reasoning).info
            except Exception as e:
                logging.error(f"Error in sensitivity_explainer: {e}")
                sensitivity_reasoning = "No sensitivity reasoning available."

        # Apply the rules for each version
        version_info = {
            'liberal': liberal_version(category),
            'conservative': conservative_version(category),
            'less_complex': less_complex_version(),
            'more_positive': more_positive_version(customization_score, sensitivity_reasoning),
            'more_negative': more_negative_version(),
            'entertaining': entertaining_version(customization_score, sensitivity_reasoning),
            'facts_only': facts_only_version()
        }

        return version_info, customization_score

    except Exception as e:
        logging.error(f"Error in version_control: {e}")
        return {}, 0  # Return an empty dictionary and a score of 0 on error
