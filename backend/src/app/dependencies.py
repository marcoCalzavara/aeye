import threading

import torch
from fastapi import Query
from pymilvus import Collection
from pymilvus.orm import utility

from ..db_utilities.datasets import DatasetOptions
from ..model.EmbeddingsModel import EmbeddingsModel
from .CONSTANTS import *


# Define helper class for representing a collection
class HelperCollection:
    def __init__(self, name: str):
        self.name = name
        self.collection = Collection(name)
        self.load = self.collection.load
        self.release = self.collection.release
        # Define counter. The counter is initialized to 0. When the collection is queried for the first time,
        # it is loaded, and the counter is set to a value greater than 0. Every time the collection is not
        # used by an app method that accesses the database, the counter is decremented by 1. Once the counter becomes 0,
        # the collection is released. Every time the collection is queried, the counter is set to the value. It the
        # collection had been released, it is loaded again once queried.
        self.counter = 0
        # Create lock to ensure that the counter is not accessed by multiple threads at the same time. This it not
        # necessary for the current implementation, but it could be useful when database access is made non-blocking.
        # TODO: Implement non-blocking database access.
        self.lock = threading.Lock()


class CollectionNameGetter:
    def __init__(self):
        self.collections = {}

    def __call__(self, collection: str = Query(...)) -> Collection | None:
        pass

    def set_collections(self):
        pass

    def get_collection_names(self):
        pass

    def check_counter(self, collection_name: str):
        # If the counter is 0, the collection is not loaded. Load it (the counter will be set to COUNTER_MAX_VALUE
        # later).
        if self.collections[collection_name].counter == 0:
            self.collections[collection_name].load()

    def update_counters(self, collection_name: str):
        # Loop over collections. If the collection is not the one that was queried, decrement its counter. Else, if
        # the collection is the one that was queried, set its counter to COUNTER_MAX_VALUE.
        for key in self.collections.keys():
            if key != collection_name:
                self.collections[key].lock.acquire()
                self.collections[key].counter -= 1
                if self.collections[key].counter == 0:
                    self.collections[key].release()
                self.collections[key].lock.release()
            else:
                self.collections[key].lock.acquire()
                self.collections[key].counter = COUNTER_MAX_VALUE
                self.collections[key].lock.release()


class DatasetCollectionNameGetter(CollectionNameGetter):
    def __init__(self):
        super().__init__()

    def __call__(self, collection: str = Query(...)) -> Collection | None:
        if collection in self.collections.keys():
            # Check if the collection must be loaded
            self.check_counter(collection)
            # Update counter for all collections
            self.update_counters(collection)
            # Return the requested collection
            return self.collections[collection].collection
        else:
            return None

    def set_collections(self):
        # Get collections from DatasetOptions
        for dataset in DatasetOptions:
            if dataset.value["name"] in utility.list_collections():
                self.collections[dataset.value["name"]] = HelperCollection(dataset.value["name"])

    def get_collection_names(self):
        return list([key for key in self.collections.keys() if key in utility.list_collections()])


class ZoomLevelCollectionNameGetter(CollectionNameGetter):
    def __init__(self):
        super().__init__()

    def __call__(self, collection: str = Query(...)) -> Collection | None:
        if collection in self.collections.keys():
            # Check if the collection must be loaded
            self.check_counter(collection)
            # Update counter for all collections
            self.update_counters(collection)
            # Return the requested collection
            return self.collections[collection].collection
        else:
            return None

    def set_collections(self):
        for dataset in DatasetOptions:
            name = dataset.value["name"] + "_zoom_levels"
            if name in utility.list_collections():
                self.collections[name] = HelperCollection(name)


class Embedder:
    def __init__(self, embeddings: EmbeddingsModel):
        self.embeddings = embeddings

    def __call__(self, text: str = Query(...)) -> torch.Tensor:
        return self.embeddings.getTextEmbeddings(text)
