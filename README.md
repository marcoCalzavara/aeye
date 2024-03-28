# Image Viz

Visualization tool for understanding how AI sees artworks.

## Instructions for use
The whole application can be deployed using the deploy.sh script. This script gives the option to create the React 
build, and then runs `docker compose up -d` to create the containerized application. The application is made up of
the following containers:
- **nginx**: The web server that manages all requests.
- **backend**: The Flask API that handles all requests to the backend. The requests are forwarded to the backend by the 
nginx server.
- **frontend**: The container which runs `server -s build` to serve the React application. The build can be accessed
from '/'.
- **milvus-minio**.
- **milvus-etcd**.
- **milvus-standalone**.

The last three containers are used to run the Milvus database.
Once the application is running, one can use the shell script container-command.sh to run commands inside a container.
All python scripts must be executed within the backend directory using the module flag, e.g.
`python -m src.db_utilities.populate_embeddings_collection`. The python scripts must be launched using 
`export ENV_FILE_LOCATION=$HOME/image-viz/.env && python -m `, followed by the path to the module
(change the path to the .env file if necessary). The .env file contains the environment variables.
The scripts folder in the backend folder contains scripts to download some datasets. For example, the script set-best-artworks.sh
can be used to download all the artworks from the following link: https://www.kaggle.com/ikarus777/best-artworks-of-all-time. Follow the instructions
at https://www.kaggle.com/docs/api#getting-started-installation-&-authentication to be able to use the Kaggle API. The 
shell script set-best-artworks.sh will not only download the data, but also rename all the files such that each file 
starts with an index number. This is required by src.db_utilities.populate_embeddings_collection.
Once the dataset has been downloaded, the python script populate_embeddings_collection.py can be used to populate an 
embeddings collection in the Milvus database. Run `export ENV_FILE_LOCATION=$HOME/image-viz/.env && python -m src.db_utilities.populate_embeddings_collection -h`
to see which arguments can be passed to the script. The script will create a collection with the name of the dataset, and fill it with the CLIP embeddings
of the images in the dataset.
There are other python scripts that can be used to manage the database:
- **src.db_utilities.delete_collection**: Deletes a collection from the database.
- **src.db_utilities.create_embeddings_collection**: Creates an embeddings collection in the database. The created collection
is empty and has 'temp_' in its name to indicate that it is a temporary collection. 'temp_' will be removed by 
populate_embeddings_collection.py once all embeddings are available and the low dimensional embeddings have been
calculated.
- **src.resize_images**: Resizes all images in a dataset to a given size. The resized images are saved in a
new folder within the folder of the original dataset. The new folder is named 'resized_images'. The resized images are
used for serving the images faster.

All above modules do not offer a -h flag, but they will directly ask for all necessary arguments, so you can just run
them without any arguments.
In order to create the data required by the frontend, run the python script src.db_utilities.create_and_populate_clusters_collection.
This script will create a collection with the name of the dataset and the suffix '_zoom_levels_clusters', and another collection with the 
suffix '_image_to_tile'.
One can run `export ENV_FILE_LOCATION=$HOME/image-viz/.env && python -m src.db_utilities.create_and_populate_clusters_collection -h` to see which arguments can be passed
to the script.
