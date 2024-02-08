import getopt
import getpass
import os
import sys

import PIL.Image
from dotenv import load_dotenv
from pymilvus import utility, db, Collection
from tqdm import tqdm

from .create_embeddings_collection import create_embeddings_collection
from .datasets import DatasetOptions, get_dataset_object, Dataset
from .utils import create_connection
from ..CONSTANTS import *
from ..caption_model.BLIPForCaptionGeneration import BLIPForCaptionGeneration

# Increase pixel limit
PIL.Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


def parsing():
    # Remove 1st argument from the list of command line arguments
    arguments = sys.argv[1:]

    # Options
    options = "hd:c:b:"

    # Long options
    long_options = ["help", "database", "dataset", "batch_size"]

    # Prepare flags
    flags = {"database": DEFAULT_DATABASE_NAME, "dataset": DatasetOptions.BEST_ARTWORKS.value["name"],
             "batch_size": BATCH_SIZE}

    # Parsing argument
    arguments, values = getopt.getopt(arguments, options, long_options)

    if len(arguments) > 0 and arguments[0][0] in ("-h", "--help"):
        print(f'This script populates a vector store with embeddings.\n\
        -d or --database: database name (default={flags["database"]}).\n\
        -c or --dataset: dataset (default={flags["dataset"]}).\n\
        -b or --batch_size: batch size used for loading the dataset (default={BATCH_SIZE}).')
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

    return flags


def create_captions(collection: Collection, caption_model: BLIPForCaptionGeneration, dataset: Dataset, flags: dict):
    print("Creating captions...")
    # Get dataloader
    dataloader = dataset.get_dataloader(batch_size=flags["batch_size"],
                                        num_workers=1,
                                        data_processor=caption_model.processor)
    # Create dictionary with index-caption pairs
    captions = {}
    for i, data in enumerate(tqdm(dataloader, desc="Processing", ncols=100,
                             bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]")):
        if data is not None:
            # Get caption
            captions_list = caption_model.getImageCaption(data["images"])
            # Add caption to dictionary
            for j in range(len(captions_list)):
                captions[data["index"][j]] = captions_list[j][0].upper() + captions_list[j][1:]

    print("Getting data from collection...")
    # Load collection in memory
    collection.load()

    # Fetch vectors
    entities = []
    try:
        for i in range(0, collection.num_entities, SEARCH_LIMIT):
            # Get SEARCH_LIMIT entities
            query_result = collection.query(
                expr=f"index in {list(range(i, i + SEARCH_LIMIT))}",
                output_fields=["*"]
            )
            # Add entities to the list of entities and add captions
            for entity in query_result:
                assert entity["index"] in captions
                entity["caption"] = captions[entity["index"]]
                entities.append(entity)
    except Exception as e:
        print(e.__str__())
        print("Error in adding captions. Update failed!")
        return

    # Create temporary collection
    temp_collection_name = f"temp_{collection.name}"
    temp_collection, _ = create_embeddings_collection(collection_name=temp_collection_name, choose_database=False)

    try:
        # Insert entities in the temporary collection
        for i in range(0, len(entities), INSERT_SIZE):
            temp_collection.insert(data=[entities[j] for j in range(i, i + INSERT_SIZE) if j < len(entities)])
            temp_collection.flush()
    except Exception as e:
        print(e.__str__())
        print("Error in adding captions. Update failed!")
        utility.drop_collection(temp_collection_name)
        return

    # Drop the previous collection
    collection_name = collection.name
    utility.drop_collection(collection_name)
    # Rename the temporary collection
    utility.rename_collection(temp_collection_name, collection_name)
    # Release collection
    temp_collection.release()
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
    collection_name = flags["dataset"]
    if collection_name not in utility.list_collections():
        print(f"The collection {collection_name} does not exist. Come back when you have created it.")
        sys.exit(1)
    else:
        collection = Collection(collection_name)

    print(f"Using collection {collection_name}. The collection contains {collection.num_entities} entities.")

    # Create caption model
    caption_model = BLIPForCaptionGeneration(DEVICE)
    # Create dataset object
    dataset = get_dataset_object(flags["dataset"])

    # Create captions
    create_captions(collection, caption_model, dataset, flags)

    print("Process finished!")
    sys.exit(0)
