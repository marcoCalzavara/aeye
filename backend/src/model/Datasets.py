from abc import ABC, abstractmethod
from enum import Enum

import deeplake

from ..model.utilities import wikiart_collate_fn


class DatasetOptions(Enum):
    WIKIART = {"name": "wikiart", "collate_fn": wikiart_collate_fn}


class Dataset(ABC):
    def __init__(self, dataset, collate_fn):
        self.dataset = dataset
        self.collate_fn = collate_fn

    @abstractmethod
    def get_size(self):
        pass

    @abstractmethod
    def get_dataloader(self, batch_size, num_workers, data_processor, is_missing_indeces=False,
                       start=None, end=None, missing_indeces=None):
        pass


class WikiArt(Dataset):
    def __init__(self, dataset: deeplake.Dataset, collate_fn):
        super().__init__(dataset, collate_fn)

    def get_size(self):
        return self.dataset.min_len

    def get_dataloader(self, batch_size, num_workers, data_processor, is_missing_indeces=False, start=None, end=None,
                       missing_indeces=None):
        if not is_missing_indeces:
            if start is not None and end is not None:
                return self.dataset[start:end].pytorch(num_workers=num_workers,
                                                       transform={'images': data_processor, 'labels': None,
                                                                  'index': None},
                                                       batch_size=batch_size,
                                                       decode_method={'images': 'pil'},
                                                       collate_fn=self.collate_fn)
            else:
                raise Exception("Missing start and end parameters.")
        else:
            if missing_indeces is not None:
                return self.dataset[missing_indeces].pytorch(num_workers=num_workers,
                                                             transform={'images': data_processor, 'labels': None,
                                                                        'index': None},
                                                             batch_size=batch_size,
                                                             decode_method={'images': 'pil'},
                                                             collate_fn=self.collate_fn)
            else:
                raise Exception("Missing missing_indeces parameter.")
