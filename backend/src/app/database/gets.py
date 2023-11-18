from typing import List

import torch
from pymilvus import Collection

from ...CONSTANTS import *
from ...db_utilities.collections import EMBEDDING_VECTOR_FIELD_NAME, ZOOM_LEVEL_VECTOR_FIELD_NAME


def get_image_embedding_from_text_embedding(collection: Collection, text_embeddings: torch.Tensor) -> str:
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
        output_fields=["path"]
    )
    # Return image path
    return results[0][0].entity.get("path")


def get_tile_data_for_zoom_level(zoom_level: int, tile_x: int, tile_y: int, collection: Collection) -> dict:
    """
    Get the data for a tile at a specific zoom level from the collection.
    @param zoom_level:
    @param tile_x:
    @param tile_y:
    @param collection:
    @return:
    """
    # Define search parameters
    search_params = {
        "metric_type": L2_METRIC,
        "offset": 0
    }
    # Search image
    results = collection.search(
        data=[[zoom_level, tile_x, tile_y]],
        anns_field=ZOOM_LEVEL_VECTOR_FIELD_NAME,
        param=search_params,
        limit=1,
        output_fields=["images", ZOOM_LEVEL_VECTOR_FIELD_NAME]
    )
    # The returned data point has the following format:
    # {
    #     "index": id_of_image,
    #     "zoom_plus_tile": [zoom_level, tile_x, tile_y],
    #     "images": {
    #         "indexes": [id_1, id_2, ...],
    #         "x_cell": [x_1, x_2, ...],
    #         "y_cell": [y_1, y_2, ...],
    #     }
    # }

    return results[0][0].entity.to_dict()


def get_images_from_indexes(indexes: List[int], collection: Collection) -> dict:
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
