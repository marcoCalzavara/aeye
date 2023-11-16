import contextlib
import io
import os
from abc import ABC, abstractmethod
from enum import Enum

import deeplake
import torch
from PIL import Image
from torch.utils.data import DataLoader, Sampler
from torch.utils.data import Dataset as TorchDataset

from ..CONSTANTS import *


# COLLATE FUNCTIONS

def wikiart_collate_fn(batch):
    # Find first non-None values in the batch. Each sample has a field "pixel_values" inside "images", but we
    # use a general for loop for the keys in case the field changes in the future.
    try:
        index = None
        for i, sample in enumerate(batch):
            if sample is not None and sample["images"].keys():
                index = i
                break

        # Return if no such index has been found
        if index is None:
            return

        # Select all samples for which there is complete data
        select_sample = True
        batch_data = []
        for i in range(len(batch)):
            image_data = {}
            for key in batch[index]["images"].keys():
                if batch[i]["images"] is not None and batch[i]["images"][key] is not None:
                    image_data[key] = batch[i]["images"][key]
                else:
                    select_sample = False
                    break

            # Add label
            label = -1
            if select_sample and batch[i]["labels"] is not None and len(batch[i]["labels"]) == 1:
                label = batch[i]["labels"][0]
            else:
                select_sample = False

            # Add index
            sample_id = -1
            if select_sample and batch[i]["index"] is not None and len(batch[i]["index"]) == 1:
                sample_id = batch[i]["index"][0]
            else:
                select_sample = False

            # If all the data for the sample is available, add it to the return value
            if select_sample:
                batch_data.append({"images": image_data, "label": label, "index": sample_id})

        # Return batch
        return {
            "images": {key: torch.cat([x["images"][key] for x in batch_data], dim=0).detach()
                       for key in batch[index]["images"].keys()},
            "labels": [x["label"] for x in batch_data],
            "index": [x["index"] for x in batch_data]
        }

    except Exception as e:
        print(e.__str__())
        print("Error in collate_fn of wikiart.")
        return


def best_artworks_collate_fn(batch):
    try:
        return {
            "images": {key: torch.cat([x["images"][key] for x in batch], dim=0).detach()
                       for key in batch[0]["images"].keys()},
            "index": [x["index"] for x in batch],
            "author": [x["author"] for x in batch],
            "path": [x["path"] for x in batch]
        }
    except Exception as e:
        print(e.__str__())
        print("Error in collate_fn of best_artworks.")
        return


# SUPPORT DATASET FOR IMAGES
class SupportDatasetForImages(TorchDataset):
    def __init__(self, root_dir):
        self.root_dir = root_dir
        self.file_list = os.listdir(root_dir)
        # Check that filenames start with a number, and that the indexes go from 0 to len(file_list) - 1
        for file in self.file_list:
            if not file.split("-")[0].isdigit():
                raise Exception("Filenames must start with a number.")
            elif int(file.split("-")[0]) >= len(self.file_list) or int(file.split("-")[0]) < 0:
                raise Exception("Indexes must go from 0 to len(file_list) - 1.")
        # Sort file list by index
        self.file_list.sort(key=lambda x: int(x.split("-")[0]))
        self.transform = None

    def append_transform(self, transform):
        self.transform = transform

    def __len__(self):
        return len(self.file_list)

    def __getitem__(self, idx):
        img_name = os.path.join(self.root_dir, self.file_list[idx])
        image = self.transform(Image.open(img_name))

        return {'images': image,
                'index': idx,
                'author': " ".join(self.file_list[idx].split("-")[1].removesuffix(".jpg").split("_")),
                'path': self.file_list[idx]}


class SupportSamplerForImages(Sampler):
    def __init__(self, data_source, indices):
        super().__init__(data_source)
        self.indices = indices

    def __iter__(self):
        return iter(self.indices)

    def __len__(self):
        return len(self.indices)


# DATASET OPTIONS

class DatasetOptions(Enum):
    WIKIART = {"name": "wikiart", "collate_fn": wikiart_collate_fn}
    BEST_ARTWORKS = {"name": "best_artworks", "collate_fn": best_artworks_collate_fn}


# DATASET ABSTRACT CLASS

class Dataset(ABC):
    def __init__(self, dataset, collate_fn):
        self.dataset = dataset
        self.collate_fn = collate_fn

    @abstractmethod
    def get_size(self):
        pass

    @abstractmethod
    def get_dataloader(self, batch_size, num_workers, data_processor, is_missing_indexes=False,
                       start=None, end=None, missing_indexes=None):
        pass


# DATASET CLASSES

class WikiArt(Dataset):
    def __init__(self, dataset: deeplake.Dataset, collate_fn):
        super().__init__(dataset, collate_fn)

    def get_size(self):
        return self.dataset.min_len

    def get_dataloader(self, batch_size, num_workers, data_processor, is_missing_indexes=False, start=None, end=None,
                       missing_indexes=None):
        if not is_missing_indexes:
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
            if missing_indexes is not None:
                return self.dataset[missing_indexes].pytorch(num_workers=num_workers,
                                                             transform={'images': data_processor, 'labels': None,
                                                                        'index': None},
                                                             batch_size=batch_size,
                                                             decode_method={'images': 'pil'},
                                                             collate_fn=self.collate_fn)
            else:
                raise Exception("Missing missing_indexes parameter.")


class BestArtworks(Dataset):
    def __init__(self, dataset: TorchDataset, collate_fn):
        super().__init__(dataset, collate_fn)

    def get_size(self):
        return len(self.dataset)

    def get_dataloader(self, batch_size, num_workers, data_processor, is_missing_indexes=False,
                       start=None, end=None, missing_indexes=None):
        # Define collate_fn with data_processor
        if not is_missing_indexes:
            if start is not None and end is not None:
                sampler = SupportSamplerForImages(self.dataset, list(range(start, end)))
                self.dataset.append_transform(data_processor)
                return DataLoader(self.dataset,
                                  batch_size=batch_size,
                                  num_workers=1,
                                  collate_fn=self.collate_fn,
                                  sampler=sampler)
            else:
                raise Exception("In BestArtworks, missing start and end parameters.")
        else:
            if missing_indexes is not None:
                sampler = SupportSamplerForImages(self.dataset, missing_indexes)
                self.dataset.append_transform(data_processor)
                return DataLoader(self.dataset,
                                  batch_size=batch_size,
                                  num_workers=1,
                                  collate_fn=self.collate_fn,
                                  sampler=sampler)
            else:
                raise Exception("In BestArtworks, missing missing_indexes parameter.")


# FUNCTION FOR GETTING DATASET OBJECT
def get_dataset_object(dataset_name) -> Dataset:
    if dataset_name == DatasetOptions.WIKIART.value["name"]:
        # Get dataset
        with contextlib.redirect_stdout(io.StringIO()):
            ds = deeplake.load(WIKIART)
            # Create and return dataset object
            return WikiArt(ds, DatasetOptions.WIKIART.value["collate_fn"])
    elif dataset_name == DatasetOptions.BEST_ARTWORKS.value["name"]:
        # Create SupportDatasetForImages object
        ds = SupportDatasetForImages(os.getenv(BEST_ARTWORKS_DIR))
        # Create and return dataset object
        return BestArtworks(ds, DatasetOptions.BEST_ARTWORKS.value["collate_fn"])

    else:
        # TODO add support for other datasets
        pass
