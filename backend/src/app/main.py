import os

import uvicorn
from fastapi import FastAPI, Depends, HTTPException
from pymilvus import connections, db, Collection
from pymilvus.orm import utility

from ..app.request_bodies import *
from ..app.database import gets
from ..CONSTANTS import *
from ..app.dependencies import CollectionNameGetter
from ..model.CLIPEmbeddings import ClipEmbeddings

embeddings = None
collections = {}
collection_name_getter = None

# Create app
app = FastAPI()


# Define routes
@app.get("/api/collection_names")
def get_collection_names():
    # Return collection names as a list
    return {"collection_names": list(collections.keys())}


@app.get("/api/image-text")
def say_hello(text: Text, collection_info=Depends(collection_name_getter)):
    if collection_info[0] is None:
        # Collection not found, return 404
        raise HTTPException(status_code=404, detail="Collection not found")
    else:
        # Collection found, return image index
        # index = gets.get_image_embeddings_from_text(embeddings, text.text, collection_info[0], collection_info[1])
        # return {"image_index": index}
        image = gets.get_image_embeddings_from_text(embeddings, text.text, collection_info[0], collection_info[1])
        return {"image_index": image}


def main():
    # Create a connection to database.
    passwd = os.environ[ROOT_PASSWD] if ROOT_PASSWD in os.environ.keys() else OLD_ROOT_PASSWD
    connections.connect(
        host=os.environ[MILVUS_IP],
        port=os.environ[MILVUS_PORT],
        user=ROOT_USER,
        password=passwd,
    )

    # Set database
    db.using_database(os.environ[DATABASE])

    # Get collections and create collection objects
    global collections
    for name in utility.list_collections():
        collections[name] = Collection(name)

    # Create collection name getter
    global collection_name_getter
    collection_name_getter = CollectionNameGetter(collections)

    # Create embeddins object
    global embeddings
    embeddings = ClipEmbeddings(DEVICE)

    uvicorn.run(app, host="0.0.0.0", port=os.environ["PORT"], reload=True)


if __name__ == "__main__":
    main()
