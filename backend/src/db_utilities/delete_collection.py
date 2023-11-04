import getpass
import os
import sys
import typing

from pymilvus import Collection
from pymilvus import utility, connections, db

from ..CONSTANTS import *


def delete_collection(connection=False, passwd=None, collection_name=None) -> typing.Tuple[Collection, str]:
    try:
        if not connection and passwd is None:
            raise Exception("Function requires either a password or a connection.")
        # Create connection to Milvus server
        if not connection:
            connections.connect(
                host=os.environ[MILVUS_IP],
                port=os.environ[MILVUS_PORT],
                user=ROOT_USER,
                password=os.environ[ROOT_PASSWD]
            )

        # Create a database and switch to the newly created database
        if DATABASE_NAME not in db.list_database():
            db.create_database(DATABASE_NAME)
        db.using_database(DATABASE_NAME)

        print(f"Available collections: {utility.list_collections()}")

        if collection_name is None:
            collection_name = input("Choose collection name: ")

        if collection_name not in utility.list_collections():
            print("Collection does not exist.")
        else:
            choice = input(f"The collection has {Collection(collection_name).num_entities} entities. "
                           f"Are you sure you want to delete it? (y/n)")
            if choice == "y":
                print("Dropping collection...")
                utility.drop_collection(collection_name)
                print("Collection dropped.")
            elif choice == "n":
                print("Operation aborted.")
            else:
                print("Invalid choice.")

    except Exception as e:
        print(e.__str__())
        sys.exit(1)


if __name__ == "__main__":
    passwd = getpass.getpass("Root password: ")
    delete_collection(passwd=passwd)
