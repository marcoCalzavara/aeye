import contextlib
import io
from enum import Enum

from ...CONSTANTS import *
from ...model.CLIPEmbeddings import ClipEmbeddings
import deeplake


class Datasets(Enum):
    with contextlib.redirect_stdout(io.StringIO()):
        WIKIART_DS = {"name": "wikiart", "dataset": deeplake.load(WIKIART)}


def get_dataset(collection_name: str):
    # Get dataset
    return Datasets[collection_name.upper() + "_DS"].value["dataset"]


def get_image_embeddings_from_text(embeddings: ClipEmbeddings, text, collection, collection_name):
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
    # TODO: return only the index
    # return results[0]["index"]
    return get_dataset(collection_name)[results[0]["index"]]["images"].data()["value"]
