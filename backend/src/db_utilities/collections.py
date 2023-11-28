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
        shards_num=1
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


def zoom_levels_collection(collection_name: str):
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
    images = FieldSchema(
        name="images",
        dtype=DataType.JSON
    )
    # Create collection schema
    schema = CollectionSchema(
        fields=[index, zoom_level, images],
        description="zoom_levels",
        enable_dynamic_field=True
    )

    # Create collection
    collection = Collection(
        name=collection_name,
        schema=schema,
        shards_num=1
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


def zoom_level_collection_with_images(collection_name):
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
    images = FieldSchema(
        name="images",
        dtype=DataType.JSON
    )
    path = FieldSchema(
        name="path_to_image",
        dtype=DataType.VARCHAR,
        max_length=65535
    )
    # Create collection schema
    schema = CollectionSchema(
        fields=[index, zoom_level, images, path],
        description="zoom_levels_paths",
        enable_dynamic_field=True
    )

    # Create collection
    collection = Collection(
        name=collection_name,
        schema=schema,
        shards_num=1
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
