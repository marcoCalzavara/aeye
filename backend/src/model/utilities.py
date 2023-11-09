import warnings

import matplotlib.patches as mpatches
import numpy as np
import torch
from matplotlib import pyplot as plt
from matplotlib.patches import Ellipse
from scipy import linalg
from umap import UMAP

from ..CONSTANTS import *


def project_embeddings_UMAP(embeddings: torch.Tensor | np.ndarray, n_neighbors=DEFAULT_N_NEIGHBORS, dim=DEFAULT_DIM,
                            min_dist=DEFAULT_MIN_DIST) -> np.ndarray:
    """
    Project _embeddings onto lower dimensional space of dimension dim using UMAP_PROJ algorithm.
    :param embeddings: Embeddings of shape (NUM_EMBEDDINGS, EMBEDDINGS_DIM).
    :param n_neighbors: Number of the nearest neighbors used by the algorithm.
    :param dim: Dimensionality of projection space.
    :param min_dist: Minimum distance allowed between projected points.
    :return: Projected _embeddings.
    """
    assert len(embeddings.shape) == 2 and dim < embeddings.shape[1]

    # Project data
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=DeprecationWarning)
        reducer = UMAP(n_neighbors=n_neighbors, n_components=dim, min_dist=min_dist, random_state=RANDOM_STATE,
                       n_jobs=1)
        return reducer.fit_transform(embeddings)


def plot_low_dimensional_embeddings(low_dim_embeddings, labels, means, covariances):
    fig, ax = plt.subplots(figsize=(20, 20))

    handles = []
    for (i, mean, covar, color) in zip(torch.unique(labels), means, covariances, COLORS):
        ax.scatter(low_dim_embeddings[labels == i, 0], low_dim_embeddings[labels == i, 1], 2.,
                   color=color, label=f'{LABELS_MAPPING[i.item()]}')
        # Plot an ellipse to show the Gaussian component
        v, w = linalg.eigh(covar)
        v = 2.0 * np.sqrt(2.0) * np.sqrt(v)
        u = w[0] / linalg.norm(w[0])
        angle = np.arctan(u[1] / u[0])
        angle = 180.0 * angle / np.pi  # convert to degrees
        ell = Ellipse(mean, v[0], v[1], angle=180.0 + angle, color='#D3D3D3')
        ell.set_clip_box(ax.bbox)
        ell.set_alpha(0.2)
        ax.add_artist(ell)
        handles.append(mpatches.Patch(color=color, label=f'{LABELS_MAPPING[i.item()]}'))

    ax.legend(handles=handles, fontsize=12)
    ax.tick_params(axis='both', which='major', labelsize=20)
    plt.show()


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
            "labels": torch.tensor([x["label"] for x in batch_data]).detach(),
            "index": torch.tensor([x["index"] for x in batch_data]).detach()
        }

    except Exception as e:
        print(e.__str__())
        return
