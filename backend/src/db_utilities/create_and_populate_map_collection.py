import getpass
import os
import sys
from warnings import warn

import numpy as np
from PIL import Image
from dotenv import load_dotenv
from pymilvus import db, Collection, utility

from .collections import map_collection, ZOOM_LEVEL_VECTOR_FIELD_NAME
from .create_and_populate_grid_collection import parsing, load_vectors_from_collection
from .datasets import DatasetOptions
from .utils import create_connection
from ..CONSTANTS import *


# from .create_and_populate_zoom_levels_collection import plot_heat_map


def create_map_collection(zoom_levels_paths: dict[int, dict[tuple[int, int], dict[str, dict]]],
                          collection_name: str,
                          repopulate: bool) -> None:
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
    collection = map_collection(collection_name)

    # Populate collection
    index = 0
    entities = []
    for zoom_level in zoom_levels_paths:
        for image_coordinates in zoom_levels_paths[zoom_level]:
            # Create entity
            entity = {
                "index": index,
                ZOOM_LEVEL_VECTOR_FIELD_NAME: [zoom_level, image_coordinates[0], image_coordinates[1]],
                "images": zoom_levels_paths[zoom_level][image_coordinates]["image_info"],
                "path_to_image": zoom_levels_paths[zoom_level][image_coordinates]["path"]
            }
            # Insert entity
            entities.append(entity)
            # Increment index
            index += 1

    # Insert entities in the collection
    # Insert entities in batches of INSERT_SIZE
    for i in range(0, len(entities), INSERT_SIZE):
        try:
            collection.insert(data=entities[i:i + INSERT_SIZE])
            # Flush data to disk
            collection.flush()
        except Exception as e:
            print(e.__str__())
            print("Error in create_collection_with_zoom_levels.")
            # Drop collection to avoid inconsistencies
            utility.drop_collection(collection_name)
            return

    # Success
    print(f"Successfully created collection {collection_name}.")


def create_grid(entities, max_zoom_level) -> list[list[list[list[list[list]]]]]:
    # Remember that DatasetOptions.BEST_ARTWORKS.value["zoom_levels"] contains the number of zoom levels required by
    # the dataset.

    # The first zoom level consists of a low resolution image with all the artworks displayed. The second zoom level
    # consists of a grid of 2x2 tiles, each containing a portion of the embedding space, whose size is the same across
    # all zoom levels. The third zoom level consists of a grid of 4x4 tiles, each containing a portion of the embedding
    # space, and so on. The number of zoom levels is defined by the dataset.
    # Each tile is an image of fixed size, so we can increase the overall perceived resolution by increasing the number
    # of tiles. The number of tiles is 2^zoom_levels, so the number of tiles is doubled at each zoom level.
    # Each image is 1280x920 pixels.

    # Randomly shuffle the entities.
    np.random.shuffle(entities)

    # Find the maximum and minimum values for each dimension
    max_values = {}
    min_values = {}
    for coordinate in COORDINATES:
        max_values[coordinate] = max([entity["low_dimensional_embedding_" + coordinate] for entity in entities])
        min_values[coordinate] = min([entity["low_dimensional_embedding_" + coordinate] for entity in entities])

    # For reference, a tile is [[[] for _ in range(WINDOW_SIZE_IN_CELLS_PER_DIM)] for _ in range(
    # WINDOW_SIZE_IN_CELLS_PER_DIM)]

    # Define grid for entire embeddings space. The grid has 2^zoom_levels tiles in each dimension. Each tile contains
    # WINDOW_SIZE_IN_CELLS_PER_DIM cells in each dimension. Each cell contains a list of indexes of entities that are
    # in that cell. The total number of cells is (2^zoom_levels * WINDOW_SIZE_IN_CELLS_PER_DIM)^2.
    # Get the number of tiles in each dimension
    number_of_tiles = 2 ** max_zoom_level
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

    # Plot heat map of the grid
    # plot_heat_map(grid, number_of_tiles, max_zoom_level)
    # Return grid
    return grid


def create_zoom_levels(entities, dataset_collection, zoom_levels_collection_name, num_zoom_levels, repopulate):
    # Create grid of embeddings space
    grid = create_grid(entities, num_zoom_levels)
    # Create images for each zoom level. Zoom level 0 has a single image with all the artworks displayed. Zoom level
    # 1 has 4 images, each containing a portion of the embedding space. Zoom level 2 has 16 images, each containing
    # a portion of the embedding space, and so on.
    # Define dictionary for zoom levels
    zoom_levels = {}
    # Choose image size. The image width is WINDOW_SIZE_IN_CELLS_PER_DIM * 2^(zoom_levels + 3) pixels. This ensures that
    # the width of the smallest artwork is 4 pixels. The image height is
    # WINDOW_SIZE_IN_CELLS_PER_DIM * 2^(zoom_levels + 2) * 1.5 pixels.
    image_width = WINDOW_SIZE_IN_CELLS_PER_DIM * 2 ** (num_zoom_levels + 3)
    image_height = int(WINDOW_SIZE_IN_CELLS_PER_DIM * 2 ** (num_zoom_levels + 2) * 1.5)
    for i in range(num_zoom_levels + 1):
        zoom_levels[i] = {}
        # Take 2 ** (num_zoom_levels + 1 - i) tiles in each dimension and create an image with them.
        # Get number of images in each dimension
        number_of_images = 2 ** i
        # Get number of tiles in each dimension in each image
        number_of_tiles = 2 ** (num_zoom_levels - i)
        # Determine size of each artwork that appears in the image
        artwork_width = int(image_width / (number_of_tiles * WINDOW_SIZE_IN_CELLS_PER_DIM))
        artwork_height = int(image_height / (number_of_tiles * WINDOW_SIZE_IN_CELLS_PER_DIM))

        # Create images
        for x_image in range(0, number_of_images):
            for y_image in range(0, number_of_images):
                # Create image for tile
                image = Image.new("RGB", (image_width, image_height))
                # Create object for storing images information. Insert width and height of each artwork
                if i == num_zoom_levels:
                    image_info = {
                        "has_info": True,
                        "artwork_width": artwork_width,
                        "artwork_height": artwork_height,
                        "indexes": [],
                        "x_cell": [],
                        "y_cell": []
                    }
                else:
                    image_info = {
                        "has_info": False
                    }
                # Iterate over tiles
                for x_tile in range(x_image * number_of_tiles, (x_image + 1) * number_of_tiles):
                    for y_tile in range(y_image * number_of_tiles, (y_image + 1) * number_of_tiles):
                        # Iterate over cells in tile
                        for x_cell in range(WINDOW_SIZE_IN_CELLS_PER_DIM):
                            for y_cell in range(WINDOW_SIZE_IN_CELLS_PER_DIM):
                                # Get first image if there are images in the cell, otherwise place and empty image
                                if len(grid[x_tile][y_tile][x_cell][y_cell]) > 0:
                                    # Get index of first image in the cell
                                    index = grid[x_tile][y_tile][x_cell][y_cell][0]
                                    # Get path of image from database
                                    # Search image
                                    result = dataset_collection.query(
                                        expr=f"index in [{index}]",
                                        output_fields=["path"]
                                    )
                                    # Get image path
                                    path = "/" + result[0]["path"]
                                    # Open image
                                    artwork = Image.open(os.getenv(BEST_ARTWORKS_DIR) + path)
                                    # Resize image
                                    artwork = artwork.resize((artwork_width, artwork_height))
                                    # Paste image in the right position, which depends on (x_tile, y_tile, x_cell,
                                    # y_cell), but does not depend on x_image and y_image
                                    image.paste(artwork, ((x_tile - x_image * number_of_tiles) *
                                                          WINDOW_SIZE_IN_CELLS_PER_DIM * artwork_width +
                                                          x_cell * artwork_width,
                                                          (y_tile - y_image * number_of_tiles) *
                                                          WINDOW_SIZE_IN_CELLS_PER_DIM * artwork_height +
                                                          y_cell * artwork_height))
                                    # Add image information to images object only for last zoom level (the one with the
                                    # highest resolution)
                                    if i == num_zoom_levels:
                                        image_info["indexes"].append(index)
                                        # Insert cell coordinates in the image
                                        image_info["x_cell"].append((x_tile - x_image * number_of_tiles) *
                                                                    WINDOW_SIZE_IN_CELLS_PER_DIM + x_cell)
                                        image_info["y_cell"].append((y_tile - y_image * number_of_tiles) *
                                                                    WINDOW_SIZE_IN_CELLS_PER_DIM + y_cell)
                                else:
                                    # Paste empty black image in the right position.
                                    image.paste(Image.new("RGB", (artwork_width, artwork_height)),
                                                ((x_tile - x_image * number_of_tiles) *
                                                 WINDOW_SIZE_IN_CELLS_PER_DIM * artwork_width +
                                                 x_cell * artwork_width,
                                                 (y_tile - y_image * number_of_tiles) *
                                                 WINDOW_SIZE_IN_CELLS_PER_DIM * artwork_height +
                                                 y_cell * artwork_height))

                # Save image in zoom_levels dictionary. Use image coordinates as key.
                zoom_levels[i][(x_image, y_image)] = {"image": image, "image_info": image_info}

    # Now zoom_levels contains all the images for all the zoom levels. Save the images in the directory of the dataset,
    # and create a collection with the paths to the images.
    # Save images, and create new dictionary with mappings from image coordinates to image paths
    zoom_levels_paths = {}
    # Create zoom_levels directory if it does not exist
    if not os.path.exists(os.getenv(BEST_ARTWORKS_DIR) + "/zoom_levels/"):
        os.mkdir(os.getenv(BEST_ARTWORKS_DIR) + "/zoom_levels/")

    for zoom_level in zoom_levels:
        zoom_levels_paths[zoom_level] = {}
        for image_coordinates in zoom_levels[zoom_level]:
            # Get path to save image
            path_to_save = "zoom_levels/" + str(zoom_level) + "_" + str(image_coordinates[0]) \
                           + "_" + str(image_coordinates[1]) + ".jpg"
            path = os.getenv(BEST_ARTWORKS_DIR) + "/" + path_to_save
            # Save image as jpg
            zoom_levels[zoom_level][image_coordinates]["image"].save(path)
            # Add path to dictionary
            zoom_levels_paths[zoom_level][image_coordinates] = {"path": path_to_save,
                                                                "image_info": zoom_levels[zoom_level][
                                                                    image_coordinates]["image_info"]}

    # Now zoom_levels_paths contains all the paths to the images for all the zoom levels. Create a collection with the
    # paths to the images.
    create_map_collection(zoom_levels_paths, zoom_levels_collection_name, repopulate)


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
        create_zoom_levels(entities, collection, flags["collection"] + "_zoom_levels_map", zoom_levels,
                           flags["repopulate"])
