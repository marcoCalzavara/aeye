from typing import List

import torch
from pymilvus import Collection

from ...CONSTANTS import *
from ...db_utilities.collections import EMBEDDING_VECTOR_FIELD_NAME, ZOOM_LEVEL_VECTOR_FIELD_NAME


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


def get_grid_data(zoom_level: int, tile_x: int, tile_y: int, collection: Collection) -> dict:
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

    return results[0][0].to_dict()


def get_map_data(zoom_level: int, image_x: int, image_y: int, collection: Collection) -> dict:
    """
    Get the data for a zoom level from the collection.
    @param zoom_level:
    @param image_x:
    @param image_y:
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
        data=[[zoom_level, image_x, image_y]],
        anns_field=ZOOM_LEVEL_VECTOR_FIELD_NAME,
        param=search_params,
        limit=1,
        output_fields=["images", "path_to_image", ZOOM_LEVEL_VECTOR_FIELD_NAME]
    )
    # The returned data point has the following format:
    # {
    #     "index": id_of_image,
    #     "zoom_plus_tile": [zoom_level, tile_x, tile_y],
    #     "images": {
    #         "has_info": bool,
    #         ?"artwork_width": artwork_width,
    #         ?"artwork_height": artwork_height,
    #         ?"images": [id_1, id_2, ...],
    #         ?"x_cell": [x_1, x_2, ...],
    #         ?"y_cell": [y_1, y_2, ...]
    #     }
    # }

    return results[0][0].to_dict()


def get_clusters_data(zoom_level: int, tile_x: int, tile_y: int, collection: Collection) -> dict:
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
        output_fields=["*"]
    )
    # The returned data point has the following format:
    # {
    #     "index": id,
    #     "zoom_plus_tile": [zoom_level, tile_x, tile_y],
    #     "clusters_representatives": {
    #        "entities": [e1, e2, ...],
    #     },
    #     "tile_coordinate_range": {
    #         max_x: max_x,
    #         min_x: min_x,
    #         max_y: max_y,
    #         min_y: min_y
    #     }
    # }

    return results[0][0].to_dict()


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
        output_fields=["index", "author", "path", "width", "height"]
    )
    # Return results
    return [hit.to_dict()["entity"] for hit in results[0]]
