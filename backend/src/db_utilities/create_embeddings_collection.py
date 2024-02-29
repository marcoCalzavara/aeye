import getpass
import os
import sys
import typing

from dotenv import dotenv_values
from pymilvus import Collection
from pymilvus import utility, db

from .collections import embeddings_collection
from .create_database import create_database
from .utils import create_connection
from ..CONSTANTS import *


def create_embeddings_collection(collection_name=None, choose_database=True) -> typing.Tuple[Collection, str]:
    try:
        # Create a database and switch to the newly created database if it does not exist
        if not choose_database and DEFAULT_DATABASE_NAME not in db.list_database():
            create_database()
            db.using_database(DEFAULT_DATABASE_NAME)
        elif not choose_database and DEFAULT_DATABASE_NAME in db.list_database():
            db.using_database(DEFAULT_DATABASE_NAME)
        else:
            # Create a database and switch to the newly created database
            db_name = create_database()
            db.using_database(db_name)

        # Choose collection name and create a collection
        if collection_name is None:
            collection_name = input("Choose collection name: ")

        if collection_name in utility.list_collections():
            print("Collection already exists.")
            sys.exit(0)

        collection = embeddings_collection(collection_name)
        print(f"Collection {collection_name} created.")
        return collection, collection_name

    except Exception as e:
        print(e.__str__())
        sys.exit(1)


if __name__ == "__main__":
    # Load environment variables
    if ENV_FILE_LOCATION not in os.environ:
        # Try to load /.env file
        choice = input("Do you want to load /.env file? (y/n) ")
        if choice.lower() == "y" and os.path.exists("/.env"):
            env_variables = dotenv_values("/.env")
        else:
            print("export .env file location as ENV_FILE_LOCATION. Export $HOME/image-viz/.env if running outside "
                  "of docker container, export /.env if running inside docker container backend.")
            sys.exit(1)
    else:
        # Load environment variables
        env_variables = dotenv_values(os.environ[ENV_FILE_LOCATION])

    choice = input("Use root user? (y/n) ")
    if choice.lower() == "y":
        create_connection(ROOT_USER, ROOT_PASSWD)
        create_embeddings_collection()
    elif choice.lower() == "n":
        user = input("Username: ")
        passwd = getpass.getpass("Password: ")
        create_connection(user, passwd)
        create_embeddings_collection()
    else:
        print("Wrong choice.")
        sys.exit(1)
