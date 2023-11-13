import getpass
import os
import sys
import typing
from dotenv import load_dotenv

from pymilvus import Collection
from pymilvus import utility, db

from ..CONSTANTS import *
from .utils import create_connection


def delete_collection(connection=False, collection_name=None) -> typing.Tuple[Collection, str]:
    try:
        if not connection:
            choice = input("Use root user? (y/n) ")
            if choice.lower() == "y":
                create_connection(ROOT_USER, os.getenv(ROOT_PASSWD))
            elif choice.lower() == "n":
                user = input("Username: ")
                passwd = getpass.getpass("Password: ")
                create_connection(user, passwd)
            else:
                print("Wrong choice.")
                sys.exit(1)

        # Choose a database and switch to the newly created database
        db_name = input("Database name: ('default' for default database): ")
        if db_name == "default":
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
    # Load environment variables
    load_dotenv(dotenv_path=DOTENV_PATH)
    delete_collection()
