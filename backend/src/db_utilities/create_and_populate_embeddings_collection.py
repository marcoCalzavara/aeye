import getopt
import json
import os
import sys
import warnings

import PIL.Image
import torch
from dotenv import load_dotenv
from pymilvus import utility, db, Collection

from .DatasetPreprocessor import DatasetPreprocessor
from .collections import embeddings_collection, EMBEDDING_VECTOR_FIELD_NAME
from .datasets import get_dataset_object
from .utils import create_connection
from ..CONSTANTS import *
from ..embeddings_model.CLIPEmbeddings import ClipEmbeddings

# Increase pixel limit
PIL.Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


def parsing():
    # Load dataset options from datasets.json
    with open(os.path.join(os.getenv(HOME), DATASETS_JSON_NAME), "r") as f:
        datasets = json.load(f)["datasets"]
    # Remove 1st argument from the list of command line arguments
    arguments = sys.argv[1:]

    # Options
    options = "hd:c:b:r:"

    # Long options
    long_options = ["help", "database", "dataset", "batch_size", "repopulate"]

    # Prepare flags
    flags = {"database": DEFAULT_DATABASE_NAME, "dataset": datasets[0]["name"],
             "batch_size": BATCH_SIZE, "repopulate": False}

    # Parsing argument
    arguments, values = getopt.getopt(arguments, options, long_options)

    if len(arguments) > 0 and arguments[0][0] in ("-h", "--help"):
        print(f'This script populates a collection with embeddings.\n\
        -d or --database: database name (default={flags["database"]}).\n\
        -c or --dataset: dataset (default={flags["dataset"]}).\n\
        -b or --batch_size: batch size used for loading the dataset (default={BATCH_SIZE}).\n\
        -r or --repopulate: whether to empty the database and repopulate. Type y for repopulating the store, '
              f'n otherwise (default={"n" if not flags["repopulate"] else "y"}).')
        sys.exit()

    # Checking each argument
    for arg, val in arguments:
        if arg in ("-d", "--database"):
            flags["database"] = val
        elif arg in ("-c", "--dataset"):
            if val in [d["name"] for d in datasets]:
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

    return flags


def create_embeddings_collection(collection_name) -> Collection:
    try:
        collection = embeddings_collection(collection_name)
        print(f"Collection {collection_name} created.")
        return collection

    except Exception as e:
        print("Error in create_embeddings_collection. Error message: ", e)
        sys.exit(1)


def modify_data(data: dict) -> list:
    # Get data keys
    keys = list(data.keys())

    # Checks that data is conforming to requirements.
    if "embeddings" not in keys:
        print("Embeddings are not in data.")
        sys.exit(1)
    if "index" not in keys:
        print("Indexes are not in data")
        sys.exit(1)
    if len(data["embeddings"].shape) != 2:
        print("'embeddings' should form a matrix.")
        sys.exit(1)
    for key in keys:
        if key != "embeddings":
            if len(data[key]) != data["embeddings"].shape[0]:
                print(f"Attributes should match the number of embeddings, but this is not true for {key}.")
                sys.exit(1)

    # Remove embeddings and index from keys
    keys.remove("embeddings")
    keys.remove("index")

    new_data = []
    for i in range(0, data["embeddings"].shape[0]):
        new_data.append(
            {
                "index": data["index"][i],
                EMBEDDING_VECTOR_FIELD_NAME: data["embeddings"][i].tolist(),
                "x": 0,
                "y": 0,
                **{key: data[key][i] for key in keys}
            }
        )

    return new_data


def generate_low_dimensional_embeddings(entities: list, dp: DatasetPreprocessor, collection: Collection):
    print("Generating low dimensional embeddings...")

    # Process records
    embeddings = torch.tensor([entities[i][EMBEDDING_VECTOR_FIELD_NAME] for i in range(len(entities))]).detach()

    # Set embeddings
    dp.setEmbeddings(embeddings)
    # Get metadata
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore")
        data = dp.generateRecordsMetadata()

    # Update vectors
    for i in range(len(entities)):
        entities[i]["x"] = data["low_dim_embeddings"][i][0]
        entities[i]["y"] = data["low_dim_embeddings"][i][1]

    print("Inserting data...")
    try:
        # Do for loop to avoid resource exhaustion
        for i in range(0, len(entities), INSERT_SIZE):
            collection.insert(data=entities[i:i + INSERT_SIZE])

        # Flush the collection
        collection.flush()
    except Exception as e:
        print(e.__str__())
        print("Error in generate_low_dimensional_embeddings.")
        sys.exit(1)

    # Release collection
    collection.release()


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

    # Try creating a connection and selecting a database. If it fails, exit.
    try:
        create_connection(ROOT_USER, ROOT_PASSWD, False)
        db.using_database(flags["database"])
    except Exception as e:
        print(e.__str__())
        print("Error in main. Connection failed!")
        sys.exit(1)

    with warnings.catch_warnings():
        warnings.filterwarnings("ignore")
        if utility.has_collection(flags["dataset"]) and not flags["repopulate"]:
            # Get number of entities in the collection
            num_entities = Collection(flags["dataset"]).num_entities
            print(f"Found collection {flags['dataset']}'. It has {num_entities} entities."
                  f" Not dropping it. Set repopulate to True to drop it.")
            sys.exit(1)
        elif utility.has_collection(flags["dataset"]) and flags["repopulate"]:
            print(f"Dropping collection {flags['dataset']}...")
            utility.drop_collection(flags["dataset"])

        # Create collection
        collection = create_embeddings_collection(collection_name=flags["dataset"])

        # Get dataset object
        print(f"Getting dataset {flags['dataset']}...")
        dataset = get_dataset_object(flags["dataset"])

        if not flags["repopulate"] and collection.num_entities > 0:
            print(f"The collection {flags['dataset']} already has {collection.num_entities} entities. Set repopulate to"
                  " y if you want to repopulate the collection.")
            sys.exit(1)

        # Create an embedding object
        embeddings = ClipEmbeddings(device=DEVICE)
        # Create dataset preprocessor
        dp = DatasetPreprocessor(embeddings)

        # Get data and populate database
        print("Starting processing data...")
        # Get dataloader
        dataloader = dataset.get_dataloader(flags["batch_size"], NUM_WORKERS, embeddings.processData)
        # Generate data
        data = dp.generateDatabaseEmbeddings(dataloader)
        # Get entities
        entities = modify_data(data)
        # Generate low dimensional embeddings
        generate_low_dimensional_embeddings(entities, dp, collection)

        print("Process finished!")
        sys.exit(0)
