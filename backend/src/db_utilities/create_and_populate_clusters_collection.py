import getpass
import os
import sys

import numpy as np
from PIL import Image
from dotenv import load_dotenv
from pymilvus import db, Collection, utility
from tqdm import tqdm

"""from .collections import (clusters_collection, image_to_tile_collection, ZOOM_LEVEL_VECTOR_FIELD_NAME,
                          EMBEDDING_VECTOR_FIELD_NAME)"""
from .collections import clusters_collection, image_to_tile_collection, ZOOM_LEVEL_VECTOR_FIELD_NAME
from .utils import ModifiedKMeans
# from .datasets import DatasetOptions
from .utils import create_connection, parsing
from ..CONSTANTS import *

# from .create_and_populate_zoom_levels_collection import plot_heat_map

# Increase pixel limit
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

MAX_IMAGES_PER_TILE = 30
NUMBER_OF_CLUSTERS = 30
# THRESHOLD = 0.8
LIMIT_FOR_INSERT = 1000000


def load_vectors_from_collection(collection: Collection) -> list | None:
    # Load collection in memory
    collection.load()
    # Get attributes
    attributes = (["index", "path", "width", "height"] + [COORDINATES[i] for i in range(len(COORDINATES))])

    # Get elements from collection
    entities = []
    try:
        for i in range(0, collection.num_entities, SEARCH_LIMIT):
            if collection.num_entities > 0:
                # Get SEARCH_LIMIT entities
                query_result = collection.query(
                    expr=f"index in {list(range(i, i + SEARCH_LIMIT))}",
                    output_fields=attributes
                )
                # Add entities to the list of entities
                entities += query_result
    except Exception as e:
        print(e.__str__())
        print("Error in load_vectors_from_collection.")
        return None

    # Now entities contains all the entities in the collection, with fields 'index' and 'low_dimensional_embedding_*'
    return entities


def create_clusters_collection(collection_name: str, repopulate: bool) -> Collection:
    if utility.has_collection(collection_name) and repopulate:
        # Get number of entities in the collection
        num_entities = Collection(collection_name).num_entities
        print(f"Found collection {collection_name}. It has {num_entities} entities. Dropping it.")
        utility.drop_collection(collection_name)

    # Create collection and index
    return clusters_collection(collection_name)


def get_index_from_tile(zoom_level, tile_x, tile_y):
    index = 0
    for i in range(zoom_level):
        index += 4 ** i
    index += 2 ** zoom_level * tile_x + tile_y
    return index


def insert_vectors_in_clusters_collection(zoom_levels, images_to_tile, collection: Collection, num_tiles,
                                          entities_per_zoom_level) -> bool:
    try:
        # Define list of entities to insert in the collection
        entities_to_insert = []
        # Iterate over elements in zoom_levels
        for zoom_level in zoom_levels.keys():
            for tile_x in zoom_levels[zoom_level].keys():
                for tile_y in zoom_levels[zoom_level][tile_x].keys():
                    # Check if the tile has already been inserted
                    if zoom_levels[zoom_level][tile_x][tile_y]["already_inserted"]:
                        continue
                    new_representatives = []
                    for representative in zoom_levels[zoom_level][tile_x][tile_y]["representatives"]:
                        new_representative = {
                            "index": int(representative["representative"]["index"]),
                            "path": str(representative["representative"]["path"]),
                            "x": float(representative["representative"]["x"]),
                            "y": float(representative["representative"]["y"]),
                            "width": int(representative["representative"]["width"]),
                            "height": int(representative["representative"]["height"]),
                            "zoom": int(images_to_tile[representative["representative"]["index"]][0])
                        }
                        new_representatives.append(new_representative)

                    # Create entity
                    entity = {
                        "index": get_index_from_tile(zoom_level, tile_x, tile_y),
                        ZOOM_LEVEL_VECTOR_FIELD_NAME: [zoom_level, tile_x, tile_y],
                        "data": new_representatives
                    }

                    if zoom_level == 0:
                        entity["range"] = {
                            "x_min": float(zoom_levels[zoom_level][tile_x][tile_y]["range"]["x_min"]),
                            "x_max": float(zoom_levels[zoom_level][tile_x][tile_y]["range"]["x_max"]),
                            "y_min": float(zoom_levels[zoom_level][tile_x][tile_y]["range"]["y_min"]),
                            "y_max": float(zoom_levels[zoom_level][tile_x][tile_y]["range"]["y_max"])
                        }

                    # Insert entity
                    entities_to_insert.append(entity)
                    # Mark as inserted
                    zoom_levels[zoom_level][tile_x][tile_y]["already_inserted"] = True

        assert num_tiles == len(entities_to_insert)

        # Insert entities in the collection
        for i in range(0, len(entities_to_insert), INSERT_SIZE):
            try:
                collection.insert(data=[entities_to_insert[j] for j in range(i, i + INSERT_SIZE)
                                        if j < len(entities_to_insert)])
            except Exception as e:
                print("Error in create_collection_with_zoom_levels.")
                print(e.__str__())
                return False

        # Flush collection
        collection.flush()

        # Free up zoom_levels dictionary. Keep some of the second to last level.
        max_level = max(zoom_levels.keys())
        # If the max zoom level is full, then increase the max zoom level by 1 so that some is kept for the next level.
        if entities_per_zoom_level[max_level] == 4 ** max_level:
            max_level += 1

        for zoom_level in list(zoom_levels.keys()):
            if not zoom_level == max_level - 1:
                del zoom_levels[zoom_level]
                entities_per_zoom_level[zoom_level] = 0
            else:
                if not entities_per_zoom_level[zoom_level] <= MAX_IMAGES_PER_TILE:
                    for tile_x in list(zoom_levels[zoom_level].keys()):
                        entities_per_zoom_level[zoom_level] -= len(zoom_levels[zoom_level][tile_x])
                        del zoom_levels[zoom_level][tile_x]
                        if entities_per_zoom_level[zoom_level] <= MAX_IMAGES_PER_TILE:
                            break

        return True

    except Exception as e:
        print(e.__str__())
        print("Error in insert_vectors_in_clusters_collection.")
        return False


def get_previously_inserted_tile(collection: Collection, zoom_level: int, tile_x_index: int, tile_y_index: int):
    search_params = {
        "metric_type": L2_METRIC,
        "offset": 0
    }
    # Get previously inserted tile
    result = collection.search(
        data=[[zoom_level, tile_x_index, tile_y_index]],
        anns_field=ZOOM_LEVEL_VECTOR_FIELD_NAME,
        param=search_params,
        limit=1,
        expr=None,
        output_fields=[ZOOM_LEVEL_VECTOR_FIELD_NAME, "data"]
    )

    if len(result) == 0:
        return None
    else:
        return {
            ZOOM_LEVEL_VECTOR_FIELD_NAME: result[0][0].entity.get(ZOOM_LEVEL_VECTOR_FIELD_NAME),
            "data": result[0][0].entity.get("data"),
        }


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
            collection.insert(data=[entities_to_insert[j] for j in range(i, i + INSERT_SIZE)
                                    if j < len(entities_to_insert)])
        except Exception as e:
            print(e.__str__())
            print("Error in create_collection_with_zoom_levels.")
            # Drop collection to avoid inconsistencies
            utility.drop_collection(collection_name)
            return

    # Flush collection
    collection.flush()

    # Success
    print(f"Successfully created collection {collection_name}.")


def create_tiling(entities) -> tuple[list[list[list[dict]]], int]:
    # Randomly shuffle the entities.
    np.random.shuffle(entities)

    # Find the maximum and minimum values for each dimension
    max_values = {}
    min_values = {}
    for coordinate in COORDINATES:
        max_values[coordinate] = max([entity[coordinate] for entity in entities])
        min_values[coordinate] = min([entity[coordinate] for entity in entities])

    # For reference, a tile is a list of dictionaries, each dictionary containing the following keys:
    # "index": index of the entity in the collection
    # "x": x coordinate of the entity in the embedding space
    # "y": y coordinate of the entity in the embedding space

    # Find zoom level that allows to have tiles with at most MAX_IMAGES_PER_TILE images.
    max_zoom_level = 0
    while True:
        # Define grid for entire embeddings space.
        number_of_tiles = 2 ** max_zoom_level
        grid = [[[] for _ in range(number_of_tiles)] for _ in range(number_of_tiles)]

        # Associate each entity to a tile.
        for entity in entities:
            # Shift the values by the minimum value of both dimensions so that the minimum value is 0
            x = entity[COORDINATES[0]] - min_values[COORDINATES[0]]
            y = entity[COORDINATES[1]] - min_values[COORDINATES[1]]

            # Find the tile to which the entity belongs.
            tile_x = min(int((x * number_of_tiles) // (max_values[COORDINATES[0]] - min_values[COORDINATES[0]])),
                         number_of_tiles - 1)
            tile_y = min(int((y * number_of_tiles) // (max_values[COORDINATES[1]] - min_values[COORDINATES[1]])),
                         number_of_tiles - 1)

            # Add entity to the tile
            grid[tile_x][tile_y].append(entity)

        # Check if the number of images in each tile is less than MAX_IMAGES_PER_TILE
        max_images_per_tile = 0
        tot_images = 0
        for row in grid:
            for tile in row:
                if len(tile) > max_images_per_tile:
                    max_images_per_tile = len(tile)
                tot_images += len(tile)

        assert tot_images == len(entities)

        if max_images_per_tile <= MAX_IMAGES_PER_TILE:
            break
        else:
            max_zoom_level += 1

    # Plot heat map of the grid
    # plot_heat_map(grid, number_of_tiles, max_zoom_level)
    # Return grid
    return grid, max_zoom_level


def graceful_application_shutdown(exception: Exception | None, collection: Collection):
    if exception:
        print(f"Error: {exception.__str__()}.")
    print(f"Dropping collection {collection.name} with {collection.num_entities} entities.")
    # Drop collection
    utility.drop_collection(collection.name)
    sys.exit(1)


"""
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
            "in_previous": True
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
                        "in_previous": False
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
"""


def create_zoom_levels(entities, zoom_levels_collection_name, images_to_tile_collection_name, repopulate):
    # Take entire embedding space for zoom level 0, then divide each dimension into 2^zoom_levels intervals.
    # Each interval is a tile. For each tile, find clusters and cluster representatives. Keep track of
    # the number of entities in each cluster. For the last zoom level, show all the entities in each tile.
    # First, get tiling
    tiling, max_zoom_level = create_tiling(entities)

    print(f"The max zoom level is {max_zoom_level}.")

    # Create clusters collection
    zoom_levels_collection = create_clusters_collection(zoom_levels_collection_name, repopulate)

    # Define dictionary for zoom levels
    zoom_levels = {}
    # Define dictionary for number of entities in zoom level
    entities_per_zoom_level = {}
    # Define number of tiles
    number_of_tiles = 0
    # Define dictionary for mapping from images to coarser zoom level (and tile)
    images_to_tile = {}

    # Load the collection of zoom levels
    zoom_levels_collection.load()

    for zoom_level in tqdm(range(0, max_zoom_level + 1), desc="Zoom level", position=0):
        zoom_levels[zoom_level] = {}
        entities_per_zoom_level[zoom_level] = 0
        # First tile goes from 0 to 2 ** (max_zoom_level - zoom_level) - 1, second tile goes from
        # 2 ** (max_zoom_level - zoom_level) to 2 ** (max_zoom_level - zoom_level) * 2 - 1, and so on.
        for tile_x in tqdm(range(0, 2 ** max_zoom_level, 2 ** (max_zoom_level - zoom_level)), desc="Tile x",
                           position=1, leave=False):
            # Get index of tile along x-axis
            tile_x_index = int(tile_x // 2 ** (max_zoom_level - zoom_level))
            zoom_levels[zoom_level][tile_x_index] = {}

            for tile_y in tqdm(range(0, 2 ** max_zoom_level, 2 ** (max_zoom_level - zoom_level)), desc="Tile y",
                               position=2, leave=False):
                # Get index of tile along y-axis
                tile_y_index = int(tile_y // 2 ** (max_zoom_level - zoom_level))
                # Flush if necessary
                if number_of_tiles >= LIMIT_FOR_INSERT:
                    # Insert data in collection
                    result = insert_vectors_in_clusters_collection(
                        zoom_levels, images_to_tile, zoom_levels_collection, number_of_tiles, entities_per_zoom_level
                    )
                    if result:
                        # Adjust zoom_levels dictionary and number_of_tiles
                        zoom_levels[zoom_level] = {}
                        if tile_x_index not in zoom_levels[zoom_level].keys():
                            zoom_levels[zoom_level][tile_x_index] = {}
                        number_of_tiles = 0
                    else:
                        # Shut down application
                        graceful_application_shutdown(None, zoom_levels_collection)

                # Get all entities in the current tile.
                entities_in_tile = []
                count = 0
                for x in range(tile_x, tile_x + 2 ** (max_zoom_level - zoom_level)):
                    for y in range(tile_y, tile_y + 2 ** (max_zoom_level - zoom_level)):
                        # Get all entities in the tile
                        entities_in_tile += tiling[x][y]
                        count += 1

                assert count == 4 ** (max_zoom_level - zoom_level)

                # Get cluster representatives that where selected in the previous zoom level and are in the current
                # tile.
                # First, get index of tile from the previous zoom level which contains the current tile
                prev_level_x = int(tile_x_index // 2)
                prev_level_y = int(tile_y_index // 2)

                # Get cluster representatives from previous zoom level
                old_cluster_representatives_in_current_tile = []
                if zoom_level != 0:
                    previous_zoom_level_cluster_representatives = []
                    if (zoom_level - 1 in zoom_levels and prev_level_x in zoom_levels[zoom_level - 1].keys()
                            and prev_level_y in zoom_levels[zoom_level - 1][prev_level_x].keys()):
                        # Get cluster representatives from the zoom_levels dictionary directly
                        previous_zoom_level_cluster_representatives = [representative["representative"] for
                                                                       representative in zoom_levels[zoom_level - 1]
                                                                       [prev_level_x][prev_level_y]["representatives"]]
                    else:
                        # Get cluster representatives from the collection
                        result = get_previously_inserted_tile(
                            zoom_levels_collection, zoom_level - 1, prev_level_x, prev_level_y
                        )
                        if result:
                            previous_zoom_level_cluster_representatives = result["data"]
                        else:
                            # Shut down application
                            graceful_application_shutdown(Exception("Could not find tile in previous zoom level."),
                                                          zoom_levels_collection)

                    # Get cluster representatives that are in the current tile.
                    # old_cluster_representatives_in_current_tile must be cluster representatives in the current tile.
                    for representative in previous_zoom_level_cluster_representatives:
                        for entity in entities_in_tile:
                            if entity["index"] == representative["index"]:
                                old_cluster_representatives_in_current_tile.append(representative)
                                break

                # Define vector of representative entities
                representative_entities = []
                # Check if there are less than MAX_IMAGES_PER_TILE images in the tile.
                if len(entities_in_tile) <= MAX_IMAGES_PER_TILE:
                    # START NEW VERSION
                    for entity in entities_in_tile:
                        # Check if the entity is in the previous zoom level
                        in_previous = False
                        for old_rep in old_cluster_representatives_in_current_tile:
                            if entity["index"] == old_rep["index"]:
                                in_previous = True
                                break
                        representative_entities.append(
                            {
                                "representative": entity,
                                "number_of_entities": 0,
                                "in_previous": in_previous
                            }
                        )
                    # END NEW VERSION
                    """
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
                        for entity in entities_in_tile:
                            # Check if the entity is in the previous zoom level
                            in_previous = False
                            for old_rep in old_cluster_representatives_in_current_tile:
                                if entity["index"] == old_rep["index"]:
                                    in_previous = True
                                    break
                            representative_entities.append(
                                {
                                    "representative": entity,
                                    "number_of_entities": 0,
                                    "in_previous": in_previous
                                }
                            )
                    """

                    # Check if all the elements in old_cluster_representatives_in_current_tile have in_previous
                    # set to True.
                    indexes = [old_rep["index"] for old_rep in old_cluster_representatives_in_current_tile]
                    count = 0
                    for rep in representative_entities:
                        if rep["representative"]["index"] in indexes:
                            count += 1
                            assert rep["in_previous"]
                        else:
                            assert not rep["in_previous"]
                    assert count == len(old_cluster_representatives_in_current_tile)

                    assert (sum([cluster["number_of_entities"] + 1 for cluster in representative_entities])
                            == len(entities_in_tile))

                else:
                    # Get the coordinates of the entities in the tile
                    coordinates = np.array([[entity["x"], entity["y"]] for entity in entities_in_tile])

                    # Perform clustering
                    kmeans = ModifiedKMeans(n_clusters=NUMBER_OF_CLUSTERS, random_state=0, n_init=1, max_iter=1000)

                    if len(old_cluster_representatives_in_current_tile) > 0:
                        fixed_centers = np.array([[entity["x"], entity["y"]] for entity in
                                                  old_cluster_representatives_in_current_tile])
                    else:
                        fixed_centers = None

                    kmeans.fit(coordinates, fixed_centers=fixed_centers)

                    # Get the coordinates of the cluster representatives
                    cluster_representatives = kmeans.cluster_centers_

                    # Assert that the number of cluster representatives is equal to NUMBER_OF_CLUSTERS
                    assert len(cluster_representatives) == NUMBER_OF_CLUSTERS

                    # Check that the first len(old_cluster_representatives_in_current_tile) cluster_representatives are
                    # the same as the old_cluster_representatives_in_current_tile
                    for i in range(len(old_cluster_representatives_in_current_tile)):
                        assert (old_cluster_representatives_in_current_tile[i]["x"] == cluster_representatives[i][0])
                        assert (old_cluster_representatives_in_current_tile[i]["y"] == cluster_representatives[i][1])

                    # Find the entity closest to the centroid of each cluster
                    temp_cluster_representatives_entities = []
                    num_entities = 0
                    for cluster in range(NUMBER_OF_CLUSTERS):
                        # Get the entities in the cluster
                        entities_in_cluster = [entity for entity in entities_in_tile
                                               if kmeans.predict(np.array([[entity["x"], entity["y"]]]))[0] == cluster]
                        num_entities += len(entities_in_cluster)

                        if cluster < len(old_cluster_representatives_in_current_tile):
                            # Add old cluster representative to temp_cluster_representatives_entities
                            temp_cluster_representatives_entities.append(
                                {
                                    "representative": old_cluster_representatives_in_current_tile[cluster],
                                    "number_of_entities": len(entities_in_cluster) - 1,
                                    "in_previous": True
                                }
                            )

                        else:
                            # Get the entity closest to the centroid of the cluster
                            def l2(entity):
                                return ((entity["x"] - cluster_representatives[cluster][0]) ** 2
                                        + (entity["y"] - cluster_representatives[cluster][1]) ** 2)

                            temp_cluster_representatives_entities.append(
                                {
                                    "representative": min(entities_in_cluster, key=l2),
                                    "number_of_entities": len(entities_in_cluster) - 1,
                                    "in_previous": False
                                }
                            )

                    assert num_entities == len(entities_in_tile)

                    """
                    # Merge clusters if the embeddings of the representatives are too similar in terms of cosine
                    # similarity. First, get full embedding vectors of the representatives.
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
                    """

                    # START NEW VERSION
                    representative_entities = temp_cluster_representatives_entities
                    # END NEW VERSION

                    # Check if the all the element in old_cluster_representatives_in_current_tile have in_previous
                    # set to True.
                    indexes = [old_rep["index"] for old_rep in old_cluster_representatives_in_current_tile]
                    count = 0
                    for rep in representative_entities:
                        if rep["representative"]["index"] in indexes:
                            count += 1
                            assert rep["in_previous"]
                        else:
                            assert not rep["in_previous"]

                    assert count == len(old_cluster_representatives_in_current_tile)

                    assert (sum([cluster["number_of_entities"] + 1 for cluster in representative_entities])
                            == len(entities_in_tile))

                # Save information for tile in zoom_levels. Cluster representatives are the entities themselves.
                zoom_levels[zoom_level][tile_x_index][tile_y_index] = {}
                zoom_levels[zoom_level][tile_x_index][tile_y_index]["representatives"] = representative_entities
                zoom_levels[zoom_level][tile_x_index][tile_y_index]["already_inserted"] = False
                number_of_tiles += 1
                entities_per_zoom_level[zoom_level] += 1

                if zoom_level == 0:
                    zoom_levels[zoom_level][tile_x_index][tile_y_index]["range"] = {
                        "x_min": min([entity["x"] for entity in entities_in_tile]),
                        "x_max": max([entity["x"] for entity in entities_in_tile]),
                        "y_min": min([entity["y"] for entity in entities_in_tile]),
                        "y_max": max([entity["y"] for entity in entities_in_tile])
                    }

                # Save mapping from images to tile
                for representative in representative_entities:
                    if representative["representative"]["index"] not in images_to_tile:
                        images_to_tile[representative["representative"]["index"]] = [
                            zoom_level, tile_x_index, tile_y_index
                        ]

    if number_of_tiles > 0:
        # Insert data in collection
        result = insert_vectors_in_clusters_collection(
            zoom_levels, images_to_tile, zoom_levels_collection, number_of_tiles, entities_per_zoom_level
        )
        if not result:
            # Shut down application
            graceful_application_shutdown(None, zoom_levels_collection)

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

    if utility.has_collection(flags["collection"] + "_zoom_levels_clusters") and not flags["repopulate"]:
        # Get number of entities in the collection
        num_entities = Collection(flags["collection"] + "_zoom_levels_clusters").num_entities
        print(f"Found collection {flags['collection']}_zoom_levels_clusters'. It has {num_entities} entities."
              f" Not dropping it. Set repopulate to True to drop it.")
        sys.exit(1)

    # Choose a collection. If the collection does not exist, return.
    if flags["collection"] not in utility.list_collections():
        print(f"The collection {flags['collection']}, which is needed for creating zoom levels, does not exist.")
        sys.exit(1)
    else:
        collection = Collection(flags["collection"])

    # Load vectors from collection
    entities = load_vectors_from_collection(collection)

    # Create zoom levels
    if entities is not None:
        create_zoom_levels(entities, flags["collection"] + "_zoom_levels_clusters",
                           flags["collection"] + "_image_to_tile", flags["repopulate"])
