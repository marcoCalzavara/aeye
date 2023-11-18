# Important 
* For each dataset, create a folder with the name of the dataset and put the files inside it. All images names must 
start with the index of the image, which is used to identify the image in the database. The index must be a number. 
Indexes must go from 0 to the number of images in the dataset minus 1. The images must be in the format .jpg.
* Each Milvus collection must have the same name as the folder containing the dataset. Moreover, the collection must 
contain a field called index, which is the field used to identify the image in the database, a field called embedding, 
and a field called path, which is the path to the image in the dataset. The field embedding must be of type vector.
* The name of the dataset must be recognizable. For example, if the dataset is a subset of the ImageNet dataset, call
the collection imagenet_subset.
* The database used by the server is named "aiplusart". Put all the collections that you want to use in the server in
this database. DO NOT PUT ANY OTHER COLLECTIONS IN THIS DATABASE.
* All initially empty collections should be named temp_collection_1, temp_collection_2, etc. populate_database.py will
automatically delete these collections after populating them with the low dimensional embeddings of the images in the
dataset. After deleting a temporary collection, populate_database.py will create a new collection with the same name
but without the "temp_" prefix.