import getpass
import os
import sys

from dotenv import dotenv_values
from pymilvus import db

from .utils import create_connection
from ..CONSTANTS import *


def create_database(create_default=True) -> str:
    try:
        # Ask user for database name
        if create_default:
            db_name = DEFAULT_DATABASE_NAME
        else:
            db_name = input("Choose database (enter to use default): ")
            if db_name == "":
                db_name = DEFAULT_DATABASE_NAME
        # Create a database and switch to the newly created database if it does not exist
        if db_name not in db.list_database():
            db.create_database(DEFAULT_DATABASE_NAME)
            return db_name
        else:
            print("Database already exists.")
            sys.exit(0)

    except Exception as e:
        print(e.__str__())
        sys.exit(1)


if __name__ == "__main__":
    # Load environment variables
    if ENV_FILE_LOCATION not in os.environ:
        # Try to load /.env file
        choice = input("Do you want to load /.env file? (y/n) ")
        if choice.lower() == "y" and os.path.exists("/.env"):
            env_variables = dotenv_values("/.env")
        else:
            print("export .env file location as ENV_FILE_LOCATION. Export $HOME/image-viz/.env if running outside "
                  "of docker container, export /.env if running inside docker container backend.")
            sys.exit(1)
    else:
        # Load environment variables
        env_variables = dotenv_values(os.environ[ENV_FILE_LOCATION])

    if ROOT in env_variables and env_variables[ROOT] == "1":
        create_connection(ROOT_USER, ROOT_PASSWD)
        create_database()
    else:
        choice = input("Use root user? (y/n) ")
        if choice.lower() == "y":
            create_connection(ROOT_USER, ROOT_PASSWD)
            # Create default database
            create_database()
        elif choice.lower() == "n":
            user = input("Username: ")
            passwd = getpass.getpass("Password: ")
            create_connection(user, passwd)
            # Create default database
            create_database()
        else:
            print("Wrong choice.")
            sys.exit(1)
