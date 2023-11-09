from pymilvus import Collection

from ..app.request_bodies import Text


class CollectionNameGetter:
    def __init__(self, collections: dict[str, Collection]):
        self.collections = collections

    def __call__(self, text: Text):
        if text.collection_name in self.collections.keys():
            return self.collections[text.collection_name]
        else:
            return None
