import os
import sys

import PIL.Image
from dotenv import load_dotenv

from .db_utilities.datasets import DatasetOptions
from .CONSTANTS import *

# Increase pixel limit
PIL.Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


def resize_images(dataset_name):
    # Takes images from specified dataset and resizes them to a max width and height while maintaining aspect ratio.
    # Save images in subdirectory of dataset directory called "resized_images"
    # Get directory path
    directory_path = ""
    for dataset in DatasetOptions:
        if dataset.value["name"] == dataset_name:
            directory_path = os.path.join(os.getenv(HOME), os.getenv(dataset.value["directory"]))
            break
    if directory_path == "":
        print(f"Dataset {dataset_name} does not exist.")
        sys.exit(1)

    # First, check if the directory exists
    if not os.path.isdir(directory_path):
        print(f"Directory {directory_path} does not exist.")
        sys.exit(1)

    # Create subdirectory for resized images
    resized_images_dir = os.path.join(directory_path, "resized_images")
    if not os.path.isdir(resized_images_dir):
        os.mkdir(resized_images_dir)
    else:
        choice = input(f"Directory {resized_images_dir} already exists. Do you want to overwrite it? (y/n): ")
        if choice.lower() == "y":
            # Delete contents of directory
            for filename in os.listdir(resized_images_dir):
                os.remove(os.path.join(resized_images_dir, filename))
        else:
            sys.exit(0)

    # Loop over files in dataset directory
    for filename in os.listdir(directory_path):
        try:
            # Check if file is an image
            if not filename.endswith(".jpg"):
                continue
            # Load image
            image = PIL.Image.open(os.path.join(directory_path, filename))
            # Compute height and width using resizing factor
            aspect_ratio = image.width / image.height
            # Get width and height
            if image.width > image.height:
                width = max(image.width, RESIZING_WIDTH)
                height = int(width / aspect_ratio)
            else:
                height = max(image.height, RESIZING_HEIGHT)
                width = int(height * aspect_ratio)

            # Resize image
            image.thumbnail((width, height), PIL.Image.ANTIALIAS)
            # Save image
            image.save(os.path.join(resized_images_dir, filename))
        except Exception as e:
            print(f"Error resizing image {filename}: {e}")
            continue

    print("Done resizing images.")


if __name__ == "__main__":
    if ENV_FILE_LOCATION not in os.environ:
        # Try to load /.env file
        choice = input("Do you want to load /.env file? (y/n) ")
        if choice.lower() == "y" and os.path.exists("/.env"):
            load_dotenv("/.env")
        else:
            print("export .env file location as ENV_FILE_LOCATION. Export $HOME/image-viz/.env if running outside "
                  "of docker container, export /.env if running inside docker container backend.")
            sys.exit(1)
    else:
        # Load environment variables
        load_dotenv(os.getenv(ENV_FILE_LOCATION))

    # Ask user for dataset name
    dataset_name = "best_artworks"
    choice = input(f"Dataset name (default: {dataset_name}, press enter to use default): ")
    if choice != "":
        dataset_name = choice
    # Run main
    resize_images(dataset_name)
