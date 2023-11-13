import getopt
import getpass
import os
import sys
import warnings
from dotenv import load_dotenv

import PIL.Image
import numpy as np
import torch
from pymilvus import utility, db, Collection

from ..CONSTANTS import *
from ..db_utilities.utils import create_connection
from ..db_utilities.create_embeddings_collection import create_embeddings_collection
from ..model.CLIPEmbeddings import ClipEmbeddings
from ..model.DatasetPreprocessor import DatasetPreprocessor
from ..model.Datasets import DatasetOptions, get_dataset_object

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
            if val in [dataset.value for dataset in DatasetOptions]:
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
        print("Indeces are not in data, impossible to upsert vectors.")
        return
    if len(data["embeddings"].shape) != 2:
        print("'embeddings' should form a matrix.")
        return
    for key in keys:
        if type(data[key]) is not torch.Tensor:
            print(f"{key} should be a tensor.")
            return
        if key != "embeddings":
            if len(data[key].shape) > 1:
                print(f"Attributes should be one dimensional, but {key} is not.")
                return
            if data[key].shape[0] != data["embeddings"].shape[0]:
                print(f"Attributes should match the number of embeddings, but this is not true for {key}.")
                return

    # Remove embeddings and index from keys.
    keys.remove("embeddings")
    keys.remove("index")

    try:
        with open(FILE_MISSING_INDECES, "r") as f:
            first_line = f.readline()
            missing_indeces = list(map(int, first_line.strip().split(", "))) if first_line.strip() else []
            start = f.readline()
    except Exception as e:
        print(e.__str__())
        missing_indeces = []
        start = 0

    for i in range(0, data["embeddings"].shape[0], INSERT_SIZE):
        try:
            collection.insert(
                data=[
                    {
                        "index": data["index"][j].item(),
                        "embedding": data["embeddings"][j].tolist(),
                        "low_dimensional_embedding_x": np.nan,
                        "low_dimensional_embedding_y": np.nan,
                        **{key: data[key][j].item() for key in keys}
                    }
                    for j in range(i, i + INSERT_SIZE) if j < data["embeddings"].shape[0]]
            )
            collection.flush()
        except Exception as e:
            print(e.__str__())
            # Update file with missing indeces
            missing_indeces = list(set(missing_indeces + [data["index"][j].item() for j in range(i, i + INSERT_SIZE)
                                                          if j < data["embeddings"].shape[0]]))
            continue

    with open(FILE_MISSING_INDECES, "w") as f:
        f.write(', '.join(map(str, missing_indeces)) + "\n")
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
        print("Update failed!")
        return

    # Process records
    embeddings = torch.tensor([entities[i]["embedding"] for i in range(len(entities))]).detach()

    # Set embeddings
    dp.setEmbeddings(embeddings)
    # Get metadata
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore")
        data = dp.generateRecordsMetadata(plot=True)

    # Update vectors
    coordinates = ["x", "y", "z"]
    for i in range(len(entities)):
        for j in range(data["low_dim_embeddings"].shape[1]):
            entities[i][f"low_dimensional_embedding_{coordinates[j]}"] = data["low_dim_embeddings"][i][j]

    # Insert entities in a new collection
    new_collection, _ = create_embeddings_collection(collection_name=collection.name.removeprefix("temp_"),
                                                     choose_database=False)
    try:
        # Do for loop to avoid resource exhaustion
        for i in range(0, len(entities), INSERT_SIZE):
            new_collection.insert(data=[entities[j] for j in range(i, i + INSERT_SIZE) if j < len(entities)])
            new_collection.flush()
    except Exception as e:
        print(e.__str__())
        print("Update failed!")
        utility.drop_collection("temp")
        return

    # Drop the previous collection
    collection_name = collection.name
    utility.drop_collection(collection_name)
    # Release collection
    new_collection.release()
    print("Update completed!")


if __name__ == "__main__":
    # Load environment variables
    load_dotenv(DOTENV_PATH)
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
        sys.exit(1)

    # Choose a collection. If the collection does not exist, create it.
    collection_name = input("Collection name: ")
    if collection_name not in utility.list_collections():
        choice = input("The collection does not exist. Create collection? (y/n) ")
        if choice.lower() == "y":
            collection, collection_name = create_embeddings_collection(collection_name=collection_name,
                                                                       choose_database=False)
        elif choice.lower() == "n":
            sys.exit(0)
        else:
            print("Wrong choice.")
            sys.exit(1)
    else:
        collection = Collection(collection_name)

    missing_indeces = []
    start = 0
    if os.path.exists(FILE_MISSING_INDECES):
        # Get information from file
        with open(FILE_MISSING_INDECES, "r") as f:
            first_line = f.readline()
            missing_indeces = list(map(int, first_line.strip().split(", "))) if first_line.strip() else []
            start = int(f.readline())

    # The else condition is not important, as the abscence of a file means that either this is the first iteration of
    # the processing procedure, or an error message has been displayed in the previous iteration.

    # Get dataset object
    dataset = get_dataset_object(flags["dataset"])

    # Evaluate flags["repopulate"]
    if flags["repopulate"]:
        # Delete all vectors in the collection and define start point for dataloader
        collection.drop()
        collection, _ = create_embeddings_collection(ROOT_PASSWD, collection_name)
        missing_indeces = []
        start = 0
    else:
        # Check the number of remaining data points
        if dataset.get_size() - start < flags["batch_size"]:
            # We don't have enough remaining samples for a batch.
            # Set get_missing_indeces to true.
            missing_indeces + list(range(start, dataset.get_size()))

    # Create an embedding object
    embeddings = ClipEmbeddings(device=DEVICE)
    # Create dataset preprocessor
    dp = DatasetPreprocessor(embeddings, missing_indeces)

    # If there are no missing_indeces and the start is equal to the size of the dataset, then update the metadata by
    # adding low dimensional embeddings.
    if len(missing_indeces) == 0 and start == dataset.get_size():
        update_metadata(collection, dp, dataset.get_size())

    else:
        # Get data and populate database
        with (warnings.catch_warnings()):
            warnings.filterwarnings("ignore", category=UserWarning)

            print("Starting processing data...")

            if dataset.get_size() - start >= flags["batch_size"]:
                # Create dataloader
                dataloader = dataset.get_dataloader(flags["batch_size"], NUM_WORKERS, embeddings.processData,
                                                    is_missing_indeces=False, start=start, end=dataset.get_size())

                data = dp.generateDatabaseEmbeddings(dataloader, False, start, flags["early_stop"])

            else:
                # Create dataloader from missing indeces
                dataloader = dataset.get_dataloader(flags["batch_size"], NUM_WORKERS, embeddings.processData,
                                                    is_missing_indeces=True, missing_indeces=missing_indeces)

                data = dp.generateDatabaseEmbeddings(dataloader, True, dataset.get_size())

            # Add data to vector store
            insert_vectors(collection, data)

    print("Process finished!")
    sys.exit(0)
