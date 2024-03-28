import getopt
import getpass
import os
import sys
from matplotlib import pyplot as plt

from dotenv import load_dotenv
from pymilvus import db, Collection

from ..db_utilities.datasets import DatasetOptions
from ..db_utilities.utils import create_connection
from ..CONSTANTS import *


def parsing():
    # Remove 1st argument from the list of command line arguments
    arguments = sys.argv[1:]

    # Options
    options = "hd:c:b:r:s:"

    # Long options
    long_options = ["help", "database", "dataset", "batch_size", "repopulate", "early_stop"]

    # Prepare flags
    flags = {"database": DEFAULT_DATABASE_NAME, "dataset": DatasetOptions.BEST_ARTWORKS.value["name"]}

    # Parsing argument
    arguments, values = getopt.getopt(arguments, options, long_options)

    if len(arguments) > 0 and arguments[0][0] in ("-h", "--help"):
        print(f'This script generates a scatter plot of low dimensional embedding for a dataset.\n\
        -d or --database: database name (default={flags["database"]}).\n\
        -c or --dataset: dataset (default={flags["dataset"]}).')
        sys.exit(0)

    # Checking each argument
    for arg, val in arguments:
        if arg in ("-d", "--database"):
            flags["database"] = val
        elif arg in ("-c", "--dataset"):
            if val in [dataset.value["name"] for dataset in DatasetOptions]:
                flags["dataset"] = val
            else:
                raise ValueError("Dataset not supported.")

    return flags


def generate_scatter_plot(collection: Collection):
    print("Generating scatter plot...")
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
                    output_fields=["x", "y"]
                )
                # Add entities to the list of entities
                entities += query_result

    except Exception as e:
        print(e.__str__())
        print("Error in fetching vectors. Scatter plot generation failed!")
        return

    # Create scatter plot
    x = [entity["x"] for entity in entities]
    y = [-entity["y"] for entity in entities]

    # Create figure
    fig, ax = plt.subplots(figsize=(20, 12))

    # Set x and y limits to the minimum and maximum values of your data
    ax.set_xlim(min(x), max(x))
    ax.set_ylim(min(y), max(y))

    # Create scatter plot with blue dots
    ax.scatter(x, y, s=3, c="lightblue")

    # Remove all axes
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_visible(False)
    ax.spines['bottom'].set_visible(False)

    # Remove all labels
    ax.set_xticks([])
    ax.set_yticks([])

    # Make background black
    ax.set_facecolor("black")

    # Remove all white space on the plot
    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)

    # Save scatter plot at os.getenv(HOME)/minimaps/{collection.name}.png. Create the directory if it does not exist.
    plt.savefig(f"{os.getenv(HOME)}/{collection.name}/minimap.png")
    print(f"Scatter plot saved for collection {collection.name} at {os.getenv(HOME)}/{collection.name}/minimap.png.")

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

    generate_scatter_plot(collection)
    sys.exit(0)
