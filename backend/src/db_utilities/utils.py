import getopt
import os
import sys

import dotenv
import numpy as np
from pymilvus import connections
from sklearn.cluster import KMeans
from sklearn.metrics import euclidean_distances

from .datasets import DatasetOptions
from ..CONSTANTS import *


def parsing():
    # Remove 1st argument from the list of command line arguments
    arguments = sys.argv[1:]

    # Options
    options = "hd:c:r:i:"

    # Long options
    long_options = ["help", "database", "collection", "repopulate", "images"]

    # Prepare flags
    flags = {"database": DEFAULT_DATABASE_NAME,
             "collection": DatasetOptions.BEST_ARTWORKS.value["name"],
             "repopulate": False,
             "images": False}

    # Parsing argument
    arguments, values = getopt.getopt(arguments, options, long_options)

    if len(arguments) > 0 and arguments[0][0] in ("-h", "--help"):
        print(f'This script generates zoom levels.\n\
        -d or --database: database name (default={flags["database"]}).\n\
        -c or --collection: collection name (default={flags["collection"]}).\n\
        -r or --repopulate: repopulate the collection. Options are y/n (default='
              f'{"y" if flags["repopulate"] == "y" else "n"}).\n\
        -i or --images: save images. Options are y/n (default='
              f'{"y" if flags["images"] else "n"}).')
        sys.exit(0)

    # Checking each argument
    for arg, val in arguments:
        if arg in ("-d", "--database"):
            flags["database"] = val
        elif arg in ("-c", "--collection"):
            if val in [dataset.value for dataset in DatasetOptions]:
                flags["collection"] = val
            else:
                raise ValueError("The collection must have one of the following names: "
                                 + str([dataset.value["name"] for dataset in DatasetOptions]))
        elif arg in ("-r", "--repopulate"):
            if val == "y":
                flags["repopulate"] = True
            elif val == "n":
                flags["repopulate"] = False
            else:
                raise ValueError("The repopulate flag must be either y or n.")
        elif arg in ("-i", "--images"):
            if val == "y":
                flags["images"] = True
            elif val == "n":
                flags["images"] = False
            else:
                raise ValueError("The images flag must be either y or n.")

    return flags


def create_connection(user, passwd):
    if ENV_FILE_LOCATION not in os.environ:
        # Try to load /.env file
        if os.path.exists("/.env"):
            dotenv.load_dotenv("/.env")
        else:
            print("export .env file location as ENV_FILE_LOCATION. Export $HOME/image-viz/.env if running outside "
                  "of docker container, export /.env if running inside docker container backend.")
            sys.exit(1)
    else:
        # Load environment variables
        dotenv.load_dotenv(os.getenv(ENV_FILE_LOCATION))

    connections.connect(
        host=os.getenv(MILVUS_IP),
        port=os.getenv(MILVUS_PORT),
        user=user,
        password=passwd
    )


class ModifiedKMeans:
    def __init__(self, n_clusters, random_state, n_init=10, max_iter=300):
        self.n_clusters = n_clusters
        self.random_state = random_state
        self.n_init = n_init
        self.max_iter = max_iter
        self.kmeans = KMeans(n_clusters=n_clusters, random_state=random_state, n_init=n_init, max_iter=max_iter)
        self._inertia = sys.maxsize
        self.cluster_centers_ = None

    @staticmethod
    def _compute_initial_centers(X, fixed_centers, num_remaining_centers, n_init):
        centroids = fixed_centers

        # compute remaining k - 1 centroids
        for _ in range(num_remaining_centers):
            # initialize a list to store distances of data
            # points from nearest centroid
            dist = np.zeros(X.shape[0])
            for i in range(X.shape[0]):
                point = X[i, :]
                d = sys.maxsize

                # compute distance of 'point' from each of the previously
                # selected centroid and store the minimum distance
                for j in range(len(centroids)):
                    temp_dist = np.sum((point - centroids[j]) ** 2)
                    d = min(d, temp_dist)
                dist[i] = d

            # select data point with maximum distance as our next centroid
            if n_init == 1:
                next_centroid = X[np.argmax(dist), :]
            else:
                # Get centroid at random using probability proportional to distance
                next_centroid = X[np.random.choice(X.shape[0], p=dist / np.sum(dist)), :]

            centroids = np.vstack([centroids, next_centroid])

        return centroids

    def fit(self, X, fixed_centers=None):
        """
        Perform k-means clustering. If fixed_centers is provided, then the corresponding centers are fixed and the
        difference self.n_clusters - len(fixed_centers) are initialized using kmeans++ initialization. If fixed_centers
        is not provided, then perform regular k-means clustering.
        @param X:
        @param fixed_centers:
        @return:
        """
        if fixed_centers is None:
            self.kmeans.fit(X)
            self._inertia = self.kmeans.inertia_
            self.cluster_centers_ = self.kmeans.cluster_centers_
        else:
            # Do k-means clustering with fixed centers for self.n_init times. Keep the best result.
            for _ in range(self.n_init):
                # Generate random centers for the remaining clusters
                centers = ModifiedKMeans._compute_initial_centers(X, fixed_centers,
                                                                  self.n_clusters - len(fixed_centers), self.n_init)
                # Now the first len(fixed_centers) centers are fixed and the remaining centers can move
                # Do k-means clustering with fixed centers
                it = 0
                while it < self.max_iter:
                    # Assign labels to each datapoint based on centers
                    labels = np.argmin(euclidean_distances(X, centers), axis=1)
                    # Find new centers from means of datapoints
                    new_moving_centers = np.zeros((centers.shape[0] - fixed_centers.shape[0], X.shape[1]))
                    for i in range(fixed_centers.shape[0], centers.shape[0]):
                        if i not in labels:
                            # If a cluster has no points, then set the center to a random point
                            new_moving_centers[i - fixed_centers.shape[0]] = X[np.random.choice(X.shape[0]), :]
                        else:
                            new_moving_centers[i - fixed_centers.shape[0]] = np.mean(X[labels == i], axis=0)
                    # If centers have converged, then break
                    if np.all(centers[fixed_centers.shape[0]:] == new_moving_centers):
                        break
                    else:
                        centers[fixed_centers.shape[0]:] = new_moving_centers
                    it += 1

                # Compute inertia and select the new result as best if it has lower inertia.
                inertia = np.sum(np.min(euclidean_distances(X, centers), axis=1))
                if inertia < self._inertia and inertia != 0:
                    self._inertia = inertia
                    self.cluster_centers_ = centers

    def predict(self, X):
        return np.argmin(euclidean_distances(X, self.cluster_centers_), axis=1)
