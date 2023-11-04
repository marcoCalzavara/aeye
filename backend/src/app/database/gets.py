from pymilvus import Collection
from src.model.CLIPEmbeddings import ClipEmbeddings
from src.CONSTANTS import *


def get_image_embeddings(embeddings: ClipEmbeddings, text, collection_name):
    # Generate text embeddings
    text_embeddings = embeddings.getTextEmbeddings(text)
    collection = Collection(collection_name)
    # Define search parameters
    search_params = {
        "metric_type": METRIC,
        "offset": 0
    }
    # Search image
    results = collection.search(
        data=text_embeddings.tolist(),
        anns_field="embedding",
        param=search_params,
        limit=1
    )

    return results[0]["index"]
