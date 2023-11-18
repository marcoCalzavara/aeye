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
    def __init__(self, suffix: str = ""):
        # TODO probably a lock is necessary for the collections object
        self.collections = {}
        # Get collections from DatasetOptions
        for dataset in DatasetOptions:
            name = dataset.value["name"] + suffix
            if name in utility.list_collections():
                self.collections[name] = HelperCollection(name)

    def __call__(self, collection: str = Query(...)) -> Collection | None:
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


class ZoomLevelCollectionNameGetter(CollectionNameGetter):
    def __init__(self):
        super().__init__("_zoom_levels")

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


class Updater:
    """
    Class for updating the collections. When the client requests the list of collections, it could become necessary to
    update the list of collections if a new collection has been created.
    """
    def __init__(self, dataset_collection_name_getter: DatasetCollectionNameGetter,
                 zoom_level_collection_name_getter: ZoomLevelCollectionNameGetter):
        self.dataset_collection_name_getter = dataset_collection_name_getter
        self.zoom_level_collection_name_getter = zoom_level_collection_name_getter

    def __call__(self):
        # First, update the list of collections if necessary
        for dataset in DatasetOptions:
            name = dataset.value["name"]
            if (name in utility.list_collections() and
                    name not in self.dataset_collection_name_getter.collections.keys()):
                # The collection is in the database, but not in the list of collections. Add it to the list.
                self.dataset_collection_name_getter.collections[name] = HelperCollection(name)
        # Second, update the list of zoom level collections if necessary
        for dataset in DatasetOptions:
            name = dataset.value["name"] + "_zoom_levels"
            if (name in utility.list_collections() and
                    name not in self.zoom_level_collection_name_getter.collections.keys()):
                # The collection is in the database, but not in the list of collections. Add it to the list.
                self.zoom_level_collection_name_getter.collections[name] = HelperCollection(name)

        # Now, return the list of collections
        return [dataset.value["name"] for dataset in DatasetOptions
                if dataset.value["name"] in utility.list_collections()]


class Embedder:
    def __init__(self, embeddings: EmbeddingsModel):
        self.embeddings = embeddings

    def __call__(self, text: str = Query(...)) -> torch.Tensor:
        return self.embeddings.getTextEmbeddings(text)
