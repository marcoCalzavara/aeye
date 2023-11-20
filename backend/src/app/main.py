from typing import List

from fastapi import FastAPI, Depends, HTTPException
from pymilvus import db, MilvusException

from .database import gets
from ..CONSTANTS import *
from .dependencies import *
from ..model.CLIPEmbeddings import ClipEmbeddings
from ..db_utilities.utils import create_connection

# Create connection
create_connection(ROOT_USER, ROOT_PASSWD)

# Set database
db.using_database(DEFAULT_DATABASE_NAME)

# Create dependency objects
dataset_collection_name_getter = DatasetCollectionNameGetter()
zoom_level_collection_name_getter = ZoomLevelCollectionNameGetter()
dataset_collection_info_getter = DatasetCollectionInfoGetter()
updater = Updater(dataset_collection_name_getter, zoom_level_collection_name_getter)
embeddings = Embedder(ClipEmbeddings(DEVICE))

# Create app
app = FastAPI()


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
        # Collection found, return image path
        path = gets.get_image_embedding_from_text_embedding(collection, text_embedding)
        return {"path": path}


@app.get("/api/tile-data")
def get_tile_data(zoom_level: int,
                  tile_x: int,
                  tile_y: int,
                  collection: Collection = Depends(zoom_level_collection_name_getter)):
    if collection is None:
        # Collection not found, return 404
        raise HTTPException(status_code=404, detail="Collection not found")
    else:
        # Collection found, return tile data
        try:
            tile_data = gets.get_tile_data_for_zoom_level(zoom_level, tile_x, tile_y, collection)
            # Check distance in tile data
            if tile_data["distance"] > 0.:
                # In the required tile is present in the database, the distance should be 0
                raise HTTPException(status_code=404, detail="Tile data not found")
            # Return tile data
            return tile_data["entity"]
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
