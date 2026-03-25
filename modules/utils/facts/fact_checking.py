from sentence_transformers import SentenceTransformer, util

# Load a model optimized for semantic similarity
model = SentenceTransformer('all-MiniLM-L6-v2')

# Threshold for fact matching with cosine similarity
threshold = 0.75

# Function to compare facts from two lists with cosine similarity
def compare_facts(facts1, facts2, model=model, threshold=threshold):
    embeddings1 = model.encode(facts1, convert_to_tensor=True)
    embeddings2 = model.encode(facts2, convert_to_tensor=True)
    
    # Compute cosine similarities
    similarity_matrix = util.pytorch_cos_sim(embeddings1, embeddings2)
    
    unmatched_facts1 = set(facts1)
    unmatched_facts2 = set(facts2)

    # Iterate over the similarity matrix to find matches
    for i in range(len(facts1)):
        for j in range(len(facts2)):
            if similarity_matrix[i][j].item() > threshold:
                unmatched_facts1.discard(facts1[i])
                unmatched_facts2.discard(facts2[j])
                break  # Break here to stop checking once a match is found for fact1[i]

    return {
        "unmatched_facts_original": list(unmatched_facts1),
        "unmatched_facts_new": list(unmatched_facts2)
    }