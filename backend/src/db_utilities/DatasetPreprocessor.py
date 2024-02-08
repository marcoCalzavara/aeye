from typing import Dict

import numpy as np
import torch
from tqdm import tqdm

from ..CONSTANTS import *
from ..embeddings_model.EmbeddingsModel import EmbeddingsModel
from ..embeddings_model.utils import project_embeddings_UMAP


class DatasetPreprocessor:
    """
    Module for generating the data which is stored in the database.
    """

    def __init__(self, embeddings_model: EmbeddingsModel, missing_indexes):
        """
        :param embeddings_model:
        """
        self.embeddings_model = embeddings_model
        self._missing_indexes = missing_indexes
        self._embeddings = None
        self._attributes = {}
        self._low_dim_embeddings = None
        self._cluster_ids = None

    def setEmbeddings(self, embeddings):
        self._embeddings = embeddings

    def _generateEmbeddings(self, inputs):
        """
        Generate _embeddings of data using the provided _embeddings embeddings_model. The method requires the inputs
        to the data encoder.
        """
        # This code works for dataloader with batch_size == 1
        if self._embeddings is None:
            self._embeddings = self.embeddings_model.getEmbeddings(inputs).detach()
        else:
            self._embeddings = torch.cat((self._embeddings,
                                          self.embeddings_model.getEmbeddings(inputs)), dim=0).detach()

    def _storeAttributes(self, data, attribute):
        if attribute not in self._attributes:
            self._attributes[attribute] = data[attribute]
        else:
            self._attributes[attribute] = self._attributes[attribute] + data[attribute]

    def _generateLowDimensionalEmbeddings(self, projection_method):
        assert self._embeddings is not None

        if projection_method == UMAP_PROJ:
            self._low_dim_embeddings = project_embeddings_UMAP(self._embeddings)

    def _save_missing_indexes(self, start, is_missing_indexes_call=False):
        if "index" not in self._attributes.keys():
            return
        else:
            # Compute missing values from current processing step
            if not is_missing_indexes_call:
                upper_value = max(self._attributes["index"])
                complete_tensor_of_indexes = list(range(start, upper_value + 1))
                self._missing_indexes = list(
                    set(self._missing_indexes + np.setdiff1d(np.array(complete_tensor_of_indexes),
                                                             np.array(self._attributes["index"])).tolist()))
            else:
                upper_value = start - 1
                self._missing_indexes = np.setdiff1d(np.array(self._missing_indexes),
                                                     np.array(self._attributes["index"])).tolist()

            # Dump information in file for future use. The information consists of two lines:
            # 1. Indexes of samples that have been skipped.
            # 2. Index of the last sample that has been processed plus 1.
            with open(FILE_MISSING_INDEXES, "w") as f:
                f.write(', '.join(map(str, self._missing_indexes)) + "\n")
                f.write(str(upper_value + 1))

            print("Saved information for next iteration!")

    def generateRecordsMetadata(self, projection_method=DEFAULT_PROJECTION_METHOD) -> Dict[str, np.ndarray]:
        # Generate low dimensional embeddings
        self._generateLowDimensionalEmbeddings(projection_method)

        return {"low_dim_embeddings": self._low_dim_embeddings}

    def generateDatabaseEmbeddings(self, dataloader, is_missing_indexes=False, start=-1, early_stop=-1):
        """
        Generate dataset embeddings from the dataloader specified when creating the object. The method saves the
        indexes of the samples that could not be fetched in a file, with the index of the next sample after the last
        one that has been correctly fetched and processed.
        :param dataloader:
        :param start:
        :param early_stop: The index for early stopping. If early stopping is not -1, then the processing stops after
        early_stopping batches have been fetched and processed.
        :param is_missing_indexes:
        :return: A dictionary with the embeddings and any other attribute of the samples. All values are tensors.
        """
        try:
            for i, data in enumerate(tqdm(dataloader, desc="Processing", ncols=100,
                                          bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]")):
                if data is not None:
                    attributes = list(data.keys())
                    # Check if "index" is in attribute
                    if "index" not in attributes:
                        raise Exception("'index' must be present in each sample. Please modify the collate_fn "
                                        "function to include the attribute.")
                    # Generate data embeddings
                    self._generateEmbeddings(data[attributes[0]])
                    # Collect other attributes for the data points
                    if len(attributes) > 1:
                        for attribute in attributes[1:]:
                            self._storeAttributes(data, attribute)
                else:
                    print("Data is empty...moving on to next batch.")

                # Check early stopping condition
                if early_stop != -1 and i >= early_stop - 1:
                    break

            print("Processing finished!")

            # Find skipped indexes, as those images will be retrieved later. Dump the missing indexes into a file.
            self._save_missing_indexes(start, is_missing_indexes)

            # Pack results in dictionary and return it to caller
            return {'embeddings': self._embeddings, **self._attributes}

        except Exception as e:
            # Print exception information
            print(e.__str__())
            print("Error in generateDatabaseEmbeddings.")

            # Save info on missing indexes
            self._save_missing_indexes(start, is_missing_indexes)

            # Pack partial results in dictionary and return it to caller
            return {'embeddings': self._embeddings, **self._attributes}
