import numpy as np
from pymilvus import CollectionSchema, FieldSchema, DataType, Collection

from ..CONSTANTS import *


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
        name="embedding",
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
        name="zoom_plus_tile",
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
        field_name="zoom_plus_tile",
        index_params=index_params
    )

    return collection
