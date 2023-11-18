import os

import uvicorn
from fastapi import FastAPI, Depends, HTTPException
from pymilvus import db, MilvusException

from .database import gets
from ..CONSTANTS import *
from .dependencies import *
from ..model.CLIPEmbeddings import ClipEmbeddings
from ..db_utilities.utils import create_connection

# Global variables
embeddings = ClipEmbeddings(DEVICE)
dataset_collection_name_getter = DatasetCollectionNameGetter()
zoom_level_collection_name_getter = ZoomLevelCollectionNameGetter()
embeddings = Embedder(embeddings)

# Create app
app = FastAPI()


# Define routes
@app.get("/api/collection-names")
def get_collection_names():
    # Return collection names as a list
    return {"collections": dataset_collection_name_getter.get_collection_names()}


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
        except MilvusException as e:
            # Milvus error, return code 505
            raise HTTPException(status_code=404, detail="Tile data not found")


def set_up_connection():
    # Create a connection to database.
    create_connection(ROOT_USER, ROOT_PASSWD)

    # Set database
    db.using_database(DEFAULT_DATABASE_NAME)

    # Set dataset collections
    dataset_collection_name_getter.set_collections()

    # Set zoom level collections
    zoom_level_collection_name_getter.set_collections()


def main():
    # Set up connection
    set_up_connection()

    uvicorn.run("src.app.main:app", host="0.0.0.0", port=int(os.environ[BACKEND_PORT]), reload=True)


if __name__ == "__main__":
    main()
