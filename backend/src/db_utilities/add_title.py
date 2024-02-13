import getopt
import getpass
import os
import sys
import warnings

import PIL.Image
from dotenv import load_dotenv
from pymilvus import utility, db, Collection

from torch.utils.data import Dataset as TorchDataset
from .create_embeddings_collection import create_embeddings_collection
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


class SupportDatasetForImages(TorchDataset):
    def __init__(self, root_dir, separator="_"):
        self.root_dir = root_dir
        self.file_list = []

        for file in os.listdir(root_dir):
            if not os.path.isdir(os.path.join(self.root_dir, file)):
                self.file_list.append(file)

        # Check that filenames start with a number, and that the indexes go from 0 to len(file_list) - 1
        for file in self.file_list:
            if not file.split(separator)[0].isdigit():
                raise Exception("Filenames must start with a number.")
            elif int(file.split(separator)[0]) >= len(self.file_list) or int(file.split(separator)[0]) < 0:
                raise Exception("Indexes must go from 0 to len(file_list) - 1.")

        # Sort file list by index
        self.file_list.sort(key=lambda x: int(x.split(separator)[0]))
        self.transform = None

    def __getitem__(self, idx):
        # Create dictionary to return
        return_value = {
            'index': idx,
            'path': self.file_list[idx],
            'genre': '',
            'author': '',
            'title': '',
            'date': -1,
        }

        # Get elements from filename. Remove initial number and extension, and split by "_"
        elements = self.file_list[idx].removesuffix(".jpg").split("_")[1:]
        if len(elements) > 0:
            return_value['genre'] = " ".join(elements[0].split("-"))
        if len(elements) > 1:
            # Get author and capitalize first letter of each word
            return_value['author'] = " ".join(elements[1].split("-")).capitalize()
        if len(elements) > 2:
            # If at the end there are 4 consecutive numbers, it is a date. Remove it from the title and assign it to
            # date
            title_elements = elements[2].split("-")
            if len(title_elements) > 0 and title_elements[-1].isdigit() and len(title_elements[-1]) == 4:
                return_value['date'] = int(title_elements[-1])
                title_elements = title_elements[:-1]

            # First, assign single s to previous word with "'s"
            for i in range(len(title_elements)):
                if title_elements[i] == "s" and i > 0:
                    title_elements[i - 1] = title_elements[i - 1] + "'s"

            # Then, assign single l to next word
            for i in range(len(title_elements)):
                if title_elements[i] == "l" and i < len(title_elements) - 1:
                    title_elements[i + 1] = "l'" + title_elements[i + 1]

            # Remove all standalone "s" from the list
            title_elements = [x for x in title_elements if x != "s"]
            # Remove all standalone "l" from the list
            title_elements = [x for x in title_elements if x != "l"]
            # Capitalize first letter of each word
            return_value['title'] = " ".join(title_elements).capitalize()

        return return_value


def insert_title(collection: Collection, dataset):
    print("Adding title...")
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

    # Sort entities by index
    entities = sorted(entities, key=lambda x: x["index"])

    # Update vectors
    for i in range(len(entities)):
        assert entities[i]["index"] == entities[i]["index"]
        # Add title to the entity
        entities[i]["title"] = dataset[i]["title"]

    try:
        # Insert entities in a new collection
        new_collection, _ = create_embeddings_collection(collection_name="temp_" + collection.name,
                                                         choose_database=False)
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
    collection_name = flags["dataset"]
    collection = Collection(collection_name)

    print(f"Using collection {collection_name}. The collection contains {collection.num_entities} entities.")

    # Get dataset object
    print(f"Getting dataset {flags['dataset']}...")

    # Create dataset
    dataset = SupportDatasetForImages(os.path.join(os.getenv(HOME), os.getenv(WIKIART_DIR)))

    # Get data and populate database
    with (warnings.catch_warnings()):
        warnings.filterwarnings("ignore", category=UserWarning)

        print("Starting processing data...")

        # Add data to vector store
        insert_title(collection, dataset)

    print("Process finished!")
    sys.exit(0)
