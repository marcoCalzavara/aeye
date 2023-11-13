from typing import Dict

import numpy as np
import torch
from tqdm import tqdm

from ..model.EmbeddingsModel import EmbeddingsModel
from ..model.utils import project_embeddings_UMAP
from ..CONSTANTS import *


class DatasetPreprocessor:
    """
    Module for generating the data which is stored in the database.
    """

    def __init__(self, embeddings_model: EmbeddingsModel, missing_indeces):
        """
        :param embeddings_model:
        """
        self.embeddings_model = embeddings_model
        self._missing_indeces = missing_indeces
        self._embeddings = None
        self._attributes = {}
        self._low_dim_embeddings = None
        self._cluster_ids = None
        self._skipped_indeces = []

    def setEmbeddings(self, embeddings):
        self._embeddings = embeddings

    def _generateEmbeddings(self, inputs):
        """
        Generate _embeddings of data using the provided _embeddings model. The method requires the inputs to the
        data encoder.
        """
        # This code works for dataloader with batch_size == 1
        if self._embeddings is None:
            self._embeddings = self.embeddings_model.getEmbeddings(inputs).detach()
        else:
            self._embeddings = torch.cat((self._embeddings,
                                          self.embeddings_model.getEmbeddings(inputs)), dim=0).detach()

    def _storeAttributes(self, data, attribute):
        if attribute not in self._attributes:
            self._attributes[attribute] = data[attribute].detach()
        else:
            self._attributes[attribute] = torch.cat((self._attributes[attribute],
                                                     data[attribute]), dim=0).detach()

    def _generateLowDimensionalEmbeddings(self, projection_method):
        assert self._embeddings is not None

        if projection_method == UMAP_PROJ:
            self._low_dim_embeddings = project_embeddings_UMAP(self._embeddings)

    def _save_missing_indeces(self, start, is_missing_indeces_call=False):
        if "index" not in self._attributes.keys():
            return
        else:
            # Compute missing values from current processing step
            if not is_missing_indeces_call:
                upper_value = torch.max(self._attributes["index"]).item()
                complete_tensor_of_indeces = torch.arange(start, upper_value + 1).detach()
                self._missing_indeces = list(
                    set(self._missing_indeces + np.setdiff1d(complete_tensor_of_indeces.cpu().numpy(),
                                                             self._attributes["index"].cpu().numpy()).tolist()))
            else:
                upper_value = start - 1
                self._missing_indeces = np.setdiff1d(np.array(self._missing_indeces),
                                                     self._attributes["index"].cpu().numpy()).tolist()

            # Dump information in file for future use. The information consists of two lines:
            # 1. Indeces of samples that have been skipped.
            # 2. Index of the last sample that has been processed plus 1.
            with open(FILE_MISSING_INDECES, "w") as f:
                f.write(', '.join(map(str, self._missing_indeces)) + "\n")
                f.write(str(upper_value + 1))

            print("Saved information for next iteration!")

    def generateRecordsMetadata(self, projection_method=DEFAULT_PROJECTION_METHOD, plot=False) -> Dict[str, np.ndarray]:
        # Generate low dimensional embeddings
        self._generateLowDimensionalEmbeddings(projection_method)

        return {"low_dim_embeddings": self._low_dim_embeddings}

    def generateDatabaseEmbeddings(self, dataloader, is_missing_indeces=False, start=-1, early_stop=-1):
        """
        Generate dataset embeddings from the dataloader specified when creating the object. The method saves the
        indeces of the samples that could not be fetched in a file, with the index of the next sample after the last
        one that has been correctly fetched and processed.
        :param dataloader:
        :param start:
        :param early_stop: The index for early stopping. If early stopping is not -1, then the processing stops after
        early_stopping batches have been fetched and processed.
        :param is_missing_indeces:
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

            # Find skipped indeces, as those images will be retrieved later. Dump the missing indeces into a file.
            self._save_missing_indeces(start, is_missing_indeces)

            # Pack results in dictionary and return it to caller
            return {'embeddings': self._embeddings, **self._attributes}

        except Exception as e:
            # Print exception information
            print(e.__str__())

            # Save info on missing indeces
            self._save_missing_indeces(start, is_missing_indeces)

            # Pack partial results in dictionary and return it to caller
            return {'embeddings': self._embeddings, **self._attributes}
