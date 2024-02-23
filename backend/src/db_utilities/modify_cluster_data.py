import getopt
import getpass
import os
import sys

from dotenv import load_dotenv
from pymilvus import utility, db, Collection

from .create_and_populate_clusters_collection import ZOOM_LEVEL_VECTOR_FIELD_NAME
from .collections import clusters_collection
from .datasets import DatasetOptions
from .utils import create_connection
from ..CONSTANTS import *


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
    for i in range(len(entities)):
        try:
            # Update in_previous flag of the deepest zoom level. Check for each entity in the deepest zoom level if the
            # entity is present in the previous zoom level. If it is, set the in_previous flag to True, else set it to
            # False.
            if entities[i][ZOOM_LEVEL_VECTOR_FIELD_NAME][0] == 7:
                if len(entities[i]["entities"]) == 0:
                    continue
                # Check if the entity is present in the previous zoom level
                # Get tile at previous zoom level which contains the tile currently being processed
                tile_x = entities[i][ZOOM_LEVEL_VECTOR_FIELD_NAME][1] // 2
                tile_y = entities[i][ZOOM_LEVEL_VECTOR_FIELD_NAME][2] // 2
                # Get the tile at the previous zoom level
                search_params = {
                    "metric_type": L2_METRIC,
                    "offset": 0
                }
                results = collection.search(
                    data=[[entities[i][ZOOM_LEVEL_VECTOR_FIELD_NAME][0] - 1, tile_x, tile_y]],
                    anns_field=ZOOM_LEVEL_VECTOR_FIELD_NAME,
                    param=search_params,
                    limit=1,
                    output_fields=["entities"]
                )
                if results[0][0].distance > 0.:
                    raise ValueError("The distance between the tile and the tile at the previous zoom level is not 0.")

                for entity in entities[i]["entities"]:
                    for entity_prev in results[0][0].to_dict()["entity"]["entities"]:
                        if entity["index"] == entity_prev["index"]:
                            entity["in_previous"] = True
                            break

        except Exception as e:
            print(e.__str__())
            print(f"index: {i}")
            print("Error in update_metadata. Update failed!")
            return

    try:
        # Create cluster collection
        new_collection = clusters_collection("temp_" + collection.name)
        # Do for loop to avoid resource exhaustion
        for i in range(0, len(entities), INSERT_SIZE):
            new_collection.insert(data=[entities[j] for j in range(i, i + INSERT_SIZE) if j < len(entities)])
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
