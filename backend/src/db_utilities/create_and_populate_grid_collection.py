# Deprecation warning: This script is deprecated. It is kept here for reference.

import getopt
import getpass
import os
import sys
from warnings import warn

import matplotlib.pyplot as plt
import numpy as np
from dotenv import load_dotenv
from pymilvus import db, Collection, utility

from .collections import grid_collection
from .datasets import DatasetOptions
from .utils import create_connection
from ..CONSTANTS import *


def parsing():
    # Remove 1st argument from the list of command line arguments
    arguments = sys.argv[1:]

    # Options
    options = "hd:c:r:i:"

    # Long options
    long_options = ["help", "database", "collection", "repopulate", "images"]

    # Prepare flags
    flags = {"database": DEFAULT_DATABASE_NAME,
             "collection": DatasetOptions.BEST_ARTWORKS.value["name"],
             "repopulate": False,
             "images": True}

    # Parsing argument
    arguments, values = getopt.getopt(arguments, options, long_options)

    if len(arguments) > 0 and arguments[0][0] in ("-h", "--help"):
        print(f'This script generates zoom levels.\n\
        -d or --database: database name (default={flags["database"]}).\n\
        -c or --collection: collection name (default={flags["collection"]}).\n\
        -r or --repopulate: repopulate the collection. Options are y/n (default='
              f'{"y" if flags["repopulate"] == "y" else "n"}).\n\
        -i or --images: save images. Options are y/n (default='
              f'{"y" if flags["images"] == "y" else "n"}).')
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
        elif arg in ("-r", "--repopulate"):
            if val == "y":
                flags["repopulate"] = True
            elif val == "n":
                flags["repopulate"] = False
            else:
                raise ValueError("The repopulate flag must be either y or n.")
        elif arg in ("-i", "--images"):
            if val == "y":
                flags["images"] = True
            elif val == "n":
                flags["images"] = False
            else:
                raise ValueError("The images flag must be either y or n.")

    return flags


def load_vectors_from_collection(collection: Collection) -> list | None:
    # Load collection in memory
    collection.load()
    # Get low dimensional embeddings attributes
    low_dim_attributes = (["index", "author", "path"] +
                          ["low_dimensional_embedding_" + COORDINATES[i] for i in range(len(COORDINATES))])

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
    plt.imshow(np.array(grid_for_heat_map), cmap="hot", interpolation='nearest')
    # Add a color bar
    plt.colorbar()
    # Save the plot
    plt.savefig("heat_map_zoom_level_" + str(zoom_level) + ".png")
    # Clear the plot
    plt.clf()


def create_grid_collection(grids: list[list[list[list[list[list]]]]], collection_name: str, repopulate: bool) -> None:
    if utility.has_collection(collection_name) and repopulate:
        print(f"Found collection {collection_name}. Dropping it.")
        utility.drop_collection(collection_name)
    elif utility.has_collection(collection_name) and not repopulate:
        # Get number of entities in the collection
        num_entities = Collection(collection_name).num_entities
        print(f"Found collection {collection_name}. It has {num_entities} entities."
              f" Not dropping it. Set repopulate to True to drop it.")
        return

    # Create collection and index
    collection = grid_collection(collection_name)

    # Get entities to insert in the collection. Each entity is represented as a dictionary.
    entities = []
    # Iterate over grids, tiles in each grid, and cells in each tile
    for i in range(len(grids)):
        for x_tile in range(len(grids[i])):
            for y_tile in range(len(grids[i][x_tile])):
                # [i, x_tile, y_tile] contains the zoom level information and the tile information. This triplet
                # uniquely identifies a tile, thus we can use it for vector search.
                entity = {
                    "index": i * len(grids[i]) * len(grids[i][x_tile]) + x_tile * len(grids[i][x_tile]) + y_tile,
                    "zoom_plus_tile": [i, x_tile, y_tile],
                }
                # Get images and their locations in the tile. Even though not all images can be displayed, we still
                # get more than one image per cell for possible future use.
                images = {
                    "indexes": [],
                    "x_cell": [],
                    "y_cell": []
                }
                for x_cell in range(len(grids[i][x_tile][y_tile])):
                    for y_cell in range(len(grids[i][x_tile][y_tile][x_cell])):
                        # Take always first image in the list of images in the cell. This is always the same image
                        # across different zoom levels as the entities are looped in the same order.
                        if len(grids[i][x_tile][y_tile][x_cell][y_cell]) > 0:
                            images["indexes"].append(grids[i][x_tile][y_tile][x_cell][y_cell][0])
                            images["x_cell"].append(x_cell)
                            images["y_cell"].append(y_cell)

                # Add images to the entity
                entity["images"] = images
                # Add entity to the list of entities
                entities.append(entity)

    # Insert entities in the collection
    # Insert entities in batches of INSERT_SIZE
    for i in range(0, len(entities), INSERT_SIZE):
        try:
            collection.insert(data=entities[i:i + INSERT_SIZE])
            # Flush data to disk
            collection.flush()
        except Exception as e:
            print(e.__str__())
            print("Error in create_collection_with_grid.")
            # Drop collection to avoid inconsistencies
            utility.drop_collection(collection_name)
            return

    # Success
    print(f"Successfully created collection {collection_name}.")


def create_zoom_levels(entities, zoom_levels_collection_name, zoom_levels, repopulate) -> None:
    # Remember that DatasetOptions.BEST_ARTWORKS.value["zoom_levels"] contains the number of zoom levels required by
    # the dataset.

    # Randomly shuffle the entities so that when selecting the first image from each cell, we don't always get one from
    # the same artist.
    np.random.shuffle(entities)

    # Find the maximum and minimum values for each dimension
    max_values = {}
    min_values = {}
    for coordinate in COORDINATES:
        max_values[coordinate] = max([entity["low_dimensional_embedding_" + coordinate] for entity in entities])
        min_values[coordinate] = min([entity["low_dimensional_embedding_" + coordinate] for entity in entities])

    # For reference, a tile is [[[] for _ in range(WINDOW_SIZE_IN_CELLS_PER_DIM)] for _ in range(
    # WINDOW_SIZE_IN_CELLS_PER_DIM)]

    # Define list of grids, one for each zoom level
    grids = []

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
        # Add the grid to the list of grids
        grids.append(grid)

        # Show a heat map of the grid showing the number of entities in each cell
        # plot_heat_map(grid, number_of_tiles, zoom)

    # Create collection with the grids
    create_grid_collection(grids, zoom_levels_collection_name, repopulate)


if __name__ == "__main__":
    # Show deprecation warning
    warn("This script is deprecated. Use create_and_populate_clusters_collection instead.", DeprecationWarning)
    choice = input("Are you sure you want to continue? (y/n) ")
    if choice.lower() != "y":
        sys.exit(0)

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
        create_zoom_levels(entities, flags["collection"] + "_zoom_levels_grid", zoom_levels, flags["repopulate"])
