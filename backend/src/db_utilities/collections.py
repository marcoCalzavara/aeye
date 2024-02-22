import numpy as np
from pymilvus import CollectionSchema, FieldSchema, DataType, Collection

from ..CONSTANTS import *

EMBEDDING_VECTOR_FIELD_NAME = "embedding"
ZOOM_LEVEL_VECTOR_FIELD_NAME = "zoom_plus_tile"


def embeddings_collection(collection_name: str):
    # Create fields for collection
    index = FieldSchema(
        name="index",
        dtype=DataType.INT64,
        is_primary=True
    )
    low_dim_embeddings_x = FieldSchema(
        name="low_dimensional_embedding_x",
        dtype=DataType.FLOAT,
        default_value=np.nan
    )
    low_dim_embeddings_y = FieldSchema(
        name="low_dimensional_embedding_y",
        dtype=DataType.FLOAT,
        default_value=np.nan
    )
    embedding = FieldSchema(
        name=EMBEDDING_VECTOR_FIELD_NAME,
        dtype=DataType.FLOAT_VECTOR,
        dim=512
    )

    # Create collection schema
    schema = CollectionSchema(
        fields=[embedding, low_dim_embeddings_x, low_dim_embeddings_y, index],
        description="data_embeddings",
        enable_dynamic_field=True
    )

    # Create collection
    collection = Collection(
        name=collection_name,
        schema=schema,
        shards_num=1  # type: ignore
    )

    # Create index for embedding field to make similarity search faster
    index_params = {
        "metric_type": COSINE_METRIC,
        "index_type": INDEX_TYPE,
        "params": {}
    }

    collection.create_index(
        field_name="embedding",
        index_params=index_params
    )

    return collection


def clusters_collection(collection_name):
    """
    In the cluster collection, we save the following fields:
    - index: the index of the cluster
    - zoom_level: the zoom level of the cluster, with tile data information. Zoom level is a triplet
        (zoom_level, tile_x, tile_y).
    - tile_data: dictionary with fields entities (cluster representatives) and range of coordinates in the global
        reference system.
    @param collection_name: the name of the collection    @return: the collection
    """
    # Create fields for collection
    index = FieldSchema(
        name="index",
        dtype=DataType.INT64,
        is_primary=True
    )
    zoom_level = FieldSchema(
        name=ZOOM_LEVEL_VECTOR_FIELD_NAME,
        dtype=DataType.FLOAT_VECTOR,
        dim=3
    )
    entities = FieldSchema(
        name="entities",
        dtype=DataType.JSON
    )
    # Create collection schema
    schema = CollectionSchema(
        fields=[index, zoom_level, entities],
        description="zoom_levels_clusters",
        enable_dynamic_field=True
    )

    # Create collection
    collection = Collection(
        name=collection_name,
        schema=schema,
        shards_num=1  # type: ignore
    )

    index_params = {
        "metric_type": L2_METRIC,
        "index_type": INDEX_TYPE,
        "params": {}
    }

    collection.create_index(
        field_name=ZOOM_LEVEL_VECTOR_FIELD_NAME,
        index_params=index_params
    )

    return collection


def image_to_tile_collection(collection_name: str):
    # Create fields for collection
    index = FieldSchema(
        name="index",
        dtype=DataType.INT64,
        is_primary=True
    )
    zoom_level = FieldSchema(
        name=ZOOM_LEVEL_VECTOR_FIELD_NAME,
        dtype=DataType.FLOAT_VECTOR,
        dim=3
    )

    # Create collection schema
    schema = CollectionSchema(
        fields=[index, zoom_level],
        description="image_to_tile",
        enable_dynamic_field=True
    )

    # Create collection
    collection = Collection(
        name=collection_name,
        schema=schema,
        shards_num=1  # type: ignore
    )

    index_params = {
        "metric_type": L2_METRIC,
        "index_type": INDEX_TYPE,
        "params": {}
    }

    collection.create_index(
        field_name=ZOOM_LEVEL_VECTOR_FIELD_NAME,
        index_params=index_params
    )

    return collection
