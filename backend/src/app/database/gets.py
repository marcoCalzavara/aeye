import time
from typing import List

import torch
from pymilvus import Collection

from ...CONSTANTS import *
from ...db_utilities.collections import EMBEDDING_VECTOR_FIELD_NAME, ZOOM_LEVEL_VECTOR_FIELD_NAME


# Create decorator for timing functions
def timeit(func):
    """
    Decorator for timing functions.
    @param func:
    @return:
    """
    def wrapper(*args, **kwargs):
        """
        Wrapper for timing functions.
        @param args:
        @param kwargs:
        @return:
        """
        start = time.time()
        result = func(*args, **kwargs)
        end = time.time()
        print(f"Function {func.__name__} took {(end - start) * 1000} milliseconds.")
        return result
    return wrapper


@timeit
def get_image_info_from_text_embedding(collection: Collection, text_embeddings: torch.Tensor) -> str:
    """
    Get the image embedding from the collection for a given text.
    @param collection:
    @param text_embeddings:
    @return:
    """
    # Define search parameters
    search_params = {
        "metric_type": COSINE_METRIC,
        "offset": 0
    }
    # Search image
    results = collection.search(
        data=text_embeddings.tolist(),
        anns_field=EMBEDDING_VECTOR_FIELD_NAME,
        param=search_params,
        limit=1,
        output_fields=["index", "author", "path", "width", "height",
                       "low_dimensional_embedding_x", "low_dimensional_embedding_y"]
    )
    # Return image path
    return results[0][0].to_dict()["entity"]


@timeit
def get_tiles(indexes: List[int], collection: Collection) -> dict:
    """
    Get tiles from their indexes.
    @param indexes:
    @param collection:
    @return:
    """
    # Search image
    result = collection.query(
        expr=f"index in {indexes}",
        output_fields=["index", "entities", "range"]
    )
    # The returned data is a list of entities.

    return result


@timeit
def get_tile_from_image(index: int, collection: Collection) -> dict:
    """
    Get the tile data from the collection for a given image.
    @param index:
    @param collection:
    @return:
    """
    # Search image
    results = collection.query(
        expr=f"index in [{index}]",
        output_fields=["*"]
    )
    # The returned data point has the following format:
    # {
    #     "index": image_index,
    #     "zoom_plus_tile": [zoom_level, tile_x, tile_y]
    # }
    # Transform results[0][ZOOM_LEVEL_VECTOR_FIELD_NAME] to a list of integers
    if len(results) > 0:
        results[0][ZOOM_LEVEL_VECTOR_FIELD_NAME] = [int(x) for x in results[0][ZOOM_LEVEL_VECTOR_FIELD_NAME]]
        return results[0]
    else:
        return {}


@timeit
def get_paths_from_indexes(indexes: List[int], collection: Collection) -> dict:
    """
    Get images from their indexes.
    @param indexes:
    @param collection:
    @return:
    """
    # Search image
    results = collection.query(
        expr=f"index in {indexes}",
        output_fields=["path"]
    )

    # Return results
    return results


@timeit
def get_neighbors(index: int, collection: Collection, top_k: int) -> List[dict]:
    """
    Get the neighbors of a given image.
    @param index:
    @param collection:
    @param top_k:
    @return:
    """
    # First, query the index to find the embedding vector
    results = collection.query(
        expr=f"index in [{index}]",
        output_fields=[EMBEDDING_VECTOR_FIELD_NAME]
    )

    # Define search parameters
    search_params = {
        "metric_type": COSINE_METRIC
    }
    # Search image
    results = collection.search(
        data=[results[0][EMBEDDING_VECTOR_FIELD_NAME]],
        anns_field=EMBEDDING_VECTOR_FIELD_NAME,
        param=search_params,
        limit=top_k,
        output_fields=["index", "author", "path", "width", "height", "genre", "date", "title"]
    )
    # Return results
    return [hit.to_dict()["entity"] for hit in results[0]]


@timeit
def get_first_tiles(collection: Collection) -> List[dict]:
    """
    Get tiles from first 7 zoom levels.
    @param collection:
    @return:
    """
    # Define limit on number of entities
    limit = min(collection.num_entities, 21845)
    results = []
    i = 0
    while i < limit:
        search_limit = min(16384, limit - i)
        # Search image
        results += collection.query(
            expr=f"index in {list(range(i, i + search_limit))}",
            output_fields=["*"],
            limit=search_limit
        )
        i += 16384

    # Convert all float values to int
    if len(results) > 0:
        for result in results:
            result[ZOOM_LEVEL_VECTOR_FIELD_NAME] = [int(x) for x in result[ZOOM_LEVEL_VECTOR_FIELD_NAME]]

    print(f"Number of entities: {len(results)}")
    # Return results
    return results
