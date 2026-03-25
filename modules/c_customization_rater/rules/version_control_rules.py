def liberal_version(category):
    if 'Sports' in category:
        return {'showVersion': 'yes', 'tooltipVersion': 'For sports articles political leaning cannot be customized.'}
    if 'Lifestyle' in category:
        return {'showVersion': 'yes', 'tooltipVersion': 'For lifestyle articles political leaning cannot be customized.'}
    return {'showVersion': 'no', 'tooltipVersion': ''}

def conservative_version(category):
    if 'Sports' in category:
        return {'showVersion': 'yes', 'tooltipVersion': 'For sports articles political leaning cannot be customized.'}
    if 'Lifestyle' in category:
        return {'showVersion': 'yes', 'tooltipVersion': 'For lifestyle articles political leaning cannot be customized.'}
    return {'showVersion': 'no', 'tooltipVersion': ''}

def less_complex_version():
    return {'showVersion': 'no', 'tooltipVersion': ''}

def more_positive_version(customization_score, sensitivity_reasoning):
    if customization_score < 5:
        tooltipVersionMorePositive = sensitivity_reasoning
        return {'showVersion': 'yes', 'tooltipVersion': f'{tooltipVersionMorePositive} Therefore, no more positive version is available.'}
    return {'showVersion': 'no', 'tooltipVersion': ''}

def more_negative_version():
    return {'showVersion': 'no', 'tooltipVersion': ''}

def entertaining_version(customization_score, sensitivity_reasoning):
    if customization_score < 5:
        tooltipVersionEntertaining = sensitivity_reasoning
        return {'showVersion': 'yes', 'tooltipVersion': f'{tooltipVersionEntertaining} Therefore, no entertaining version is available.'}
    return {'showVersion': 'no', 'tooltipVersion': ''}

def facts_only_version():
    return {'showVersion': 'no', 'tooltipVersion': ''}