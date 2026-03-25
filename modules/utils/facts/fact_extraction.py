import json
import os
import string
# import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
import rank_bm25
import dspy
from config import gpt4o_facts, gpt4o
# import pydantic
# from typing import List, Dict
import spacy
from fastcoref import spacy_component
import re
from functools import lru_cache

# Load spaCy English model and add coreference resolution
nlp = spacy.load("en_core_web_sm")
nlp.add_pipe("fastcoref")

# Function to load demos (news article sentences labeled with facts)
def load_demonstrations(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)

# Function to create BM25 model (ranking function to estimate document relevance) from demos
def create_bm25_model(demonstrations):
    tokenized_corpus = [word_tokenize(doc) for doc in demonstrations.keys()]
    return rank_bm25.BM25Okapi(tokenized_corpus)

# Function to find top three matching demonstrations for a given sentence
def get_top_matches(bm25, demonstrations, input_sentence, top_n=3):
    tokenized_query = word_tokenize(input_sentence)
    doc_scores = bm25.get_scores(tokenized_query)
    top_indexes = sorted(range(len(doc_scores)), key=lambda i: doc_scores[i], reverse=True)[:top_n]
    return [(list(demonstrations.keys())[index], demonstrations[list(demonstrations.keys())[index]]) for index in top_indexes]

def normalize_answer(text):
    """Normalize text for comparison."""
    def remove_articles(text):
        regex = re.compile(r'\b(a|an|the)\b', re.UNICODE)
        return re.sub(regex, ' ', text)

    def white_space_fix(text):
        return ' '.join(text.split())

    def remove_punc(text):
        exclude = set(string.punctuation)
        return ''.join(ch for ch in text if ch not in exclude)

    return white_space_fix(remove_articles(remove_punc(text.lower())))

def extract_numeric_values(text):
    """Extract all numeric values from text."""
    pattern = r'\b\d+(?:[\.,]\d+)*\b'  # Matches integers and decimals with commas/periods
    return set(re.findall(pattern, text))

@lru_cache(maxsize=1000)
def detect_entities(text):
    """Detect entities from the text."""
    doc = nlp(text)
    entities = set()

    for ent in doc.ents:
        # Focus on relevant entity types
        if ent.label_ in ['PERSON', 'ORG', 'GPE', 'LOC', 'DATE', 'TIME', 'PERCENT', 'MONEY', 'QUANTITY', 'ORDINAL', 'CARDINAL']:
            entities.add(ent.text)

    # Add numeric values
    numeric_values = extract_numeric_values(text)
    entities.update(numeric_values)

    return entities

def postprocess_atomic_facts(facts_with_entities):
    """Postprocess atomic facts with quality controls."""
    # Weak endings that are not allowed (too vague for facts) unless explicitly permitted
    weak_endings = [
        # Generic communication verbs without additional context
        'said.', 'stated.', 'reported.', 'announced.', 'commented.', 'expressed.',
        'mentioned.', 'indicated.', 'noted.', 'added.',

        # Vague interaction verbs
        'met.', 'discussed.', 'talked.', 'gathered.', 'participated.',

        # Action verbs that need context
        'confirmed.', 'denied.', 'agreed.', 'supported.', 'opposed.', 'criticized.',

        # Vague descriptors or statuses
        'involved.', 'affected.', 'concerned.',

        # Ongoing status without specifics
        'ongoing.', 'underway.', 'continuing.', 'pending.', 'upcoming.',

        # Comparative terms without context
        'increased.', 'decreased.', 'improved.', 'declined.',

        # Vague temporal terms
        'recently.', 'currently.', 'soon.', 'eventually.',
    ]

    # Permitted endings are specific cases of weak endings that provide more context
    permitted_endings = [
        # Specific cases of communication verbs
        'said that.', 'stated that.', 'reported that.', 'announced that.',
        'commented on.', 'expressed that.', 'mentioned that.', 'indicated that.',
        'noted that.', 'added that.',

        # Specific cases of action verbs
        'confirmed that.', 'denied that.', 'agreed to.', 'supported the.',
        'opposed the.', 'criticized the.',

        # Specific cases of comparative terms
        'increased by.', 'decreased by.', 'improved by.', 'declined by.',
    ]

    processed_facts = []
    seen_facts = set()

    # First pass: handle single-word or very short sentences
    consolidated_facts = []
    for i, fact_entry in enumerate(facts_with_entities):
        sentence = fact_entry["sentence"].strip()
        facts = fact_entry["facts"]

        if len(sentence.split()) <= 3 and i > 0:
            # Combine with previous sentence
            consolidated_facts[-1]["sentence"] += ' ' + sentence
            consolidated_facts[-1]["facts"].extend(facts)
        else:
            consolidated_facts.append({
                "sentence": sentence,
                "facts": facts
            })

    for fact_entry in consolidated_facts:
        sentence = fact_entry["sentence"].strip()
        facts = fact_entry["facts"]
        refined_facts = []

        # Get entities from the original sentence
        sentence_entities = detect_entities(sentence)
        covered_entities = set()

        for fact_dict in facts:
            # Access the 'fact' key from the dictionary if needed
            fact = fact_dict["fact"] if isinstance(fact_dict, dict) else fact_dict
            normalized_fact = normalize_answer(fact)
            if any(normalized_fact == existing_fact or normalized_fact in existing_fact or existing_fact in normalized_fact for existing_fact in seen_facts):
                continue

            # Skip weak endings unless permitted
            if any(fact.endswith(end) for end in weak_endings) and \
               not any(fact.endswith(end) for end in permitted_endings):
                continue

            # Detect entities in the fact
            fact_entities = detect_entities(fact)
            new_entities = fact_entities - sentence_entities

            # Try to adjust the fact if it contains new entities
            if new_entities:
                adjusted = False
                for new_ent in new_entities:
                    # Try to find a matching entity from the sentence
                    for sent_ent in sentence_entities:
                        if sent_ent.startswith(new_ent) or new_ent.startswith(sent_ent):
                            fact = fact.replace(new_ent, sent_ent)
                            adjusted = True
                            break
                if not adjusted:
                    continue  # Skip the fact if it cannot be adjusted

            covered_entities |= fact_entities
            seen_facts.add(normalized_fact)
            refined_facts.append(fact)

        # Check if all entities from the sentence are covered
        if sentence_entities - covered_entities:
            # If not all entities are covered, retain the original facts
            refined_facts = [fact_dict["fact"] if isinstance(fact_dict, dict) else fact_dict for fact_dict in facts]

        if refined_facts:
            processed_facts.append({
                "sentence": sentence,
                "facts": refined_facts
            })

    return processed_facts

# Model for atomic fact extraction
class AtomicFactGenerator(dspy.Signature):
    """
    --TASK---
    You are given a sentence. Your task is to break the sentence down into a list of atomic facts.

    ---GUIDELINES---
    - An atomic fact is a sentence containing a single, objectively verifiable piece of information.
    - Each atomic fact in the outputted list should check a different piece of information.
    - Do not include direct quotes in the extracted facts. If the sentence contains a direct quote, exclude the quoted part from the facts.
    - Each atomic fact should be directly supported by the sentence.
    - Do not hallucinate: avoid introducing information not present in the sentence.
    - Use the examples to learn how to do this.
    """
    example_1: str = dspy.InputField(desc="Example sentence 1")
    example_2: str = dspy.InputField(desc="Example sentence 2")
    example_3: str = dspy.InputField(desc="Example sentence 3")
    sentence: str = dspy.InputField(desc="Sentence to extract facts from")
    atomic_facts: list[str] = dspy.OutputField()

# Add at module level (top of file)
DEMO_PATH = 'data/raw/demos/demo_sentences_new.json'

# Add at module level (top of file)
@lru_cache(maxsize=1)
def load_cached_demonstrations(demo_path=DEMO_PATH):
    return load_demonstrations(demo_path)

@lru_cache(maxsize=1)
def create_cached_bm25_model(demos=None):
    if demos is None:
        demos = load_cached_demonstrations()
    return create_bm25_model(demos)

# Function to extract atomic facts from an article
class extract_facts_from_article(dspy.Module):
    def __init__(self):
        super().__init__()
        self.extract_facts = dspy.Predict(AtomicFactGenerator)
        self.demos = load_demonstrations('data/raw/demos/demo_sentences_new.json')
        self.ranking = create_bm25_model(self.demos)

    def forward(self, article):
        # Resolve coreferences
        doc = nlp(article, component_cfg={"fastcoref": {'resolve_text': True}})
        resolved_article = doc._.resolved_text

        # Tokenize sentences
        sentences = sent_tokenize(resolved_article)
        print(sentences)

        extracted_facts = []

        for sentence in sentences:
            # Get top matches for the current sentence
            top_matches = get_top_matches(self.ranking, self.demos, sentence)

            # Extract atomic facts
            with dspy.context(lm=gpt4o_facts):
                extraction = self.extract_facts(
                    example_1=str(top_matches[0]),
                    example_2=str(top_matches[1]),
                    example_3=str(top_matches[2]),
                    sentence=sentence
                )

            # Detect entity for each individual fact
            facts_with_entities = []
            for fact in extraction.atomic_facts:
                entities = detect_entities(fact)
                facts_with_entities.append({
                    "fact": fact,
                    "entities": entities
                })

            # Add to extracted facts
            extracted_facts.append({
                "sentence": sentence,
                "facts": facts_with_entities
            })

        # Postprocess extracted facts
        extracted_facts = postprocess_atomic_facts(extracted_facts)

        # Simplify the output format
        simplified_facts = []
        for fact_group in extracted_facts:
            simplified_facts.extend(fact_group['facts'])

        return {
            "facts_with_entities": simplified_facts
        }
