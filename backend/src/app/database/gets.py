from ...CONSTANTS import *
from ...model.CLIPEmbeddings import ClipEmbeddings


def get_image_embeddings_from_text(embeddings: ClipEmbeddings, text, collection):
    # Generate text embeddings
    text_embeddings = embeddings.getTextEmbeddings(text)
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
