import getpass
import os
import sys

from pymilvus import utility

from ..CONSTANTS import *
from .common_utils import create_connection


def check_user(username, resp):
    if username == ROOT_USER:
        if resp == '0':
            print("Cannot create user root.")
        elif resp == '1':
            print("Cannot change password of root user.")
        sys.exit(1)


# Support option for changing password of root user on startup of Milvus server
if CHANGE_ROOT_USER in os.environ and int(os.environ[CHANGE_ROOT_USER]) == 1:
    try:
        print(f"Connecting to {os.environ[MILVUS_IP]}:{os.environ[MILVUS_PORT]} with user {ROOT_USER} and "
              f"password {OLD_ROOT_PASSWD}...")
        create_connection(ROOT_USER, OLD_ROOT_PASSWD)
        # Change password
        utility.reset_password(ROOT_USER, OLD_ROOT_PASSWD, os.environ[ROOT_PASSWD])
    except Exception as e:
        print(e.__str__())
elif CHANGE_ROOT_USER not in os.environ:
    resp = input("Create new user (0) or change password (1)? ")

    if resp == '0':
        user = getpass.getpass("Username:")
        check_user(user, resp)
        passwd = getpass.getpass("Password: ")
        passwd_check = getpass.getpass("Repeat password: ")
        while passwd != passwd_check:
            print("The password was wrong.")
            passwd = getpass.getpass("Password: ")
            passwd_check = getpass.getpass("Repeat password: ")
        passwd_root = getpass.getpass("Root password: ")
        # Create user
        try:
            create_connection(ROOT_USER, os.environ[ROOT_PASSWD])
            utility.create_user(user, passwd)
        except Exception as e:
            print(e.__str__())
    elif resp == '1':
        user = getpass.getpass("Username:")
        check_user(user, resp)
        old_passwd = getpass.getpass("Old password: ")
        new_passwd = getpass.getpass("New password: ")
        new_passwd_check = getpass.getpass("Repeat new password: ")
        while new_passwd != new_passwd_check:
            print("The password was wrong.")
            new_passwd = getpass.getpass("New password: ")
            new_passwd_check = getpass.getpass("Repeat new password: ")
        # Create connection
        try:
            create_connection(ROOT_USER, os.environ[ROOT_PASSWD])
            # Change password
            utility.reset_password(user, old_passwd, new_passwd)
        except Exception as e:
            print(e.__str__())
    else:
        print("Not a valid option.")
