import getopt
import getpass
import json
import os
import sys

import PIL.Image
from dotenv import load_dotenv
from pymilvus import utility, db, Collection

from .create_and_populate_clusters_collection import ZOOM_LEVEL_VECTOR_FIELD_NAME
from .collections import clusters_collection
from .datasets import DatasetOptions
from .utils import create_connection
from ..CONSTANTS import *

# Increase pixel limit
PIL.Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


def parsing():
    # Remove 1st argument from the list of command line arguments
    arguments = sys.argv[1:]

    # Options
    options = "hd:c:b:r:s:"

    # Long options
    long_options = ["help", "database", "dataset", "batch_size", "repopulate", "early_stop"]

    # Prepare flags
    flags = {"database": DEFAULT_DATABASE_NAME, "dataset": DatasetOptions.BEST_ARTWORKS.value["name"],
             "batch_size": BATCH_SIZE, "repopulate": False, "early_stop": -1}

    # Parsing argument
    arguments, values = getopt.getopt(arguments, options, long_options)

    if len(arguments) > 0 and arguments[0][0] in ("-h", "--help"):
        print(f'This script populates a vector store with embeddings.\n\
        -d or --database: database name (default={flags["database"]}).\n\
        -c or --dataset: dataset (default={flags["dataset"]}).\n\
        -b or --batch_size: batch size used for loading the dataset (default={BATCH_SIZE}).\n\
        -r or --repopulate: whether to empty the database and repopulate. Type y for repopulating the store, '
              f'n otherwise (default={"n" if not flags["repopulate"] else "y"}).\n\
        -s or --early_stop: batches to process. Type -1 to process all samples, a number greater equal then 1 otherwise'
              f' (default={flags["early_stop"]}).')
        sys.exit()

    # Checking each argument
    for arg, val in arguments:
        if arg in ("-d", "--database"):
            flags["database"] = val
        elif arg in ("-c", "--dataset"):
            if val in [dataset.value["name"] for dataset in DatasetOptions]:
                flags["dataset"] = val
            else:
                raise ValueError("Dataset not supported.")
        elif arg in ("-b", "--batch_size"):
            if int(val) >= 1:
                flags["batch_size"] = int(val)
            else:
                raise ValueError("Batch size must be at least 1.")
        elif arg in ("-r", "--repopulate"):
            if val == "y":
                flags["repopulate"] = True
            elif val == "n":
                flags["repopulate"] = False
            else:
                raise ValueError("repopulate must be y or n.")
        elif arg in ("-s", "--early_stop"):
            if int(val) == 0:
                raise ValueError("early_stop cannot be 0")
            else:
                flags["early_stop"] = int(val)

    return flags


def modify_datapoints(collection: Collection):
    print("Modifying datapoints...")
    # Load collection in memory
    collection.load()

    # Fetch vectors
    entities = []
    try:
        for i in range(0, collection.num_entities, SEARCH_LIMIT):
            if collection.num_entities > 0:
                # Get SEARCH_LIMIT entities
                query_result = collection.query(
                    expr=f"index in {list(range(i, i + SEARCH_LIMIT))}",
                    output_fields=["*"]
                )
                # Add entities to the list of entities
                entities += query_result

    except Exception as e:
        print(e.__str__())
        print("Error in update_metadata. Update failed!")
        return

    # Update vectors
    new_entities = []
    for i in range(len(entities)):
        # Remove from each entity of cluster_representatives the fields "number_of_entities", "author", and rename
        # "low_dimensional_embedding_x" to "x" and "low_dimensional_embedding_y" to "y". Also reduce the
        # hierarchy cluster_representatives-entities to just entities.
        try:
            temp_entities = []
            for entity in entities[i]["clusters_representatives"]["entities"]:
                new_entity = {}
                temp = json.loads(entity)
                new_entity["index"] = temp["representative"]["index"]
                new_entity["x"] = temp["representative"]["low_dimensional_embedding_x"]
                new_entity["y"] = temp["representative"]["low_dimensional_embedding_y"]
                new_entity["path"] = temp["representative"]["path"]
                new_entity["width"] = temp["representative"]["width"]
                new_entity["height"] = temp["representative"]["height"]
                if "is_in_previous_zoom_level" in temp:
                    new_entity["in_previous"] = temp["is_in_previous_zoom_level"]
                else:
                    new_entity["in_previous"] = False
                temp_entities.append(new_entity)

            new_complete_entity = {"index": entities[i]["index"],
                                   ZOOM_LEVEL_VECTOR_FIELD_NAME: entities[i][ZOOM_LEVEL_VECTOR_FIELD_NAME],
                                   "entities": temp_entities}
            if "tile_coordinate_range" in entities[i]:
                new_complete_entity["range"] = entities[i]["tile_coordinate_range"]

            new_entities.append(new_complete_entity)
            if i == 0:
                print(new_complete_entity)
        except Exception as e:
            print(e.__str__())
            print(f"index: {i}")
            print("Error in update_metadata. Update failed!")
            return

    try:
        # Create cluster collection
        new_collection = clusters_collection("temp_" + collection.name)
        # Do for loop to avoid resource exhaustion
        for i in range(0, len(new_entities), INSERT_SIZE):
            new_collection.insert(data=[new_entities[j] for j in range(i, i + INSERT_SIZE) if j < len(new_entities)])
            new_collection.flush()
    except Exception as e:
        print(e.__str__())
        print("Error in update_metadata. Update failed!")
        utility.drop_collection("temp_" + collection.name)
        return

    # Drop the previous collection
    collection_name = collection.name
    utility.drop_collection(collection_name)
    # Release collection
    new_collection.release()
    print("Update completed!")


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

    # Get arguments
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

    # Get the collection object
    collection_name = flags["dataset"] + "_zoom_levels_clusters"
    collection = Collection(collection_name)

    print(f"Using collection {collection_name}. The collection contains {collection.num_entities} entities.")

    print("Starting processing data...")
    modify_datapoints(collection)

    print("Process finished!")
    sys.exit(0)
