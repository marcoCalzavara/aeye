import getpass
import sys
import typing

import numpy as np
from pymilvus import Collection
from pymilvus import CollectionSchema, FieldSchema, DataType
from pymilvus import utility, connections, db

from ..CONSTANTS import *


def create_collection(connection=False, passwd=None, collection_name=None) -> typing.Tuple[Collection, str]:
    try:
        if not connection and passwd is None:
            raise Exception("Function requires either a password or a connection.")
        # Create connection to Milvus server
        if not connection:
            connections.connect(
                user=ROOT_USER,
                password=passwd,
                host=HOST,
                port=PORT
            )

        # Create a database and switch to the newly created database
        if DATABASE_NAME not in db.list_database():
            db.create_database(DATABASE_NAME)
        db.using_database(DATABASE_NAME)

        if collection_name is None:
            collection_name = input("Choose collection name: ")

        if collection_name in utility.list_collections():
            print("Collection already exists.")
            sys.exit(0)

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
            "metric_type": METRIC,
            "index_type": INDEX_TYPE,
            "params": {}
        }

        collection.create_index(
            field_name="embedding",
            index_params=index_params
        )

        return collection, collection_name

    except Exception as e:
        print(e.__str__())
        sys.exit(1)


if __name__ == "__main__":
    passwd = getpass.getpass("Root password: ")
    create_collection(passwd=passwd)
