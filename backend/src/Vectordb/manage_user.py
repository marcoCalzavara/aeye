import getpass

from pymilvus import utility, connections

from src.CONSTANTS import *

resp = input("Create new user (0) or change password (1)? ")
if resp == '0':
    user = getpass.getpass("Username:")
    passwd = getpass.getpass("Password: ")
    passwd_check = getpass.getpass("Repeat password: ")
    while passwd != passwd_check:
        print("The password was wrong.")
        passwd = getpass.getpass("Password: ")
        passwd_check = getpass.getpass("Repeat password: ")
    passwd_root = getpass.getpass("Root password: ")
    # Create user
    try:
        connections.connect(
            host=HOST,
            port=PORT,
            user=ROOT_USER,
            password=passwd_root,
        )
        utility.create_user(user, passwd)
    except Exception as e:
        print(e.__str__())
elif resp == '1':
    user = getpass.getpass("Username:")
    old_passwd = getpass.getpass("Old password: ")
    new_passwd = getpass.getpass("New password: ")
    new_passwd_check = getpass.getpass("Repeat new password: ")
    while new_passwd != new_passwd_check:
        print("The password was wrong.")
        new_passwd = getpass.getpass("New password: ")
        new_passwd_check = getpass.getpass("Repeat new password: ")
    # Create connection
    try:
        connections.connect(
            host=HOST,
            port=PORT,
            user=user,
            password=old_passwd,
        )

        # Change password
        utility.reset_password(user, old_passwd, new_passwd)
    except Exception as e:
        print(e.__str__())
else:
    print("Not a valid option.")
