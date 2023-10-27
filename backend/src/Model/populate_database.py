import getopt
import os
import sys

import deeplake
import warnings
import contextlib
import io
import pinecone

import torch
import PIL.Image

from CLIPEmbeddings import ClipEmbeddings
from DatasetPreprocessor import DatasetPreprocessor
from CONSTANTS import *
from utilities import collate_fn

# Increase pixel limit
PIL.Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


def parsing():
    # Remove 1st argument from the list of command line arguments
    arguments = sys.argv[1:]

    # Options
    options = "hb:r:s:"

    # Long options
    long_options = ["help", "batch_size", "repopulate", "early_stop"]

    # Prepare flags
    flags = {"batch_size": BATCH_SIZE, "repopulate": False, "early_stop": -1}

    # Parsing argument
    arguments, values = getopt.getopt(arguments, options, long_options)

    if len(arguments) > 0 and arguments[0][0] in ("-h", "--help"):
        print(f'This script populates a vector store with embeddings.\n\
        -b or --batch_size: batch size used for loading the dataset (default={BATCH_SIZE}).\n\
        -r or --repopulate: whether to empty the database and repopulate. Type y for repopulating the store, '
              f'n otherwise (default={"n" if not flags["repopulate"] else "y"}).\n\
        -s or --early_stop: batches to process. Type -1 to process all samples, a number greater equal then 1 otherwise'
              f' (default={flags["early_stop"]}).')
        sys.exit()

    # Checking each argument
    for arg, val in arguments:
        if arg in ("-b", "--batch_size"):
            if int(val) >= 1:
                flags["batch_size"] = int(val)
            else:
                raise ValueError("Batch size must be at least 1.")
        elif arg in ("-r", "--repopulate"):
            if val == "y":
                flags["repopulate"] = True
            elif val == "n":
                flags["repopulate"] = False
            else:
                raise ValueError("repopulate must be y or n.")
        elif arg in ("-s", "--early_stop"):
            if int(val) == 0:
                raise ValueError("early_stop cannot be 0")
            else:
                flags["early_stop"] = int(val)

    return flags


def upsert_vectors(index: pinecone.Index, data: dict):
    """

    :param index:
    :param data: A dictionary with the embeddings and any other attribute of the samples. All values are tensors and
    all tensors must have the same length. Data must contain keys 'embeddings' and 'index'.
    :return:
    """

    print("Starting the upsert...")
    # Get data keys
    keys = list(data.keys())

    # Checks that data is conforming to requirements.
    if "embeddings" not in keys:
        print("Embeddings are not in data, impossible to upsert vectors.")
        return
    if "index" not in keys:
        print("Indeces are not in data, impossible to upsert vectors.")
        return
    if len(data["embeddings"].shape) != 2:
        print("'embeddings' should form a matrix.")
        return
    for key in keys:
        if type(data[key]) is not torch.Tensor:
            print(f"{key} should be a tensor.")
            return
        if key != "embeddings":
            if len(data[key].shape) > 1:
                print(f"Attributes should be one dimensional, but {key} is not.")
                return
            if data[key].shape[0] != data["embeddings"].shape[0]:
                print(f"Attributes should match the number of embeddings, but this is not true for {key}.")
                return

    # Remove embeddings and index from keys.
    keys.remove("embeddings")
    keys.remove("index")

    try:
        with open(FILE_MISSING_INDECES, "r") as f:
            first_line = f.readline()
            missing_indeces = list(map(int, first_line.strip().split(", "))) if first_line.strip() else []
            start = f.readline()
    except Exception as e:
        print(e.__str__())
        missing_indeces = []
        start = 0

    for i in range(0, data["embeddings"].shape[0], UPSERT_SIZE):
        try:
            index.upsert(vectors=[
                (
                    str(data["index"][j].item()),
                    data["embeddings"][j].tolist(),
                    {key: data[key][j].item() for key in keys}

                ) for j in range(i, i + UPSERT_SIZE) if j < data["embeddings"].shape[0]])
        except Exception as e:
            print(e.__str__())
            # Update file with missing indeces
            missing_indeces = list(set(missing_indeces + [data["index"][j].item() for j in range(i, i + UPSERT_SIZE)
                                                          if j < data["embeddings"].shape[0]]))
            continue

    with open(FILE_MISSING_INDECES, "w") as f:
        f.write(', '.join(map(str, missing_indeces)) + "\n")
        f.write(start)

    print("Upsert completed!")


def update_metadata(index: pinecone.Index, dp: DatasetPreprocessor, upper_value_index_range: int):
    print("Adding low dimensional embeddings...")
    # Fetch vectors
    fetch_res = index.fetch(ids=list(range(upper_value_index_range)))
    # Process records
    embeddings = None
    for key in fetch_res["vectors"].keys():
        if embeddings is None:
            embeddings = torch.tensor(fetch_res["vectors"][key]["values"]).detach()
        else:
            embeddings = torch.stack((embeddings,
                                      torch.tensor(fetch_res["vectors"][key]["values"])), dim=0).detach()

    # Set embeddings
    dp.setEmbeddings(embeddings)
    # Get metadata
    data = dp.generateRecordsMetadata(plot=True)

    # Update vectors
    for key in fetch_res["vectors"].keys():
        new_metadata = {"cluster_id": data["cluster_ids"][int(key)]}
        for i in range(data["low_dim_embeddings"].shape[1]):
            new_metadata[f"low_dim_{i}"] = data["low_dim_embeddings"][int(key)][i]

        index.update(id=key, set_metadata=new_metadata)

    print("Update completed!")


if __name__ == "__main__":
    # Get arguments
    flags = parsing()

    # Create reference to pinecone index
    pinecone.init(api_key=PINECONE_API_KEY, environment=PINECONE_ENV)
    index = pinecone.Index(PINECONE_INDEX_NAME)

    # Get dataset
    with contextlib.redirect_stdout(io.StringIO()):
        ds = deeplake.load(WIKIART)

    missing_indeces = []
    start = 0
    if os.path.exists(FILE_MISSING_INDECES):
        # Get information from file
        with open(FILE_MISSING_INDECES, "r") as f:
            first_line = f.readline()
            missing_indeces = list(map(int, first_line.strip().split(", "))) if first_line.strip() else []
            start = int(f.readline())

    # The else condition is not important, as the abscence of a file means that either this is the first iteration of
    # the processing procedure, or an error message has been displayed in the previous iteration.

    # Evaluate flags["repopulate"]
    if flags["repopulate"]:
        # Delete all vectors in the index and define start point for dataloader
        # TODO change this part, as deleteAll is not supported by the free tier
        index.delete(deleteAll=True)
        missing_indeces = []
        start = 0
    else:
        # Check the number of remaining data points
        if ds.min_len - start < flags["batch_size"]:
            # We don't have enough remaining samples for a batch.
            # Set get_missing_indeces to true.
            missing_indeces.append((range(start, ds.min_len)))

    # Define device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    # Create an embedding object
    embeddings = ClipEmbeddings(device=device)
    # Create dataset preprocessor
    dp = DatasetPreprocessor(embeddings, missing_indeces)

    # If there are no missing_indeces and the start is equal to the size of the dataset, then update the metadata by
    # adding low dimensional embeddings.
    if len(missing_indeces) == 0 and start == ds.min_len:
        update_metadata(index, dp, ds.min_len)

    else:
        # Get data and populate database
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", category=UserWarning)

            print("Starting processing data...")

            if ds.min_len - start >= flags["batch_size"]:
                # Create dataloader
                dataloader = ds[start:].pytorch(num_workers=NUM_WORKERS,
                                                transform={'images': embeddings.processData, 'labels': None,
                                                           'index': None},
                                                batch_size=BATCH_SIZE,
                                                decode_method={'images': 'pil'},
                                                collate_fn=collate_fn)

                data = dp.generateDatabaseEmbeddings(dataloader, False, start, flags["early_stop"])

            else:
                # Create dataloader from missing indeces
                dataloader = ds[missing_indeces].pytorch(num_workers=NUM_WORKERS,
                                                         transform={'images': embeddings.processData, 'labels': None,
                                                                    'index': None},
                                                         batch_size=BATCH_SIZE,
                                                         decode_method={'images': 'pil'},
                                                         collate_fn=collate_fn)
                data = dp.generateDatabaseEmbeddings(dataloader, True, ds.min_len)

            # Add data to vector store
            upsert_vectors(index, data)

    print("Process finished!")
    sys.exit(0)
