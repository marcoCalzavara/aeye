import getpass
import os
import sys

import numpy as np
from dotenv import load_dotenv
from pymilvus import db, Collection, utility
from sklearn.cluster import KMeans
from PIL import Image

from .collections import zoom_level_collection_with_images, ZOOM_LEVEL_VECTOR_FIELD_NAME, EMBEDDING_VECTOR_FIELD_NAME
# from .datasets import DatasetOptions
from .utils import create_connection
from ..CONSTANTS import *
from .create_and_populate_zoom_levels_collection import parsing, load_vectors_from_collection

# from .create_and_populate_zoom_levels_collection import plot_heat_map


MAX_IMAGES_PER_TILE = 40
NUMBER_OF_CLUSTERS = 20
THRESHOLD = 0.8


def create_collection_with_zoom_levels(zoom_levels_paths: dict[int, dict[tuple[int, int], dict[str, dict]]],
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
    collection = zoom_level_collection_with_images(collection_name)

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


def create_tiling(entities) -> tuple[list[list[list[dict]]], int, list[list[dict]]]:
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

    # For reference, a tile is a list of dictionaries, each dictionary containing the following keys:
    # "index": index of the entity in the collection
    # "low_dimensional_embedding_x": x coordinate of the entity in the embedding space
    # "low_dimensional_embedding_y": y coordinate of the entity in the embedding space

    # Find zoom level that allows to have tiles with at most MAX_IMAGES_PER_TILE images. We start from zoom level 5.
    max_zoom_level = 5
    while True:
        # Define grid for entire embeddings space.
        # Get the number of tiles in each dimension
        number_of_tiles = 2 ** max_zoom_level
        grid = [[[] for _ in range(number_of_tiles)] for _ in range(number_of_tiles)]
        coordinate_ranges = [[] for _ in range(number_of_tiles)]

        # Divide the range of values for each dimension into 2^zoom_levels intervals
        x_grid_of_tiles_step = (max_values[COORDINATES[0]]
                                - min_values[COORDINATES[0]]) / number_of_tiles
        y_grid_of_tiles_step = (max_values[COORDINATES[1]]
                                - min_values[COORDINATES[1]]) / number_of_tiles

        # Populate coordinates_ranges
        for x in range(number_of_tiles):
            for y in range(number_of_tiles):
                coordinate_ranges[x].append({
                    "x": (min_values[COORDINATES[0]] + x * x_grid_of_tiles_step,
                          min_values[COORDINATES[0]] + (x + 1) * x_grid_of_tiles_step),
                    "y": (min_values[COORDINATES[1]] + y * y_grid_of_tiles_step,
                          min_values[COORDINATES[1]] + (y + 1) * y_grid_of_tiles_step)
                })

        # Associate each entity to a tile.
        for entity in entities:
            # Shift the values by the minimum value of both dimensions so that the minimum value is 0
            x = entity["low_dimensional_embedding_" + COORDINATES[0]] - min_values[COORDINATES[0]]
            y = entity["low_dimensional_embedding_" + COORDINATES[1]] - min_values[COORDINATES[1]]

            # Find the tile to which the entity belongs.
            tile_x = min(int(x // x_grid_of_tiles_step), number_of_tiles - 1)
            tile_y = min(int(y // y_grid_of_tiles_step), number_of_tiles - 1)

            # Add entity to the tile
            grid[tile_x][tile_y].append(entity)

            # Check if the number of images in each tile is less than MAX_IMAGES_PER_TILE
            if len(grid[tile_x][tile_y]) > MAX_IMAGES_PER_TILE:
                break

        # Check if the number of images in each tile is less than MAX_IMAGES_PER_TILE
        max_images_per_tile = 0
        for row in grid:
            for tile in row:
                if len(tile) > max_images_per_tile:
                    max_images_per_tile = len(tile)
                if max_images_per_tile > MAX_IMAGES_PER_TILE:
                    break

        if max_images_per_tile <= MAX_IMAGES_PER_TILE:
            break
        else:
            max_zoom_level += 1

    # Plot heat map of the grid
    # plot_heat_map(grid, number_of_tiles, max_zoom_level)
    # Return grid
    return grid, max_zoom_level, coordinate_ranges


def save_image(representative_entities, dataset_collection, zoom_level, tile_x_index, tile_y_index, x_min, x_max,
               y_min, y_max):
    # Create image
    image = Image.new("RGB", (IMAGE_WIDTH * 2, IMAGE_HEIGHT * 2))
    max_width = (IMAGE_WIDTH * 2) / 10
    max_height = (IMAGE_HEIGHT * 2) / 10

    for entity in representative_entities:
        # Get index of entity
        index = entity["representative"]["index"]
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
        # Resize image so that it has a maximum width of max_width or a maximum height of
        # max_height, but keep the aspect ratio
        artwork.thumbnail((max_width, max_height), Image.ANTIALIAS)
        # Add artwork to list
        x = entity["representative"]["low_dimensional_embedding_x"]
        y = entity["representative"]["low_dimensional_embedding_y"]
        # Get x and y coordinates of the representative entity in the image. Keep safe distance from
        # borders, i.e., use image size of IMAGE_WIDTH * 2 - max_width and IMAGE_HEIGHT * 2 -
        # max_height.
        x = int((x - x_min) / (x_max - x_min) * (IMAGE_WIDTH * 2 - max_width))
        y = int((y - y_min) / (y_max - y_min) * (IMAGE_HEIGHT * 2 - max_height))

        # Paste artwork in image
        image.paste(artwork, (x, y))

    # Delete image if it exists
    if os.path.exists(os.getenv(BEST_ARTWORKS_DIR) + "/zoom_levels_clusters/"
                      + str(zoom_level) + "_" + str(tile_x_index) + "_"
                      + str(tile_y_index) + ".png"):
        os.remove(os.getenv(BEST_ARTWORKS_DIR) + "/zoom_levels_clusters/"
                  + str(zoom_level) + "_" + str(tile_x_index) + "_"
                  + str(tile_y_index) + ".png")
    # Save image
    image.save(os.getenv(BEST_ARTWORKS_DIR) + "/zoom_levels_clusters/"
               + str(zoom_level) + "_" + str(tile_x_index) + "_"
               + str(tile_y_index) + ".png")


def create_zoom_levels(entities, dataset_collection, zoom_levels_collection_name, repopulate, save_images):
    # Take entire embedding space for zoom level 0, then divide each dimension into 2^zoom_levels intervals.
    # Each interval is a tile. For each tile, find clusters and cluster representatives. Keep track of
    # the number of entities in each cluster. For the last zoom level, show all the entities in each tile.
    # We keep all images with their aspect ratio, so that the images are not distorted. We only eliminate the
    # images that would be entirely covered by other images. If an image is on the line separating two tiles,
    # assign it to both tiles.
    # First, get tiling
    tiling, max_zoom_level, coordinate_ranges = create_tiling(entities)

    # For each zoom level, loop over tiles and if a tile has more than MAX_IMAGES_PER_TILE images, perform clustering
    # with k-means and keep track of the number of entities in each cluster. Then, for each cluster, find the entity
    # closest to the centroid of the cluster and assign it as the cluster representative.

    # Define dictionary for zoom levels
    zoom_levels = {}

    # Delete directory if it exists
    if save_images:
        if not os.path.exists(os.getenv(BEST_ARTWORKS_DIR) + "/zoom_levels_clusters/"):
            # Create directory
            os.mkdir(os.getenv(BEST_ARTWORKS_DIR) + "/zoom_levels_clusters/")

    for zoom_level in range(max_zoom_level + 1):
        zoom_levels[zoom_level] = {}
        # First tile goes from 0 to 2 ** (max_zoom_level - zoom_level) - 1, second tile goes from
        # 2 ** (max_zoom_level - zoom_level) to 2 ** (max_zoom_level - zoom_level) * 2 - 1, and so on.
        for tile_x in range(0, 2 ** max_zoom_level, 2 ** (max_zoom_level - zoom_level)):
            for tile_y in range(0, 2 ** max_zoom_level, 2 ** (max_zoom_level - zoom_level)):
                # Get all entities in the tile
                entities_in_tile = []
                for x in range(tile_x, tile_x + 2 ** (max_zoom_level - zoom_level)):
                    for y in range(tile_y, tile_y + 2 ** (max_zoom_level - zoom_level)):
                        # Get all entities in the tile
                        entities_in_tile += tiling[x][y]

                # Get x and y range for current tile
                x_min = coordinate_ranges[tile_x][tile_y]["x"][0]
                x_max = coordinate_ranges[tile_x + 2 ** (max_zoom_level - zoom_level) - 1][tile_y]["x"][1]
                y_min = coordinate_ranges[tile_x][tile_y]["y"][0]
                y_max = coordinate_ranges[tile_x][tile_y + 2 ** (max_zoom_level - zoom_level) - 1]["y"][1]

                # Get index of tile
                tile_x_index = int(tile_x / 2 ** (max_zoom_level - zoom_level))
                tile_y_index = int(tile_y / 2 ** (max_zoom_level - zoom_level))

                # If the number of entities in the tile is less than MAX_IMAGES_PER_TILE, skip the tile.
                if len(entities_in_tile) <= MAX_IMAGES_PER_TILE:
                    if zoom_level != max_zoom_level and len(entities_in_tile) > 1:
                        # Merge clusters if the embeddings of the representatives are too similar in terms of cosine
                        # similarity
                        # First, get full embedding vectors of the representatives
                        indexes = [entity["index"] for entity in entities_in_tile]
                        result = dataset_collection.query(
                            expr=f"index in {indexes}",
                            output_fields=[EMBEDDING_VECTOR_FIELD_NAME]
                        )
                        # Measure pairwise cosine similarities and save them in a matrix
                        vectors = np.array([entity[EMBEDDING_VECTOR_FIELD_NAME] for entity in result])
                        cosine_similarity_matrix = (np.dot(vectors, vectors.T) / (
                                np.linalg.norm(vectors, axis=1) * np.linalg.norm(vectors, axis=1)[:, np.newaxis])
                                                    >= THRESHOLD)

                        # Find square blocks with True values on main diagonal of cosine_similarity_matrix
                        # and merge the clusters corresponding to the blocks
                        i = 0
                        window = 1
                        representative_entities = []
                        while i < len(entities_in_tile):
                            if (i + window <= len(entities_in_tile) and
                                    cosine_similarity_matrix[i:i + window, i:i + window].all()):
                                # Update window
                                window += 1
                            else:
                                # Merge clusters
                                representative_entities.append({
                                    "representative": entities_in_tile[i],
                                    "number_of_entities": len(entities_in_tile[i:i + window - 1]) - 1
                                })
                                # Update i
                                i += window - 1
                                # Reset window
                                window = 1
                    else:
                        # Create entities list with same structure as cluster_representatives_entities
                        representative_entities = []
                        for entity in entities_in_tile:
                            representative_entities.append({"representative": entity, "number_of_entities": 0})

                    if save_images:
                        save_image(representative_entities, dataset_collection, zoom_level, tile_x_index, tile_y_index,
                                   x_min, x_max, y_min, y_max)

                    # Save information for tile in zoom_levels. Cluster representatives are the entities themselves.
                    zoom_levels[zoom_level][(tile_x_index, tile_y_index)] = {
                        "cluster_representatives": representative_entities,
                        "number_of_entities": len(representative_entities),
                        "x_range": (x_min, x_max),
                        "y_range": (y_min, y_max)
                    }

                else:
                    # Get the coordinates of the entities in the tile
                    coordinates = np.array([[entity["low_dimensional_embedding_x"],
                                             entity["low_dimensional_embedding_y"]]
                                            for entity in entities_in_tile])

                    # Perform clustering
                    kmeans = KMeans(n_clusters=NUMBER_OF_CLUSTERS, random_state=0, n_init=10, max_iter=1000)
                    kmeans.fit(coordinates)

                    # Get the coordinates of the cluster representatives
                    cluster_representatives = kmeans.cluster_centers_.astype(np.float64)

                    # Find the entity closest to the centroid of each cluster
                    temp_cluster_representatives_entities = []
                    for cluster in range(NUMBER_OF_CLUSTERS):
                        # Get the entities in the cluster
                        entities_in_cluster = [entity for entity in entities_in_tile
                                               if kmeans.predict(np.array([[entity["low_dimensional_embedding_x"],
                                                                            entity["low_dimensional_embedding_y"]]]))[0]
                                               == cluster]

                        # Get the entity closest to the centroid of the cluster
                        def l2(entity):
                            return ((entity["low_dimensional_embedding_x"]
                                     - cluster_representatives[cluster][0]) ** 2
                                    + (entity["low_dimensional_embedding_y"]
                                       - cluster_representatives[cluster][1]) ** 2)

                        temp_cluster_representatives_entities.append({"representative": min(entities_in_cluster,
                                                                                            key=l2),
                                                                      "number_of_entities": len(
                                                                          entities_in_cluster) - 1})

                    # Merge clusters if the embeddings of the representatives are too similar in terms of cosine
                    # similarity
                    # First, get full embedding vectors of the representatives
                    indexes = [cluster["representative"]["index"] for cluster in temp_cluster_representatives_entities]
                    result = dataset_collection.query(
                        expr=f"index in {indexes}",
                        output_fields=[EMBEDDING_VECTOR_FIELD_NAME]
                    )
                    # Measure pairwise cosine similarities and save them in a matrix
                    vectors = np.array([entity[EMBEDDING_VECTOR_FIELD_NAME] for entity in result])
                    cosine_similarity_matrix = (np.dot(vectors, vectors.T) / (
                            np.linalg.norm(vectors, axis=1) * np.linalg.norm(vectors, axis=1)[:, np.newaxis])
                                                >= THRESHOLD)

                    # Find square blocks with True values on main diagonal of cosine_similarity_matrix
                    # and merge the clusters corresponding to the blocks
                    i = 0
                    window = 1
                    cluster_representatives_entities = []
                    while i < NUMBER_OF_CLUSTERS:
                        if (i + window <= NUMBER_OF_CLUSTERS and
                                cosine_similarity_matrix[i:i + window, i:i + window].all()):
                            # Update window
                            window += 1
                        else:
                            # Merge clusters
                            cluster_representatives_entities.append({
                                "representative": temp_cluster_representatives_entities[i]["representative"],
                                "number_of_entities": sum([cluster["number_of_entities"] + 1
                                                           for cluster in
                                                           temp_cluster_representatives_entities[i:i + window - 1]]) - 1
                            })
                            # Update i
                            i += window - 1
                            # Reset window
                            window = 1

                    # Save result as images for visualization
                    if save_images:
                        save_image(cluster_representatives_entities, dataset_collection, zoom_level, tile_x_index,
                                   tile_y_index, x_min, x_max, y_min, y_max)

                    # Save information for tile in zoom_levels.
                    zoom_levels[zoom_level][(tile_x_index, tile_y_index)] = {
                        "cluster_representatives": cluster_representatives_entities,
                        "number_of_entities": len(entities_in_tile),
                        "x_range": (x_min, x_max),
                        "y_range": (y_min, y_max)
                    }

    # create_collection_with_zoom_levels(zoom_levels, zoom_levels_collection_name, repopulate)


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
    # zoom_levels = DatasetOptions[flags["collection"].upper()].value["zoom_levels"]

    # Load vectors from collection
    entities = load_vectors_from_collection(collection)

    # Create zoom levels
    if entities is not None:
        create_zoom_levels(entities, collection, flags["collection"] + "_zoom_levels_images", flags["repopulate"],
                           flags["images"])
