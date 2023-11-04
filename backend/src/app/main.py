from fastapi import FastAPI

from pymilvus import connections, db
import os
from ..model.CLIPEmbeddings import ClipEmbeddings

# Create a connection to database and set database.
connections.connect(
    user=os.environ["DB_USERNAME"],
    password=os.environ["DB_PASSWD"],
    host=os.environ["LOCALHOST"],
    port=os.environ["DB_PORT"]
)
db.using_database(os.environ["DATABASE"])

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
