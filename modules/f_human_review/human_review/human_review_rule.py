def human_review_rule(customization_score, article):
    """
    Determines if a human review is necessary based on the customization score
    and whether the article mentions out-of-context phrases:
    - "former president donald trump" or "former president trump"
    - "president biden" or "president joe biden" without "former" prefix

    Parameters:
    - customization_score (int): The customization score of the article.
    - article (pd.DataFrame): DataFrame containing article data 
      (body, title, lead, etc.)

    Returns:
    - (bool): True if human review is required, False otherwise.
    """
    # 1) Check for out-of-context phrases
    out_of_context_phrase_found = False
    
    # Phrases to check
    trump_phrases = [
        "former president donald trump",
        "former president trump",
        "former u.s. president donald trump",
        "former u.s. president trump",
        "former us president donald trump",
        "former us president trump",
        "former president donald j. trump",
        "former president donald john trump",
        "former u.s. president donald j. trump",
        "former u.s. president donald john trump",
        "former us president donald j. trump",
        "former us president donald john trump",
        "former trump administration",
    ]
    biden_phrases = [
        "president biden",
        "president joe biden",
        "u.s. president biden",
        "u.s. president joe biden",
        "us president biden",
        "us president joe biden",
        "president joseph biden",
        "president joe r. biden",
        "u.s. president joseph biden",
        "u.s. president joe r. biden",
        "us president joseph biden",
        "us president joe r. biden",
        "biden administration",
    ]
    
    for col in ["body", "title", "lead"]:
        if col in article.columns:
            text = article[col].astype(str).str.lower()
            
            # Check for Trump phrases with "former"
            contains_trump = text.apply(lambda x: 
                any(phrase in x for phrase in trump_phrases)
            ).any()
            
            # Check for Biden phrases without "former"
            contains_biden = text.apply(lambda x: 
                any(phrase in x for phrase in biden_phrases) and 
                not any(f"former {phrase}" in x for phrase in biden_phrases)
            ).any()
            
            if contains_trump or contains_biden:
                out_of_context_phrase_found = True
                break

    # 2) Check if the customization score triggers a review
    score_based_review = (customization_score <= 1)

    # Return True if EITHER check is True
    return out_of_context_phrase_found or score_based_review