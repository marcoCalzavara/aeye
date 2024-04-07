import getpass
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from threading import Lock

import numpy as np
from PIL import Image
from dotenv import load_dotenv
from pymilvus import db, Collection, utility

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
THRESHOLD = 0.8
LIMIT_FOR_INSERT = 1000000
NUMBER_OF_TILES_KEY = "number_of_tiles"


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


def insert_vectors_in_clusters_collection(zoom_levels, images_to_tile, collection: Collection) -> bool:
    # We already have the lock on zoom_levels
    try:
        initial_number_of_tiles = zoom_levels[NUMBER_OF_TILES_KEY]
        # Define dictionary for elements that should be reinserted into zoom_levels after the pop operation
        entries_to_reinsert = {}
        # Define list of entities to insert in the collection
        entities_to_insert = []
        # Iterate over elements in zoom_levels
        for zoom_level in zoom_levels.keys():
            if zoom_level == NUMBER_OF_TILES_KEY:
                continue
            for tile_x in zoom_levels[zoom_level].keys():
                for tile_y in zoom_levels[zoom_level][tile_x].keys():
                    if "representatives" in zoom_levels[zoom_level][tile_x][tile_y].keys():
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
                    else:
                        if zoom_level not in entries_to_reinsert.keys():
                            entries_to_reinsert[zoom_level] = {}
                            if tile_x not in entries_to_reinsert[zoom_level].keys():
                                entries_to_reinsert[zoom_level][tile_x] = {}
                        entries_to_reinsert[zoom_level][tile_x][tile_y] = zoom_levels[zoom_level][tile_x][tile_y]

        # Insert entities in the collection
        for i in range(0, len(entities_to_insert), INSERT_SIZE):
            try:
                collection.insert(data=[entities_to_insert[j] for j in range(i, i + INSERT_SIZE)
                                        if j < len(entities_to_insert)])
                collection.flush()
            except Exception as e:
                print("Error in create_collection_with_zoom_levels.")
                print(e.__str__())
                return False

        # Remove everything from zoom_levels, except NUMBER_OF_TILES_KEY
        zoom_levels[NUMBER_OF_TILES_KEY] = zoom_levels[NUMBER_OF_TILES_KEY] - len(entities_to_insert)
        for zoom_level in list(zoom_levels.keys()):
            if zoom_level != NUMBER_OF_TILES_KEY:
                # We use pop to use garbage collection, so the objects that are referenced elsewhere are not deleted.
                zoom_levels.pop(zoom_level)
                zoom_levels[zoom_level] = {}

        # Reinsert elements that were not inserted
        for zoom_level in entries_to_reinsert.keys():
            if zoom_level not in zoom_levels.keys():
                zoom_levels[zoom_level] = {}
            for tile_x in entries_to_reinsert[zoom_level].keys():
                if tile_x not in zoom_levels[zoom_level].keys():
                    zoom_levels[zoom_level][tile_x] = {}
                for tile_y in entries_to_reinsert[zoom_level][tile_x].keys():
                    zoom_levels[zoom_level][tile_x][tile_y] = entries_to_reinsert[zoom_level][tile_x][tile_y]

        assert (zoom_levels[NUMBER_OF_TILES_KEY] == initial_number_of_tiles - len(entities_to_insert)
                + len(entries_to_reinsert))
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
            collection.flush()
        except Exception as e:
            print(e.__str__())
            print("Error in create_collection_with_zoom_levels.")
            # Drop collection to avoid inconsistencies
            utility.drop_collection(collection_name)
            return

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
    # Kill all threads of the application
    # noinspection all
    os._exit(1)


def process_tile(tile_x, tile_y, zoom_level, max_zoom_level, tiling, zoom_levels, zoom_levels_collection,
                 images_to_tile, zoom_levels_lock, images_to_tile_lock):
    try:
        # Flush if necessary
        zoom_levels_lock.acquire()
        if zoom_levels[NUMBER_OF_TILES_KEY] >= LIMIT_FOR_INSERT:
            # Insert data in collection
            result = insert_vectors_in_clusters_collection(zoom_levels, images_to_tile, zoom_levels_collection)
            if not result:
                # Shut down application
                graceful_application_shutdown(None, zoom_levels_collection)

        # Release lock
        zoom_levels_lock.release()

        # Compute tile_x_index and tile_y_index
        tile_x_index = int(tile_x // 2 ** (max_zoom_level - zoom_level))
        tile_y_index = int(tile_y // 2 ** (max_zoom_level - zoom_level))

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
        # tile. First, get index of tile from the previous zoom level which contains the current tile
        prev_level_tile_x_index = int(tile_x_index // 2)
        prev_level_tile_y_index = int(tile_y_index // 2)
        # Get cluster representatives from previous zoom level
        old_cluster_representatives_in_current_tile = []
        if zoom_level != 0:
            previous_zoom_level_cluster_representatives = []
            zoom_levels_lock.acquire()
            if zoom_level - 1 in zoom_levels and \
                    prev_level_tile_x_index in zoom_levels[zoom_level - 1].keys() and \
                    prev_level_tile_y_index in zoom_levels[zoom_level - 1][prev_level_tile_x_index].keys():
                # Get cluster representatives from the zoom_levels dictionary directly
                previous_zoom_level_cluster_representatives = [representative["representative"] for representative in
                                                               zoom_levels[zoom_level - 1][prev_level_tile_x_index]
                                                               [prev_level_tile_y_index]["representatives"]]
                zoom_levels_lock.release()
            else:
                # Release lock
                zoom_levels_lock.release()
                # Get cluster representatives from the collection
                result = get_previously_inserted_tile(zoom_levels_collection, zoom_level - 1, prev_level_tile_x_index,
                                                      prev_level_tile_y_index)
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
        zoom_levels_lock.acquire()
        if tile_x_index not in zoom_levels[zoom_level].keys():
            zoom_levels[zoom_level][tile_x_index] = {}
        zoom_levels[zoom_level][tile_x_index][tile_y_index] = {}
        zoom_levels[zoom_level][tile_x_index][tile_y_index]["representatives"] = representative_entities
        zoom_levels[NUMBER_OF_TILES_KEY] += 1
        zoom_levels_lock.release()

        if zoom_level == 0:
            zoom_levels_lock.acquire()
            zoom_levels[zoom_level][tile_x_index][tile_y_index]["range"] = {
                "x_min": min([entity["x"] for entity in entities_in_tile]),
                "x_max": max([entity["x"] for entity in entities_in_tile]),
                "y_min": min([entity["y"] for entity in entities_in_tile]),
                "y_max": max([entity["y"] for entity in entities_in_tile])
            }
            zoom_levels_lock.release()

        # Save mapping from images to tile
        for representative in representative_entities:
            images_to_tile_lock.acquire()
            if representative["representative"]["index"] not in images_to_tile:
                images_to_tile[representative["representative"]["index"]] = [
                    zoom_level, tile_x_index, tile_y_index
                ]
            images_to_tile_lock.release()

    except Exception as e:
        print("Error in process_tile.")
        # Shut down application
        graceful_application_shutdown(e, zoom_levels_collection)


def create_zoom_levels(entities, zoom_levels_collection_name, images_to_tile_collection_name, repopulate):
    # Take entire embedding space for zoom level 0, then divide each dimension into 2^zoom_levels intervals.
    # Each interval is a tile. For each tile, find clusters and cluster representatives. Keep track of
    # the number of entities in each cluster. For the last zoom level, show all the entities in each tile.
    # First, get tiling
    tiling, max_zoom_level = create_tiling(entities)

    # Create clusters collection
    zoom_levels_collection = create_clusters_collection(zoom_levels_collection_name, repopulate)

    # Define dictionary for zoom levels
    zoom_levels = {NUMBER_OF_TILES_KEY: 0}
    # Define dictionary for mapping from images to coarser zoom level (and tile)
    images_to_tile = {}

    # Create locks
    zoom_levels_lock = Lock()
    images_to_tile_lock = Lock()

    # Load the collection of zoom levels
    zoom_levels_collection.load()

    for zoom_level in range(max_zoom_level + 1):
        zoom_levels[zoom_level] = {}
        # First tile goes from 0 to 2 ** (max_zoom_level - zoom_level) - 1, second tile goes from
        # 2 ** (max_zoom_level - zoom_level) to 2 ** (max_zoom_level - zoom_level) * 2 - 1, and so on.
        with ThreadPoolExecutor() as executor:
            _ = [executor.submit(process_tile, tile_x, tile_y, zoom_level, max_zoom_level, tiling, zoom_levels,
                                 zoom_levels_collection, images_to_tile, zoom_levels_lock, images_to_tile_lock)
                 for tile_x in range(0, 2 ** max_zoom_level, 2 ** (max_zoom_level - zoom_level))
                 for tile_y in range(0, 2 ** max_zoom_level, 2 ** (max_zoom_level - zoom_level))]

        print(f"Zoom level: {zoom_level}/{max_zoom_level} completed.")

    if zoom_levels[NUMBER_OF_TILES_KEY] > 0:
        # Insert data in collection
        result = insert_vectors_in_clusters_collection(zoom_levels, images_to_tile, zoom_levels_collection)
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
