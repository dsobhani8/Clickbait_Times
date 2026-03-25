import pandas as pd

def transform_results_to_df(results):
    """
    This function takes in the rewriting results and transforms them into a data frame to make human review easier.
    """
    # Extract metadata
    metadata = results['metadata']
    
    # Initialize a list to store each row's data
    rows = []

    # Ensure that any list in the metadata is converted to a string format
    metadata = {key: str(value) if isinstance(value, list) else value for key, value in metadata.items()}
    
    # Loop over the different versions in the results (original, regular, conservative, etc.)
    for version, version_data in results.items():
        if version == 'metadata':  # Skip the metadata key, since we are already using it
            continue
        
        # Ensure that version-specific fields that might be lists are also converted to strings
        version_data = {key: str(value) if isinstance(value, list) else value for key, value in version_data.items()}
        
        # Combine metadata with version-specific fields
        row_data = {**metadata, 'version': version}
        row_data.update({
            'title': version_data.get('title', ''),
            'lead': version_data.get('lead', ''),
            'body': version_data.get('body', ''),
            'sentences': version_data.get('sentences', ''),
            'facts': str(version_data.get('facts', '')),  # Ensure facts are stored as strings
            'showVersion': version_data.get('showVersion', ''),
            'tooltipVersion': version_data.get('tooltipVersion', ''),
            'push_title': version_data.get('push_title', ''),
            'push_body': version_data.get('push_body', '')
        })
        rows.append(row_data)
    
    # Convert the list of rows into a DataFrame
    df = pd.DataFrame(rows)
    
    # Remove any potential duplicate rows (in case of redundancy)
    df.drop_duplicates(inplace=True)
    
    return df