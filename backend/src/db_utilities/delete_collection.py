import os
import sys

from dotenv import load_dotenv
from pymilvus import Collection
from pymilvus import utility, db

from .utils import create_connection
from ..CONSTANTS import *


def delete_collection(connection=False, collection_name=None):
    try:
        if not connection:
            create_connection(ROOT_USER, ROOT_PASSWD)

        # Choose a database and switch to the newly created database
        db_name = input("Database name: (enter for default database): ")
        if db_name == "":
            db_name = DEFAULT_DATABASE_NAME

        if db_name not in db.list_database():
            print(f"No database named {db_name}.")
            sys.exit(1)

        db.using_database(db_name)

        if collection_name is None:
            print(f"Available collections: {utility.list_collections()}")
            collection_name = input("Choose collection name: ")

        if collection_name not in utility.list_collections():
            print("Collection does not exist.")
        else:
            choice = input(f"The collection has {Collection(collection_name).num_entities} entities. "
                           f"Are you sure you want to delete it? (y/n)")
            if choice.lower() == "y":
                print("Dropping collection...")
                utility.drop_collection(collection_name)
                print("Collection dropped.")
            elif choice.lower() == "n":
                print("Operation aborted.")
            else:
                print("Invalid choice.")

    except Exception as e:
        print(e.__str__())
        sys.exit(1)


if __name__ == "__main__":
    if ENV_FILE_LOCATION not in os.environ:
        # Try to load /.env file
        choice = input("Do you want to load /.env file? (y/n) ")
        if choice.lower() == "y" and os.path.exists("/.env"):
            load_dotenv("/.env")
        else:
            print("export .env file location as ENV_FILE_LOCATION. Export $HOME/image-viz/.env if running outside "
                  "of docker container, export /.env if running inside docker container backend.")
            sys.exit(1)
    else:
        # Load environment variables
        load_dotenv(os.getenv(ENV_FILE_LOCATION))

    delete_collection()
