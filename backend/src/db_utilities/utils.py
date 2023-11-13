import os

from pymilvus import connections
from ..CONSTANTS import MILVUS_IP, MILVUS_PORT


def create_connection(user, passwd):
    connections.connect(
        host=os.environ[MILVUS_IP],
        port=os.environ[MILVUS_PORT],
        user=user,
        password=passwd
    )
