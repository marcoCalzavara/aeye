import getpass
import os
import sys

from dotenv import load_dotenv
import getopt
from pymilvus import db, Collection, utility
import matplotlib.pyplot as plt
import numpy as np

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
            if val in [dataset.value for dataset in DatasetOptions]:
                flags["collection"] = val
            else:
                raise ValueError("The collection must have one of the following names: "
                                 + str([dataset.value["name"] for dataset in DatasetOptions]))

    return flags


def load_vectors_from_collection(collection: Collection) -> list | None:
    # Load collection in memory
    collection.load()
    # Get low dimensional embeddings attributes
    low_dim_attributes = ["index"] + ["low_dimensional_embedding_" + COORDINATES[i] for i in range(len(COORDINATES))]

    # Get elements from collection
    entities = []
    try:
        for i in range(0, collection.num_entities, SEARCH_LIMIT):
            if collection.num_entities > 0:
                # Get SEARCH_LIMIT entities
                query_result = collection.query(
                    expr=f"index in {list(range(i, i + SEARCH_LIMIT))}",
                    output_fields=low_dim_attributes
                )
                # Add entities to the list of entities
                entities += query_result
    except Exception as e:
        print(e.__str__())
        print("Error in load_vectors_from_collection.")
        return None

    # Now entities contains all the entities in the collection, with fields 'index' and 'low_dimensional_embedding_*'
    return entities


def plot_heat_map(grid: list[list[list[list[list]]]], number_of_tiles: int, zoom_level) -> None:
    # Plot a heat map of the grid
    grid_for_heat_map = [[0 for _ in range(number_of_tiles * WINDOW_SIZE_IN_CELLS_PER_DIM)]
                         for _ in range(number_of_tiles * WINDOW_SIZE_IN_CELLS_PER_DIM)]
    for i in range(number_of_tiles):
        for j in range(number_of_tiles):
            for k in range(WINDOW_SIZE_IN_CELLS_PER_DIM):
                for m in range(WINDOW_SIZE_IN_CELLS_PER_DIM):
                    grid_for_heat_map[i * WINDOW_SIZE_IN_CELLS_PER_DIM + k][j * WINDOW_SIZE_IN_CELLS_PER_DIM + m] \
                        = len(grid[i][j][k][m])

    # Plot the heat map
    plt.imshow(np.array(grid_for_heat_map), cmap='hot', interpolation='nearest')
    # Add a color bar
    plt.colorbar()
    # Save the plot
    plt.savefig("heat_map_zoom_level_" + str(zoom_level) + ".png")
    # Clear the plot
    plt.clf()


def create_collection_with_grid(grid: list[list[list[list[list]]]], collection_name: str, zoom_level: int) -> None:
    pass


def create_zoom_levels(entities, zoom_levels_collection_name, zoom_levels) -> None:
    # Remember that DatasetOptions.BEST_ARTWORKS.value["zoom_levels"] contains the number of zoom levels required by
    # the dataset.

    # Find the maximum and minimum values for each dimension
    max_values = {}
    min_values = {}
    for coordinate in COORDINATES:
        max_values[coordinate] = max([entity["low_dimensional_embedding_" + coordinate] for entity in entities])
        min_values[coordinate] = min([entity["low_dimensional_embedding_" + coordinate] for entity in entities])

    # For reference, a tile is [[[] for _ in range(WINDOW_SIZE_IN_CELLS_PER_DIM)] for _ in range(
    # WINDOW_SIZE_IN_CELLS_PER_DIM)]

    for zoom in range(zoom_levels + 1):
        # Get the number of tiles in each dimension
        number_of_tiles = 2 ** zoom
        # Organize the tiles in a grid
        grid = [[[[[] for _ in range(WINDOW_SIZE_IN_CELLS_PER_DIM)] for _ in range(WINDOW_SIZE_IN_CELLS_PER_DIM)]
                 for _ in range(number_of_tiles)] for _ in range(number_of_tiles)]
        # Now grid[i][j] is a tile at position (i, j) in the grid

        # Divide the range of values for each dimension into 2^zoom_levels intervals
        x_grid_of_tiles_step = (max_values[COORDINATES[0]]
                                - min_values[COORDINATES[0]]) / number_of_tiles
        y_grid_of_tiles_step = (max_values[COORDINATES[1]]
                                - min_values[COORDINATES[1]]) / number_of_tiles

        # Define in-tile steps
        x_in_tile_step = x_grid_of_tiles_step / WINDOW_SIZE_IN_CELLS_PER_DIM
        y_in_tile_step = y_grid_of_tiles_step / WINDOW_SIZE_IN_CELLS_PER_DIM

        # Associate each entity to a location within a tile. First, find the cell within the grid of tiles, then find
        # the cell within the tile.
        for entity in entities:
            # Shift the values by the minimum value of both dimensions so that the minimum value is 0
            x = entity["low_dimensional_embedding_" + COORDINATES[0]] - min_values[COORDINATES[0]]
            y = entity["low_dimensional_embedding_" + COORDINATES[1]] - min_values[COORDINATES[1]]

            # Find the cell within the grid of tiles
            x_grid_of_tiles_cell = min(int(x / x_grid_of_tiles_step), number_of_tiles - 1)
            y_grid_of_tiles_cell = min(int(y / y_grid_of_tiles_step), number_of_tiles - 1)

            # Find the cell within the tile
            x_in_tile_cell = min(int((x - x_grid_of_tiles_cell * x_grid_of_tiles_step) / x_in_tile_step),
                                 WINDOW_SIZE_IN_CELLS_PER_DIM - 1)
            y_in_tile_cell = min(int((y - y_grid_of_tiles_cell * y_grid_of_tiles_step) / y_in_tile_step),
                                 WINDOW_SIZE_IN_CELLS_PER_DIM - 1)

            # Add the entity to the grid
            grid[x_grid_of_tiles_cell][y_grid_of_tiles_cell][x_in_tile_cell][y_in_tile_cell].append(entity["index"])

        # Now grid[i][j][k][l] is a list of indexes of entities that are in the cell (k, l) of the tile (i, j) of the
        # grid of tiles.
        # Show a heat map of the grid showing the number of entities in each cell
        # plot_heat_map(grid, number_of_tiles, zoom)
        # Create collection with the grid
        create_collection_with_grid(grid, zoom_levels_collection_name, zoom)


if __name__ == "__main__":
    if ENV_FILE_LOCATION not in os.environ:
        print("export .env file location as ENV_FILE_LOCATION. Export $HOME/image-viz/.env if running outside of docker"
              " container, export /.env if running inside docker container backend.")
        sys.exit(1)
    # Load environment variables
    load_dotenv(os.getenv(ENV_FILE_LOCATION))
    if ENV_FILE_LOCATION not in os.environ:
        print("export .env file location as ENV_FILE_LOCATION. Export $HOME/image-viz/.env if running outside of docker"
              " container, export /.env if running inside docker container backend.")
        sys.exit(1)
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

    # Choose a collection. If the collection does not exist, return.
    if flags["collection"] not in utility.list_collections():
        print("Collection does not exist.")
        sys.exit(1)
    else:
        collection = Collection(flags["collection"])

    # It is worth noting that the collection is among the DatasetOptions, so we can use the zoom levels from there.
    # Get zoom levels by selecting the collection from the DatasetOptions by name
    zoom_levels = DatasetOptions[flags["collection"].upper()].value["zoom_levels"]

    # Load vectors from collection
    entities = load_vectors_from_collection(collection)

    # Create zoom levels
    if entities is not None:
        create_zoom_levels(entities, flags["collection"] + "_zoom_levels", zoom_levels)
