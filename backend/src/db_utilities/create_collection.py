import getpass
import os
import sys
import typing

import numpy as np
from pymilvus import Collection
from pymilvus import CollectionSchema, FieldSchema, DataType
from pymilvus import utility, db

from ..CONSTANTS import *
from .common_utils import create_connection


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
        "metric_type": METRIC,
        "index_type": INDEX_TYPE,
        "params": {}
    }

    collection.create_index(
        field_name="embedding",
        index_params=index_params
    )

    return collection


def create_collection(collection_name=None, on_start=False, choose_database=True) -> typing.Tuple[Collection, str]:
    try:
        # Create a database and switch to the newly created database
        if on_start and DEFAULT_DATABASE_NAME not in db.list_database():
            db.create_database(DEFAULT_DATABASE_NAME)
            db.using_database(DEFAULT_DATABASE_NAME)
        elif on_start:
            # If the database already exists, switch to it. This code should never be reached.
            db.using_database(DEFAULT_DATABASE_NAME)
        else:
            if choose_database:
                # Choose a database. If the database does not exist, create it.
                db_name = input("Choose database: ")
                if db_name not in db.list_database():
                    choice = input("The database does not exist. 'n' will revert to default database. Create one? ("
                                   "y/n) ")
                    if choice.lower() == "y":
                        db.create_database(db_name)
                        db.using_database(db_name)
                    elif choice.lower() == "n":
                        if DEFAULT_DATABASE_NAME not in db.list_database():
                            db.create_database(DEFAULT_DATABASE_NAME)
                        db.using_database(DEFAULT_DATABASE_NAME)
                    else:
                        print("Wrong choice.")
                        sys.exit(1)
            else:
                if DEFAULT_DATABASE_NAME not in db.list_database():
                    db.create_database(DEFAULT_DATABASE_NAME)
                db.using_database(DEFAULT_DATABASE_NAME)

        # Choose collection name and create a collection
        if collection_name is None:
            collection_name = input("Choose collection name: ")

        if collection_name in utility.list_collections():
            print("Collection already exists.")
            sys.exit(0)

        return embeddings_collection(collection_name), collection_name

    except Exception as e:
        print(e.__str__())
        sys.exit(1)


if __name__ == "__main__":
    if START not in os.environ or int(os.environ[START]) == 0:
        choice = input("Use root user? (y/n) ")
        if choice.lower() == "y":
            create_connection(ROOT_USER, os.environ[ROOT_PASSWD])
            create_collection()
        elif choice.lower() == "n":
            user = input("Username: ")
            passwd = getpass.getpass("Password: ")
            create_connection(user, passwd)
            create_collection()
        else:
            print("Wrong choice.")
            sys.exit(1)
    else:
        os.environ[START] = 0
        create_connection(ROOT_USER, os.environ[ROOT_PASSWD])
        # Create a collection with a temporary name
        create_collection(collection_name=TEMP_COLLECTION_NAME, on_start=True, choose_database=False)
