import getopt
import getpass
import os
import sys
import time

from dotenv import load_dotenv
from pymilvus import db, Collection

from .collections import ZOOM_LEVEL_VECTOR_FIELD_NAME
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
    flags = {"database": DEFAULT_DATABASE_NAME,
             "collection": DatasetOptions.BEST_ARTWORKS.value["name"]}

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
                # Get directory name
                for dataset in DatasetOptions:
                    if dataset.value["name"] == val:
                        flags["directory"] = dataset.value["directory"]
                        break
            else:
                raise ValueError("The collection must have one of the following names: "
                                 + str([dataset.value["name"] for dataset in DatasetOptions]))

    return flags


def convert_index_to_tile(index):
    i = 0
    tot = 0
    while tot < index:
        tot += 4 ** i
        i += 1
    if tot == index:
        return [i, 0, 0]
    tot -= 4 ** (i - 1)
    zoom_level = i - 1
    tile_x = (index - tot) // (2 ** zoom_level)
    tile_y = index - tot - (2 ** zoom_level) * tile_x
    return [zoom_level, tile_x, tile_y]


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

    # Check that collection has 100000 entities
    collection = Collection(flags["collection"] + "_zoom_levels_clusters")
    collection.load()
    if collection.num_entities < 100000:
        print(f"Collection {flags['collection']} must have 100000 entities.")
        sys.exit(1)

    # Now test query of 100000 entities and 100000 queries of 1 entity
    print("Testing query of 100000 entities.")
    results = []
    time_start = time.time()
    for i in range(0, 100000, SEARCH_LIMIT):
        results += collection.query(
            expr=f"index in {list(range(i, min(i + SEARCH_LIMIT, 100000)))}",
            output_fields=[ZOOM_LEVEL_VECTOR_FIELD_NAME, "data"]
        )
    time_end = time.time()
    assert len(results) == 100000
    print(f"Time taken for single query: {time_end - time_start}")

    print("Testing 100000 queries of 1 entity.")
    results = []
    time_start = time.time()
    for i in range(100000):
        results += collection.query(
            expr=f"index in [{i}]",
            output_fields=[ZOOM_LEVEL_VECTOR_FIELD_NAME, "data"],
            limit=1
        )
    time_end = time.time()
    assert len(results) == 100000
    print(f"Time taken for 100000 queries: {time_end - time_start}")

    # Now try with search
    print("Testing search of 100000 entities.")
    # Collect all tiles in a list to get to 100000 entities
    tiles = []
    for i in range(100000):
        tiles.append(convert_index_to_tile(i))
    results = []
    search_params = {
        "metric_type": L2_METRIC,
        "offset": 0
    }
    time_start = time.time()
    for i in range(0, 100000, SEARCH_LIMIT):
        results += collection.search(
            data=tiles[i:i + SEARCH_LIMIT],
            anns_field=ZOOM_LEVEL_VECTOR_FIELD_NAME,
            param=search_params,
            expr=None,
            limit=1,
            output_fields=[ZOOM_LEVEL_VECTOR_FIELD_NAME, "data"]
        )
    time_end = time.time()
    assert len(results) == 100000
    print(f"Time taken for single search: {time_end - time_start}")

    print("Testing 100000 searches of 1 entity.")
    results = []
    time_start = time.time()
    for i in range(100000):
        results += collection.search(
            data=[tiles[i]],
            anns_field=ZOOM_LEVEL_VECTOR_FIELD_NAME,
            param=search_params,
            limit=1,
            expr=None,
            output_fields=[ZOOM_LEVEL_VECTOR_FIELD_NAME, "data"]
        )
    time_end = time.time()
    assert len(results) == 100000
    print(f"Time taken for 100000 searches: {time_end - time_start}")
