import getpass
import json
import os
import sys

import numpy as np
from PIL import Image
from dotenv import load_dotenv
from pymilvus import db, Collection, utility

from .collections import (clusters_collection, image_to_tile_collection, ZOOM_LEVEL_VECTOR_FIELD_NAME,
                          EMBEDDING_VECTOR_FIELD_NAME)
from .utils import ModifiedKMeans
# from .datasets import DatasetOptions
from .utils import create_connection, parsing
from ..CONSTANTS import *

# from .create_and_populate_zoom_levels_collection import plot_heat_map

# Increase pixel limit
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

MAX_IMAGES_PER_TILE = 40
NUMBER_OF_CLUSTERS = 30
THRESHOLD = 0.8


class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.float32):
            return float(obj)
        return json.JSONEncoder.default(self, obj)


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


def create_clusters_collection(zoom_levels,
                               collection_name: str,
                               repopulate: bool) -> None:
    if utility.has_collection(collection_name) and repopulate:
        # Get number of entities in the collection
        num_entities = Collection(collection_name).num_entities
        print(f"Found collection {collection_name}. It has {num_entities} entities. Dropping it.")
        utility.drop_collection(collection_name)
    elif utility.has_collection(collection_name) and not repopulate:
        # Get number of entities in the collection
        num_entities = Collection(collection_name).num_entities
        print(f"Found collection {collection_name}. It has {num_entities} entities."
              f" Not dropping it. Set repopulate to True to drop it.")
        return

    # Create collection and index
    collection = clusters_collection(collection_name)

    # Populate collection
    index = 0
    entities_to_insert = []
    for zoom_level in zoom_levels:
        for tile in zoom_levels[zoom_level]:
            # Create entity
            entity = {
                "index": index,
                ZOOM_LEVEL_VECTOR_FIELD_NAME: [zoom_level, tile[0], tile[1]],
                "clusters_representatives": {
                    "entities": [json.dumps(representative, cls=NumpyEncoder) for representative in
                                 zoom_levels[zoom_level][tile]["cluster_representatives"]],
                }
            }
            if zoom_level == 0:
                entity["tile_coordinate_range"] = zoom_levels[zoom_level][tile]["tile_coordinate_range"]
            # Insert entity
            entities_to_insert.append(entity)
            # Increment index
            index += 1

    # Insert entities in the collection
    # Insert entities in batches of INSERT_SIZE
    for i in range(0, len(entities_to_insert), INSERT_SIZE):
        try:
            collection.insert(data=entities_to_insert[i:i + INSERT_SIZE])
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


def create_image_to_tile_collection(images_to_tile: dict, collection_name: str, repopulate: bool) -> None:
    if utility.has_collection(collection_name) and repopulate:
        # Get number of entities in the collection
        num_entities = Collection(collection_name).num_entities
        print(f"Found collection {collection_name}. It has {num_entities} entities. Dropping it.")
        utility.drop_collection(collection_name)
    elif utility.has_collection(collection_name) and not repopulate:
        # Get number of entities in the collection
        num_entities = Collection(collection_name).num_entities
        print(f"Found collection {collection_name}. It has {num_entities} entities."
              f" Not dropping it. Set repopulate to True to drop it.")
        return

    # Create collection and index
    collection = image_to_tile_collection(collection_name)

    # Populate collection
    entities_to_insert = []
    for index in images_to_tile.keys():
        assert len(images_to_tile[index]) == 3 and isinstance(index, int)
        # Create entity
        entity = {
            "index": index,
            ZOOM_LEVEL_VECTOR_FIELD_NAME: images_to_tile[index]
        }
        # Insert entity
        entities_to_insert.append(entity)

    # Insert entities in the collection
    # Insert entities in batches of INSERT_SIZE
    for i in range(0, len(entities_to_insert), INSERT_SIZE):
        try:
            collection.insert(data=entities_to_insert[i:i + INSERT_SIZE])
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
               y_min, y_max, directory):
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
        artwork = Image.open(os.getenv(directory) + path)
        # Save width and height information
        entity["representative"]["width"] = artwork.size[0]
        entity["representative"]["height"] = artwork.size[1]
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
    if os.path.exists(os.getenv(directory) + "/zoom_levels_clusters/"
                      + str(zoom_level) + "_" + str(tile_x_index) + "_"
                      + str(tile_y_index) + ".png"):
        os.remove(os.getenv(directory) + "/zoom_levels_clusters/"
                  + str(zoom_level) + "_" + str(tile_x_index) + "_"
                  + str(tile_y_index) + ".png")
    # Save image
    image.save(os.getenv(directory) + "/zoom_levels_clusters/"
               + str(zoom_level) + "_" + str(tile_x_index) + "_"
               + str(tile_y_index) + ".png")


def add_width_and_height_information(representative_entities, dataset_collection, directory):
    for entity in representative_entities:
        # Get path of image from database
        # Search image
        result = dataset_collection.query(
            expr=f"index in [{entity['representative']['index']}]",
            output_fields=["path"]
        )
        # Get image path
        path = "/" + result[0]["path"]
        # Open image
        artwork = Image.open(os.getenv(directory) + path)
        # Get width and height
        entity["representative"]["width"] = artwork.size[0]
        entity["representative"]["height"] = artwork.size[1]


def split_block(i, window, representative_entities, temp_cluster_representatives_entities,
                indexes_of_entities_already_in_representative_entities):
    # Calculate the integer portion and the remainder. There are window - 1 elements in the block to distribute among
    # the elements in indexes_of_entities_already_in_representative_entities
    portion, remainder = divmod(window - 1, len(indexes_of_entities_already_in_representative_entities))

    # Create an array where each element receives the integer portion
    portions = [portion] * len(indexes_of_entities_already_in_representative_entities)

    # Distribute the remainder
    for j in range(remainder):
        portions[j] += 1

    assert sum(portions) == window - 1

    # Subtract 1 from each element
    portions = [portion - 1 for portion in portions]

    index = i
    for sub_block in range(len(indexes_of_entities_already_in_representative_entities)):
        elements_block = 0
        while elements_block < portions[sub_block] and index < i + window - 1:
            # We still have to add elements to the block
            is_representative = False
            for j in indexes_of_entities_already_in_representative_entities:
                if (temp_cluster_representatives_entities[index]["representative"]["index"] ==
                        representative_entities[j]["representative"]["index"]):
                    is_representative = True
                    break
            # If is_representative is True, then the current entity is already in representative_entities and cannot be
            # added to the current sub-block.
            if not is_representative:
                representative_entities[indexes_of_entities_already_in_representative_entities[sub_block]] \
                    ["number_of_entities"] += temp_cluster_representatives_entities[index]["number_of_entities"] + 1
                # Increment elements_block as one element has been added to the block
                elements_block += 1

            # Increment index
            index += 1


def merge_clusters(old_cluster_representatives_in_current_tile, temp_cluster_representatives_entities,
                   cosine_similarity_matrix):
    # Find square blocks with True values on main diagonal of cosine_similarity_matrix
    # and merge the clusters corresponding to the blocks
    i = 0
    window = 1
    # Initialize representative_entities with old_cluster_representatives_in_current_tile
    representative_entities = [
        {
            "representative": old_cluster_representatives_in_current_tile[k],
            "number_of_entities": 0,
            "is_in_previous_zoom_level": True
        }
        for k in range(len(old_cluster_representatives_in_current_tile))
    ]

    while i < len(temp_cluster_representatives_entities):
        if (i + window <= len(temp_cluster_representatives_entities) and
                cosine_similarity_matrix[i:i + window, i:i + window].all()):
            # Update window
            window += 1
        else:
            # From current block, choose as cluster representative one of the already existing
            # entities in representative_entities. If there are more than one, split the block
            # into one block for each entity.
            # If there are no entities in representative_entities, then choose the entity at the
            # beginning of the block.
            indexes_of_entities_already_in_representative_entities = []
            if len(old_cluster_representatives_in_current_tile) > 0:
                for k in range(i, i + window - 1):
                    # If the index of the entity is in representative_entities, then add it to
                    # indexes_of_entities_already_in_representative_entities
                    for j in range(len(old_cluster_representatives_in_current_tile)):
                        if (temp_cluster_representatives_entities[k]["representative"]["index"] ==
                                representative_entities[j]["representative"]["index"]):
                            representative_entities[j]["number_of_entities"] = temp_cluster_representatives_entities[k][
                                "number_of_entities"]
                            indexes_of_entities_already_in_representative_entities.append(j)
                            break

            if len(indexes_of_entities_already_in_representative_entities) == 0:
                # The current block does not contain any entity that is in old_cluster_representatives_in_current_tile.
                representative_entities.append(
                    {
                        "representative": temp_cluster_representatives_entities[i]["representative"],
                        "number_of_entities": sum([cluster["number_of_entities"] + 1
                                                   for cluster in
                                                   temp_cluster_representatives_entities[i:i + window - 1]]) - 1,
                        "is_in_previous_zoom_level": False
                    }
                )
            else:
                # Split block into one block for each element in indexes_of_entities_already_in_representative_entities
                split_block(i, window, representative_entities, temp_cluster_representatives_entities,
                            indexes_of_entities_already_in_representative_entities)

            # Update i
            i += window - 1
            # Reset window
            window = 1

    return representative_entities


def create_zoom_levels(entities, dataset_collection, zoom_levels_collection_name,
                       images_to_tile_collection_name, repopulate, save_images, directory):
    # Take entire embedding space for zoom level 0, then divide each dimension into 2^zoom_levels intervals.
    # Each interval is a tile. For each tile, find clusters and cluster representatives. Keep track of
    # the number of entities in each cluster. For the last zoom level, show all the entities in each tile.
    # We keep all images with their aspect ratio, so that the images are not distorted. We only eliminate the
    # images that would be entirely covered by other images. If an image is on the line separating two tiles,
    # assign it to both tiles.
    # First, get tiling
    tiling, max_zoom_level, coordinate_ranges = create_tiling(entities)

    print(f"Max zoom level: {max_zoom_level}")

    # For each zoom level, loop over tiles and if a tile has more than MAX_IMAGES_PER_TILE images, perform clustering
    # with k-means and keep track of the number of entities in each cluster. Then, for each cluster, find the entity
    # closest to the centroid of the cluster and assign it as the cluster representative.

    # Define dictionary for zoom levels
    zoom_levels = {}
    # Define dictionary for mapping from images to coarser zoom level (and tile)
    images_to_tile = {}

    if save_images:
        if not os.path.exists(os.getenv(directory) + "/zoom_levels_clusters/"):
            # Create directory
            os.mkdir(os.getenv(directory) + "/zoom_levels_clusters/")

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

                # Get cluster representatives that where selected in the previous zoom level and are in the current tile
                # First, get index of tile from the previous zoom level which contains the current tile
                previous_zoom_level_tile_x_index = int(tile_x_index / 2)
                previous_zoom_level_tile_y_index = int(tile_y_index / 2)
                # Get cluster representatives from previous zoom level
                old_cluster_representatives_in_current_tile = []
                if zoom_level != 0:
                    previous_zoom_level_cluster_representatives = [representative["representative"] for representative
                                                                   in
                                                                   zoom_levels[zoom_level - 1][
                                                                       (previous_zoom_level_tile_x_index,
                                                                        previous_zoom_level_tile_y_index)][
                                                                       "cluster_representatives"]]
                    # Get cluster representatives that are in the current tile.
                    # old_cluster_representatives_in_current_tile must be cluster representatives in the current tile.
                    for representative in previous_zoom_level_cluster_representatives:
                        if (x_min <= representative["low_dimensional_embedding_x"] <= x_max
                                and y_min <= representative["low_dimensional_embedding_y"] <= y_max):
                            old_cluster_representatives_in_current_tile.append(representative)

                # Check if there are less than MAX_IMAGES_PER_TILE images in the tile.
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
                        representative_entities = merge_clusters(old_cluster_representatives_in_current_tile,
                                                                 [
                                                                     {
                                                                         "representative": entity,
                                                                         "number_of_entities": 0
                                                                     }
                                                                     for entity in entities_in_tile],
                                                                 cosine_similarity_matrix)

                    else:
                        # Create entities list with same structure as cluster_representatives_entities
                        representative_entities = []
                        for entity in entities_in_tile:
                            representative_entities.append({"representative": entity, "number_of_entities": 0})

                    if save_images:
                        save_image(representative_entities, dataset_collection, zoom_level, tile_x_index, tile_y_index,
                                   x_min, x_max, y_min, y_max, directory)

                    assert (sum([cluster["number_of_entities"] + 1 for cluster in representative_entities])
                            == len(entities_in_tile))

                    # Add width and height information to representative_entities. Do it only if save_images is False,
                    # because otherwise the information is already there.
                    if not save_images:
                        add_width_and_height_information(representative_entities, dataset_collection, directory)

                    # Save information for tile in zoom_levels. Cluster representatives are the entities themselves.
                    zoom_levels[zoom_level][(tile_x_index, tile_y_index)] = {
                        "cluster_representatives": representative_entities
                    }
                    if zoom_level == 0:
                        zoom_levels[zoom_level][(tile_x_index, tile_y_index)]["tile_coordinate_range"] = {
                            "x_min": x_min,
                            "x_max": x_max,
                            "y_min": y_min,
                            "y_max": y_max
                        }
                    # Save mapping from images to tile
                    for representative in representative_entities:
                        if representative["representative"]["index"] not in images_to_tile:
                            images_to_tile[representative["representative"]["index"]] = [
                                zoom_level, tile_x_index, tile_y_index
                            ]

                else:
                    # Get the coordinates of the entities in the tile
                    coordinates = np.array([[entity["low_dimensional_embedding_x"],
                                             entity["low_dimensional_embedding_y"]]
                                            for entity in entities_in_tile])

                    # Perform clustering
                    kmeans = ModifiedKMeans(n_clusters=NUMBER_OF_CLUSTERS, random_state=0, n_init=1, max_iter=1000)

                    if len(old_cluster_representatives_in_current_tile) > 0:
                        fixed_centers = np.array([[entity["low_dimensional_embedding_x"],
                                                   entity["low_dimensional_embedding_y"]]
                                                  for entity in old_cluster_representatives_in_current_tile])
                    else:
                        fixed_centers = None

                    kmeans.fit(coordinates, fixed_centers=fixed_centers)

                    # Get the coordinates of the cluster representatives
                    cluster_representatives = kmeans.cluster_centers_

                    # It is worth noting that cluster_representatives contains all cluster representatives that were
                    # selected in the previous zoom level and are in the current tile.
                    if len(old_cluster_representatives_in_current_tile) > 0:
                        assert (cluster_representatives[0][0] == old_cluster_representatives_in_current_tile[0][
                            "low_dimensional_embedding_x"] and
                                cluster_representatives[0][1] == old_cluster_representatives_in_current_tile[0][
                                    "low_dimensional_embedding_y"])

                    # Find the entity closest to the centroid of each cluster
                    temp_cluster_representatives_entities = []
                    for cluster in range(NUMBER_OF_CLUSTERS):
                        # Get the entities in the cluster
                        entities_in_cluster = [entity for entity in entities_in_tile
                                               if kmeans.predict(np.array([[entity["low_dimensional_embedding_x"],
                                                                            entity["low_dimensional_embedding_y"]]]))[0]
                                               == cluster]

                        if cluster < len(old_cluster_representatives_in_current_tile):
                            # Add old cluster representative to temp_cluster_representatives_entities
                            temp_cluster_representatives_entities.append(
                                {
                                    "representative": old_cluster_representatives_in_current_tile[cluster],
                                    "number_of_entities": len(entities_in_cluster) - 1,
                                    "is_in_previous_zoom_level": True
                                }
                            )

                        else:
                            # Get the entity closest to the centroid of the cluster
                            def l2(entity):
                                return ((entity["low_dimensional_embedding_x"]
                                         - cluster_representatives[cluster][0]) ** 2
                                        + (entity["low_dimensional_embedding_y"]
                                           - cluster_representatives[cluster][1]) ** 2)

                            temp_cluster_representatives_entities.append(
                                {
                                    "representative": min(entities_in_cluster, key=l2),
                                    "number_of_entities": len(entities_in_cluster) - 1,
                                    "is_in_previous_zoom_level": False
                                }
                            )

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
                    # and merge the clusters corresponding to the blocks. Keep all entities that were in the previous
                    # zoom level.
                    representative_entities = merge_clusters(old_cluster_representatives_in_current_tile,
                                                             temp_cluster_representatives_entities,
                                                             cosine_similarity_matrix)

                    # Save result as images for visualization
                    if save_images:
                        save_image(representative_entities, dataset_collection, zoom_level, tile_x_index,
                                   tile_y_index, x_min, x_max, y_min, y_max, directory)

                    assert (sum([cluster["number_of_entities"] + 1 for cluster in representative_entities])
                            == len(entities_in_tile))

                    # Add width and height information to cluster_representatives_entities. Do it only if save_images
                    # is False, because otherwise the information is already there.
                    if not save_images:
                        add_width_and_height_information(representative_entities, dataset_collection, directory)

                    # Save information for tile in zoom_levels.
                    zoom_levels[zoom_level][(tile_x_index, tile_y_index)] = {
                        "cluster_representatives": representative_entities
                    }
                    if zoom_level == 0:
                        zoom_levels[zoom_level][(tile_x_index, tile_y_index)]["tile_coordinate_range"] = {
                            "x_min": x_min,
                            "x_max": x_max,
                            "y_min": y_min,
                            "y_max": y_max
                        }
                    # Save mapping from images to tile
                    for representative in representative_entities:
                        if representative["representative"]["index"] not in images_to_tile:
                            images_to_tile[representative["representative"]["index"]] = [
                                zoom_level, tile_x_index, tile_y_index
                            ]

    create_clusters_collection(zoom_levels, zoom_levels_collection_name, repopulate)
    create_image_to_tile_collection(images_to_tile, images_to_tile_collection_name, repopulate)


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

    if flags["images"]:
        choice = input("Are you sure you want to save images? (y/n) ")
        if choice.lower() != "y":
            flags["images"] = False

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
        create_zoom_levels(entities, collection, flags["collection"] + "_zoom_levels_clusters",
                           flags["collection"] + "_image_to_tile", flags["repopulate"], flags["images"],
                           flags["directory"])
