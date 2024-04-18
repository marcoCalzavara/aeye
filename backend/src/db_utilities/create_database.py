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
        print("Failed to create database.")
        sys.exit(1)


if __name__ == "__main__":
    # Create a connection to Milvus
    create_connection(ROOT_USER, ROOT_PASSWD)
    # Create a database
    create_database()
