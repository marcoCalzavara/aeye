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
