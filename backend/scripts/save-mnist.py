import idx2numpy
from PIL import Image
import os
import sys
from dotenv import load_dotenv
from ..src.CONSTANTS import ENV_FILE_LOCATION, HOME


if __name__ == "__main__":
    # Load environment variables
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

    # Get training images
    file_path = os.getenv(HOME) + "/MNIST/train-images.idx3-ubyte"
    train = idx2numpy.convert_from_file(file_path)

    index = 0
    # Save images to os.getenv(HOME) + "/mnist-dataset directory as index.png
    for image in train:
        im = Image.fromarray(image)
        im.save(os.getenv(HOME) + "/MNIST/" + str(index) + ".png")
        index += 1

    # Get test images
    file_path = os.getenv(HOME) + "/MNIST/t10k-images.idx3-ubyte"
    test = idx2numpy.convert_from_file(file_path)

    for image in test:
        im = Image.fromarray(image)
        im.save(os.getenv(HOME) + "/MNIST/" + str(index) + ".png")
        index += 1

    # Remove both train-images.idx3-ubyte and t10k-images.idx3-ubyte
    os.remove(os.getenv(HOME) + "/MNIST/train-images.idx3-ubyte")
    os.remove(os.getenv(HOME) + "/MNIST/t10k-images.idx3-ubyte")
    print("Images saved.")
