import re

test_text = "This is a test text for reading time estimation. It is a simple text with no special characters."

def estimate_reading_time(article, wpm=180): # Default reading speed is 180 words per minute
    # Remove special characters and split the text by whitespace to count words
    words = re.findall(r'\w+', article)
    word_count = len(words)
    
    # Calculate the reading time
    reading_time = word_count / wpm
    
    # Ensure the reading time is at least 1 minute
    return max(1, round(reading_time))

print(estimate_reading_time(test_text))