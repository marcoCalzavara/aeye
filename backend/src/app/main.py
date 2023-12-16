from typing import List

from fastapi import FastAPI, Depends, HTTPException, Request
from pymilvus import db, MilvusException

from .database import gets
from .dependencies import *
from ..CONSTANTS import *
from ..db_utilities.utils import create_connection
from ..model.CLIPEmbeddings import ClipEmbeddings

# Create connection
create_connection(ROOT_USER, ROOT_PASSWD)

# Set database
db.using_database(DEFAULT_DATABASE_NAME)

# Create dependency objects
dataset_collection_name_getter = DatasetCollectionNameGetter()
grid_collection_name_getter = GridCollectionNameGetter()
map_collection_name_getter = MapCollectionNameGetter()
clusters_collection_name_getter = ClustersCollectionNameGetter()
image_to_tile_collection_name_getter = ImageToTileCollectionNameGetter()
dataset_collection_info_getter = DatasetCollectionInfoGetter()
updater = Updater(dataset_collection_name_getter,
                  grid_collection_name_getter,
                  map_collection_name_getter,
                  clusters_collection_name_getter,
                  image_to_tile_collection_name_getter)
embeddings = Embedder(ClipEmbeddings(DEVICE))

# Create app
app = FastAPI()


# Add dependency that adds header "Access-Control-Allow-Origin: *" to all responses
@app.middleware("http")
async def add_access_control_allow_origin_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response


# Define routes
@app.get("/api/collection-names")
def get_collection_names(collections: list[str] = Depends(updater)):
    # Return collection names as a list
    return {"collections": collections}


# Get collection information.
@app.get("/api/collection-info")
def get_collection_info(collection: {} = Depends(dataset_collection_info_getter)):
    if collection is None:
        # Collection not found, return 404
        raise HTTPException(status_code=404, detail="Collection not found")
    else:
        # Collection found, return collection info
        return {"number_of_entities": collection["number_of_entities"], "zoom_levels": collection["zoom_levels"]}


@app.get("/api/image-text")
def get_image_from_text(collection: Collection = Depends(dataset_collection_name_getter),
                        text_embedding: torch.Tensor = Depends(embeddings)):
    if collection is None:
        # Collection not found, return 404
        raise HTTPException(status_code=404, detail="Collection not found")
    else:
        try:
            # Collection found, return image path
            data = gets.get_image_info_from_text_embedding(collection, text_embedding)
            return data
        except MilvusException:
            # Milvus error, return code 505
            raise HTTPException(status_code=505, detail="Milvus error")


@app.get("/api/grid")
def get_grid_data(zoom_level: int,
                  tile_x: int,
                  tile_y: int,
                  collection: Collection = Depends(grid_collection_name_getter)):
    if collection is None:
        # Collection not found, return 404
        raise HTTPException(status_code=404, detail="Collection not found")
    else:
        # Collection found, return tile data
        try:
            tile_data = gets.get_grid_data(zoom_level, tile_x, tile_y, collection)
            # Check distance in tile data
            if tile_data["distance"] > 0.:
                # In the required tile is present in the database, the distance should be 0
                raise HTTPException(status_code=404, detail="Tile data not found")
            # Return tile data
            return tile_data["entity"]
        except MilvusException:
            # Milvus error, return code 505
            raise HTTPException(status_code=404, detail="Tile data not found")


@app.get("/api/map")
def get_map_data(zoom_level: int,
                 image_x: int,
                 image_y: int,
                 collection: Collection = Depends(map_collection_name_getter)):
    if collection is None:
        # Collection not found, return 404
        raise HTTPException(status_code=404, detail="Collection not found")
    else:
        # Collection found, return zoom level data
        try:
            zoom_level_image_data = gets.get_map_data(zoom_level, image_x, image_y, collection)
            if zoom_level_image_data["distance"] > 0.:
                # In the required image is present in the database, the distance should be 0
                raise HTTPException(status_code=404, detail="Zoom level data not found")
            # Return zoom level image data
            return zoom_level_image_data["entity"]
        except MilvusException:
            # Milvus error, return code 505
            raise HTTPException(status_code=505, detail="Milvus error")


@app.get("/api/clusters")
def get_clusters_data(zoom_level: int,
                      tile_x: int,
                      tile_y: int,
                      collection: Collection = Depends(clusters_collection_name_getter)):
    if collection is None:
        # Collection not found, return 404
        raise HTTPException(status_code=404, detail="Collection not found")
    else:
        # Collection found, return tile data
        try:
            tile_data = gets.get_clusters_data(zoom_level, tile_x, tile_y, collection)
            # Check distance in tile data
            if tile_data["distance"] > 0.:
                # In the required tile is present in the database, the distance should be 0
                raise HTTPException(status_code=404, detail="Tile data not found")
            # Return tile data
            return tile_data["entity"]
        except MilvusException:
            # Milvus error, return code 505
            raise HTTPException(status_code=404, detail="Tile data not found")


@app.get("/api/image-to-tile")
def get_tile_from_image(index: int,
                        collection: Collection = Depends(image_to_tile_collection_name_getter)):
    if collection is None:
        # Collection not found, return 404
        raise HTTPException(status_code=404, detail="Collection not found")
    else:
        # Collection found, return tile data
        try:
            tile_data = gets.get_tile_from_image(index, collection)
            if len(tile_data) == 0:
                # In the required image is present in the database, the distance should be 0
                raise HTTPException(status_code=404, detail="Tile data not found")
            else:
                return tile_data
        except MilvusException:
            # Milvus error, return code 505
            raise HTTPException(status_code=404, detail="Tile data not found")


@app.get("/api/images")
def get_images(indexes: List[int] = Query(...), collection: Collection = Depends(dataset_collection_name_getter)):
    # Both indexes and collection are query parameters
    if collection is None:
        # Collection not found, return 404
        raise HTTPException(status_code=404, detail="Collection not found")
    else:
        # Collection found, return images
        try:
            images = gets.get_images_from_indexes(indexes, collection)
            return images
        except MilvusException:
            # Milvus error, return code 505
            raise HTTPException(status_code=505, detail="Milvus error")
