import csv
import getopt
import getpass
import os
import sys

from dotenv import load_dotenv
from pymilvus import db, Collection, utility

from .collections import embeddings_collection
from .datasets import DatasetOptions
from .utils import create_connection
from ..CONSTANTS import *


def parsing():
    # Remove 1st argument from the list of command line arguments
    arguments = sys.argv[1:]

    # Options
    options = "hd:c:"

    # Long options
    long_options = ["help", "database", "collection"]

    # Prepare flags
    flags = {"database": DEFAULT_DATABASE_NAME, "collection": DatasetOptions.BEST_ARTWORKS.value["name"]}

    # Parsing argument
    arguments, values = getopt.getopt(arguments, options, long_options)

    if len(arguments) > 0 and arguments[0][0] in ("-h", "--help"):
        print(f'This script generates zoom levels.\n\
        -d or --database: database name (default={flags["database"]}).\n\
        -c or --collection: collection name (default={flags["collection"]}).')
        sys.exit(0)

    # Checking each argument
    for arg, val in arguments:
        if arg in ("-d", "--database"):
            flags["database"] = val
        elif arg in ("-c", "--collection"):
            if val in [dataset.value["name"] for dataset in DatasetOptions]:
                flags["collection"] = val
            else:
                raise ValueError("The collection must have one of the following names: "
                                 + str([dataset.value["name"] for dataset in DatasetOptions]))

    return flags


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

    flags = parsing()

    choice = input("Use root user? (y/n) ")
    if choice == "y":
        user = ROOT_USER
        passwd = ROOT_PASSWD
    elif choice.lower() == "n":
        user = input("Username: ")
        passwd = getpass.getpass("Password: ")
    else:
        print("Wrong choice.")
        sys.exit(1)

    # Try creating a connection and selecting a database. If it fails, exit.
    try:
        create_connection(user, passwd)
        db.using_database(flags["database"])
    except Exception as e:
        print(e.__str__())
        print("Error in main. Connection failed!")
        sys.exit(1)

    # 1. Create a variable to store the path to the file
    PATH = f"{os.getenv(HOME)}/image-viz/backend/src/captioning/captions/captions_{flags['collection']}.csv"

    captions = {}
    # 2. Open the file
    with open(PATH, "r") as file:
        # 3. Create a csv reader object
        reader = csv.reader(file)
        header = next(reader)
        # 5. Loop over the rows
        for row in reader:
            # Get captions
            captions[int(row[0])] = row[1]

    # Get the collection object
    collection = Collection(flags["collection"])

    # Fetch vectors
    entities = []
    try:
        for i in range(0, collection.num_entities, 16384):
            if collection.num_entities > 0:
                # Get SEARCH_LIMIT entities
                query_result = collection.query(
                    expr=f"index in {list(range(i, i + 16384))}",
                    output_fields=["*"]
                )
                # Add entities to the list of entities
                entities += query_result
    except Exception as e:
        print(e.__str__())
        print("Error in update_metadata. Update failed!")
        sys.exit(1)

    # Order entities by index
    entities = sorted(entities, key=lambda x: x["index"])
    # Assert that the indices are correct, i.e., the range is the same as the number of captions
    assert len(entities) == len(captions)

    # Add captions to entities
    # Update vectors
    for i in range(len(entities)):
        assert (entities[i]["index"] == i)
        entities[i]["caption"] = captions[entities[i]["index"]]

    # Define new name
    new_name = "temp_" + flags["collection"]
    try:
        # Create cluster collection
        new_collection = embeddings_collection(new_name)
        # Do for loop to avoid resource exhaustion
        for i in range(0, len(entities), 16384):
            new_collection.insert(data=[entities[j] for j in range(i, i + 16384) if j < len(entities)])
        # Flush collection
        new_collection.flush()
    except Exception as e:
        print(e.__str__())
        print("Error in update_metadata. Update failed!")
        utility.drop_collection(new_name)
        sys.exit(1)

    # Drop old collection and rename new collection
    try:
        # Drop old collection
        utility.drop_collection(flags["collection"])
        # Rename new collection
        utility.rename_collection(new_name, flags["collection"], "aiplusart")
    except Exception as e:
        print(e.__str__())
        print("Error in update_metadata. Update failed!")
        sys.exit(1)
