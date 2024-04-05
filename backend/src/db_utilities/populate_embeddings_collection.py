import getopt
import getpass
import os
import sys
import warnings

import PIL.Image
import numpy as np
import torch
from dotenv import load_dotenv
from pymilvus import utility, db, Collection

from .DatasetPreprocessor import DatasetPreprocessor
from .create_embeddings_collection import create_embeddings_collection
from .datasets import DatasetOptions, get_dataset_object
from .utils import create_connection
from ..CONSTANTS import *
from ..embeddings_model.CLIPEmbeddings import ClipEmbeddings

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


def insert_vectors(collection: Collection, data: dict):
    """

    :param collection:
    :param data: A dictionary with the embeddings and any other attribute of the samples. All values are tensors and
    all tensors must have the same length. Data must contain keys 'embeddings' and 'index'.
    :return:
    """

    print("Starting the upsert...")
    # Get data keys
    keys = list(data.keys())

    # Checks that data is conforming to requirements.
    if "embeddings" not in keys:
        print("Embeddings are not in data, impossible to upsert vectors.")
        return
    if "index" not in keys:
        print("Indexes are not in data, impossible to upsert vectors.")
        return
    if len(data["embeddings"].shape) != 2:
        print("'embeddings' should form a matrix.")
        return
    for key in keys:
        if key != "embeddings":
            if len(data[key]) != data["embeddings"].shape[0]:
                print(f"Attributes should match the number of embeddings, but this is not true for {key}.")
                return

    # Remove embeddings and index from keys.
    keys.remove("embeddings")
    keys.remove("index")

    try:
        with open(FILE_MISSING_INDEXES + "-" + flags["dataset"] + ".txt", "r") as f:
            first_line = f.readline()
            missing_indexes = list(map(int, first_line.strip().split(", "))) if first_line.strip() else []
            start = f.readline()
    except Exception as e:
        print(e.__str__())
        print("Error in insert_vectors.")
        missing_indexes = []
        start = 0

    for i in range(0, data["embeddings"].shape[0], INSERT_SIZE):
        try:
            collection.insert(
                data=[
                    {
                        "index": data["index"][j],
                        "embedding": data["embeddings"][j].tolist(),
                        "x": np.nan,
                        "y": np.nan,
                        **{key: data[key][j] for key in keys}
                    }
                    for j in range(i, i + INSERT_SIZE) if j < data["embeddings"].shape[0]]
            )
            collection.flush()
        except Exception as e:
            print(e.__str__())
            print("Error in insert_vectors.")
            # Update file with missing indexes
            missing_indexes = list(set(missing_indexes + [data["index"][j] for j in range(i, i + INSERT_SIZE)
                                                          if j < data["embeddings"].shape[0]]))
            continue

    with open(FILE_MISSING_INDEXES + "-" + flags["dataset"] + ".txt", "w") as f:
        f.write(', '.join(map(str, missing_indexes)) + "\n")
        f.write(start)

    print("Upsert completed!")


def update_metadata(collection: Collection, dp: DatasetPreprocessor, upper_value_index_range: int):
    print("Adding low dimensional embeddings...")
    # Load collection in memory
    collection.load()

    # Fetch vectors
    entities = []
    try:
        for i in range(0, upper_value_index_range, SEARCH_LIMIT):
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

    # Process records
    embeddings = torch.tensor([entities[i]["embedding"] for i in range(len(entities))]).detach()

    # Set embeddings
    dp.setEmbeddings(embeddings)
    # Get metadata
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore")
        data = dp.generateRecordsMetadata()

    # Update vectors
    for i in range(len(entities)):
        for j in range(min(data["low_dim_embeddings"].shape[1], 2)):
            entities[i][COORDINATES[j]] = data["low_dim_embeddings"][i][j]

    try:
        # Insert entities in a new collection
        new_collection, _ = create_embeddings_collection(collection_name=collection.name.removeprefix("temp_"),
                                                         choose_database=False)
        # Do for loop to avoid resource exhaustion
        for i in range(0, len(entities), INSERT_SIZE):
            new_collection.insert(data=[entities[j] for j in range(i, i + INSERT_SIZE) if j < len(entities)])
            new_collection.flush()
    except Exception as e:
        print(e.__str__())
        print("Error in update_metadata. Update failed!")
        utility.drop_collection(collection.name.removeprefix("temp_"))
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
    collection_name = "temp_" + flags["dataset"]
    did_not_exist = False
    if collection_name not in utility.list_collections():
        print(f"The temporary collection {collection_name} does not exist. Creating it...")
        collection, collection_name = create_embeddings_collection(collection_name=collection_name,
                                                                   choose_database=False)
        did_not_exist = True
    else:
        collection = Collection(collection_name)

    print(f"Using collection {collection_name}. The collection contains {collection.num_entities} entities.")
    missing_indexes = []
    start = 0
    if os.path.exists(FILE_MISSING_INDEXES + "-" + flags["dataset"] + ".txt"):
        # Get information from file
        with open(FILE_MISSING_INDEXES + "-" + flags["dataset"] + ".txt", "r") as f:
            first_line = f.readline()
            missing_indexes = list(map(int, first_line.strip().split(", "))) if first_line.strip() else []
            start = int(f.readline())

    # The else condition is not important, as the absence of a file means that either this is the first iteration of
    # the processing procedure, or an error message has been displayed in the previous iteration.

    # Get dataset object
    print(f"Getting dataset {flags['dataset']}...")
    dataset = get_dataset_object(flags["dataset"])

    # Evaluate flags["repopulate"]
    if flags["repopulate"] and start != dataset.get_size():
        print("Repopulating...")
        # Delete all vectors in the collection and define start point for dataloader
        collection.drop()
        missing_indexes = []
        start = 0
    else:
        # Check the number of remaining data points
        if dataset.get_size() - start < flags["batch_size"]:
            # We don't have enough remaining samples for a batch.
            missing_indexes + list(range(start, dataset.get_size()))

    # Create an embedding object
    embeddings = ClipEmbeddings(device=DEVICE)
    # Create dataset preprocessor
    dp = DatasetPreprocessor(embeddings, missing_indexes, flags["dataset"])

    # If there are no missing_indexes and the start is equal to the size of the dataset, then update the metadata by
    # adding low dimensional embeddings.
    if len(missing_indexes) == 0 and start == dataset.get_size():
        update_metadata(collection, dp, dataset.get_size())

    else:
        # Get data and populate database
        with (warnings.catch_warnings()):
            warnings.filterwarnings("ignore", category=UserWarning)

            print("Starting processing data...")

            if dataset.get_size() - start >= flags["batch_size"]:
                # Create dataloader
                dataloader = dataset.get_dataloader(flags["batch_size"], NUM_WORKERS, embeddings.processData,
                                                    is_missing_indexes=False, start=start, end=dataset.get_size())

                data = dp.generateDatabaseEmbeddings(dataloader, False, start, flags["early_stop"])

            else:
                # Create dataloader from missing indexes
                dataloader = dataset.get_dataloader(flags["batch_size"], NUM_WORKERS, embeddings.processData,
                                                    is_missing_indexes=True, missing_indexes=missing_indexes)

                data = dp.generateDatabaseEmbeddings(dataloader, True, dataset.get_size())

            # Add data to vector store
            insert_vectors(collection, data)

    print("Process finished!")
    sys.exit(0)
