import getpass
import os
import sys

from dotenv import load_dotenv
from pymilvus import utility, db

from .utils import create_connection
from ..CONSTANTS import *


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

    # Get arguments
    flags = {"database": DEFAULT_DATABASE_NAME, "collection": "best_artworks"}

    choice = input("Use root user? (y/n) ")
    if choice == "y":
        user = ROOT_USER
        passwd = ROOT_PASSWD
    elif choice.lower() == "n":
        user = input("Username: ")
        passwd = getpass.getpass("Password: ")
    else:
        print("Wrong choice.")
        sys.exit(1)

    # Try creating a connection and selecting a database. If it fails, exit.
    print("The default database is " + flags["database"] + ".")
    choice = input("Select database (enter to keep default): ")
    if choice != "":
        flags["database"] = choice
    try:
        create_connection(user, passwd)
        db.using_database(flags["database"])
    except Exception as e:
        print(e.__str__())
        print("Error in main. Connection failed!")
        sys.exit(1)

    # Get the collection object
    old_collection_name = input("Enter the old collection name: ")
    new_collection_name = input("Enter the new collection name: ")
    # Rename collection
    utility.rename_collection(old_collection_name, new_collection_name, new_db_name=flags["database"])
