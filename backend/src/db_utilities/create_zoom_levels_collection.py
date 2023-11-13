# import sys
# import typing
#
# from pymilvus import Collection
# from pymilvus import utility, db
#
# from .collections import embeddings_collection
# from ..CONSTANTS import *
#
#
# def create_zoom_levels_collection(collection_name=None,
#                                   on_start=False,
#                                   choose_database=True) -> typing.Tuple[Collection, str]:
#     """
#     Create a collection for zoom levels.
#     """
#     try:
#         # Create a database and switch to the newly created database
#         if on_start and DEFAULT_DATABASE_NAME not in db.list_database():
#             db.create_database(DEFAULT_DATABASE_NAME)
#             db.using_database(DEFAULT_DATABASE_NAME)
#         elif on_start:
#             # If the database already exists, switch to it. This code should never be reached.
#             db.using_database(DEFAULT_DATABASE_NAME)
#         else:
#             if choose_database:
#                 # Choose a database. If the database does not exist, create it.
#                 db_name = input("Choose database: ")
#                 if db_name not in db.list_database():
#                     choice = input("The database does not exist. 'n' will revert to default database. Create one? ("
#                                    "y/n) ")
#                     if choice.lower() == "y":
#                         db.create_database(db_name)
#                         db.using_database(db_name)
#                     elif choice.lower() == "n":
#                         if DEFAULT_DATABASE_NAME not in db.list_database():
#                             db.create_database(DEFAULT_DATABASE_NAME)
#                         db.using_database(DEFAULT_DATABASE_NAME)
#                     else:
#                         print("Wrong choice.")
#                         sys.exit(1)
#             else:
#                 if DEFAULT_DATABASE_NAME not in db.list_database():
#                     db.create_database(DEFAULT_DATABASE_NAME)
#                 db.using_database(DEFAULT_DATABASE_NAME)
#
#         # Choose collection name and create a collection
#         if collection_name is None:
#             collection_name = input("Choose collection name: ")
#
#         if collection_name in utility.list_collections():
#             print("Collection already exists.")
#             sys.exit(0)
#
#         return embeddings_collection(collection_name), collection_name
#
#     except Exception as e:
#         print(e.__str__())
#         sys.exit(1)
