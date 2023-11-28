import os
import sys

import dotenv
from pymilvus import connections

from ..CONSTANTS import MILVUS_IP, MILVUS_PORT, ENV_FILE_LOCATION


def create_connection(user, passwd):
    if ENV_FILE_LOCATION not in os.environ:
        print("export .env file location as ENV_FILE_LOCATION. Export $HOME/image-viz/.env if running outside of docker"
              " container, export /.env if running inside docker container backend.")
        sys.exit(1)
    dotenv.load_dotenv(os.environ[ENV_FILE_LOCATION])
    connections.connect(
        host=os.getenv(MILVUS_IP),
        port=os.getenv(MILVUS_PORT),
        user=user,
        password=passwd
    )
