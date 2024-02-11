# import contextlib
# import io
import os
from abc import ABC, abstractmethod
from enum import Enum

import deeplake
import numpy as np
import torch
from PIL import Image
from torch.utils.data import DataLoader, Sampler, SequentialSampler
from torch.utils.data import Dataset as TorchDataset

from ..CONSTANTS import *


# COLLATE FUNCTIONS

# def wikiart_collate_fn(batch):
#     # Find first non-None values in the batch. Each sample has a field "pixel_values" inside "images", but we
#     # use a general for loop for the keys in case the field changes in the future.
#     try:
#         index = None
#         for i, sample in enumerate(batch):
#             if sample is not None and sample["images"].keys():
#                 index = i
#                 break
#
#         # Return if no such index has been found
#         if index is None:
#             return
#
#         # Select all samples for which there is complete data
#         select_sample = True
#         batch_data = []
#         for i in range(len(batch)):
#             image_data = {}
#             for key in batch[index]["images"].keys():
#                 if batch[i]["images"] is not None and batch[i]["images"][key] is not None:
#                     image_data[key] = batch[i]["images"][key]
#                 else:
#                     select_sample = False
#                     break
#
#             # Add label
#             label = -1
#             if select_sample and batch[i]["labels"] is not None and len(batch[i]["labels"]) == 1:
#                 label = batch[i]["labels"][0]
#             else:
#                 select_sample = False
#
#             # Add index
#             sample_id = -1
#             if select_sample and batch[i]["index"] is not None and len(batch[i]["index"]) == 1:
#                 sample_id = batch[i]["index"][0]
#             else:
#                 select_sample = False
#
#             # If all the data for the sample is available, add it to the return value
#             if select_sample:
#                 batch_data.append({"images": image_data, "label": label, "index": sample_id})
#
#         # Return batch
#         return {
#             "images": {key: torch.cat([x["images"][key] for x in batch_data], dim=0).detach()
#                        for key in batch[index]["images"].keys()},
#             "labels": [x["label"] for x in batch_data],
#             "index": [x["index"] for x in batch_data]
#         }
#
#     except Exception as e:
#         print(e.__str__())
#         print("Error in collate_fn of wikiart.")
#         return

def wikiart_collate_fn(batch):
    try:
        return {
            "images": {key: torch.cat([x["images"][key] if isinstance(x["images"][key], torch.Tensor)
                                       else torch.Tensor(np.array(x["images"][key])) for x in batch], dim=0).detach()
                       for key in batch[0]["images"].keys()},
            "index": [x["index"] for x in batch],
            "path": [x["path"] for x in batch],
            "width": [x["width"] for x in batch],
            "height": [x["height"] for x in batch],
            "genre": [x["genre"] for x in batch],
            "author": [x["author"] for x in batch],
            "date": [x["date"] for x in batch]
        }
    except Exception as e:
        print(e.__str__())
        print("Error in collate_fn of best_artworks.")
        return


def best_artworks_collate_fn(batch):
    try:
        return {
            "images": {key: torch.cat([x["images"][key] if isinstance(x["images"][key], torch.Tensor)
                                       else torch.Tensor(np.array(x["images"][key])) for x in batch], dim=0).detach()
                       for key in batch[0]["images"].keys()},
            "index": [x["index"] for x in batch],
            "author": [x["author"] for x in batch],
            "path": [x["path"] for x in batch],
            "width": [x["width"] for x in batch],
            "height": [x["height"] for x in batch]
        }
    except Exception as e:
        print(e.__str__())
        print("Error in collate_fn of best_artworks.")
        return


# SUPPORT DATASET FOR IMAGES

class SupportDatasetForImages(TorchDataset):
    def __init__(self, root_dir):
        self.root_dir = root_dir
        self.file_list = []

        for file in os.listdir(root_dir):
            if not os.path.isdir(os.path.join(self.root_dir, file)):
                self.file_list.append(file)

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


class SupportDatasetForImagesBestArtworks(SupportDatasetForImages):
    def __init__(self, root_dir):
        super().__init__(root_dir)

    def __getitem__(self, idx):
        img_name = os.path.join(self.root_dir, self.file_list[idx])
        # Get image height and width
        image = Image.open(img_name)
        width, height = image.size
        if self.transform:
            image = self.transform(image)

        return {
            'images': image,
            'index': idx,
            'author': " ".join(self.file_list[idx].split("-")[1].removesuffix(".jpg").split("_")),
            'path': self.file_list[idx],
            'width': width,
            'height': height
        }


class SupportDatasetForImagesWikiArt(SupportDatasetForImages):
    def __init__(self, root_dir):
        super().__init__(root_dir)

    def __getitem__(self, idx):
        img_name = os.path.join(self.root_dir, self.file_list[idx])
        # Get image height and width
        image = Image.open(img_name)
        width, height = image.size
        if self.transform:
            image = self.transform(image)

        # Create dictionary to return
        return_value = {
            'images': image,
            'index': idx,
            'path': self.file_list[idx],
            'width': width,
            'height': height,
            'genre': '',
            'author': '',
            'date': -1,
        }

        # Get elements from filename. Remove initial number and extension, and split by "_"
        elements = self.file_list[idx].removesuffix(".jpg").split("_")[1:]
        if len(elements) > 0:
            return_value['genre'] = " ".join(elements[0].split("-"))
        if len(elements) > 1:
            # Get author and capitalize first letter of each word
            return_value['author'] = " ".join(elements[1].split("-")).capitalize()
        if len(elements) > 2:
            # If at the end there are 4 consecutive numbers, it is a date. Remove it from the title and assign it to
            # date
            title_elements = elements[2].split("-")
            if len(title_elements) > 0 and title_elements[-1].isdigit() and len(title_elements[-1]) == 4:
                return_value['date'] = int(title_elements[-1])
                title_elements = title_elements[:-1]

            # First, assign single s to previous word with "'s"
            indexes_to_remove = []
            for i in range(len(title_elements)):
                if title_elements[i] == "s" and i > 0:
                    title_elements[i - 1] = title_elements[i - 1] + "'s"
                    indexes_to_remove.append(i)
            # Remove elements
            for i in indexes_to_remove:
                title_elements.pop(i)
            # Capitalize first letter of each word
            return_value['title'] = " ".join(title_elements).capitalize()

        return return_value


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
    # The name of the enum variable should equal the name of the dataset
    WIKIART = {"name": "wikiart", "collate_fn": wikiart_collate_fn, "zoom_levels": 8}
    BEST_ARTWORKS = {"name": "best_artworks", "collate_fn": best_artworks_collate_fn, "zoom_levels": 7}


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

    def __getitem__(self, idx):
        return self.dataset[idx]


# DATASET CLASSES

class WikiArtDataset(Dataset):
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


class LocalArtworksDataset(Dataset):
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
                # The dataset is being used without missing indexes and start-end parameters
                sampler = SequentialSampler(self.dataset)
                self.dataset.append_transform(data_processor)
                return DataLoader(self.dataset,
                                  batch_size=batch_size,
                                  num_workers=1,
                                  collate_fn=self.collate_fn,
                                  sampler=sampler)
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
                raise Exception("In LocalArtworksDataset, missing missing_indexes parameter.")


# FUNCTION FOR GETTING DATASET OBJECT

def get_dataset_object(dataset_name) -> Dataset:
    if dataset_name == DatasetOptions.WIKIART.value["name"]:
        # Get dataset
        # with contextlib.redirect_stdout(io.StringIO()):
        #     ds = deeplake.load(WIKIART)
        #     # Create and return dataset object
        #     return WikiArtDataset(ds, DatasetOptions.WIKIART.value["collate_fn"])
        # Create SupportDatasetForImages object
        ds = SupportDatasetForImagesWikiArt(os.getenv(WIKIART_DIR))
        # Create and return dataset object
        return LocalArtworksDataset(ds, DatasetOptions.WIKIART.value["collate_fn"])
    elif dataset_name == DatasetOptions.BEST_ARTWORKS.value["name"]:
        # Create SupportDatasetForImages object
        ds = SupportDatasetForImagesBestArtworks(os.getenv(BEST_ARTWORKS_DIR))
        # Create and return dataset object
        return LocalArtworksDataset(ds, DatasetOptions.BEST_ARTWORKS.value["collate_fn"])
    else:
        # TODO add support for other datasets
        pass
