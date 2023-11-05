import os

from fastapi import FastAPI
from pymilvus import connections, db

from ..CONSTANTS import MILVUS_IP, MILVUS_PORT, ROOT_USER, ROOT_PASSWD, DATABASE_NAME
from ..model.CLIPEmbeddings import ClipEmbeddings

# Create a connection to database and set database.
connections.connect(
    host=os.environ[MILVUS_IP],
    port=os.environ[MILVUS_PORT],
    user=ROOT_USER,
    password=os.environ[ROOT_PASSWD],
)

db.using_database(DATABASE_NAME)

# Create embeddins object
device = "cpu"
embeddings = ClipEmbeddings(device)

# Create app
app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/hello/{name}")
async def say_hello(name: str):
    return {"message": f"Hello {name}"}
