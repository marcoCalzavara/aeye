# Check that the script is being run from the backend directory using pwd
if [ "$(pwd)" != "$HOME/image-viz/backend" ]; then
  echo "Please run this script from the backend directory."
  exit
fi

echo "Make sure the dataset is downloaded and in the HOME before running this script."
read -r -p "Is that true? (y/n) " condition
# If the condition is not met, exit the script
if [ "$condition" != "y" ]; then
  echo "Please download the dataset and place it in the HOME before running this script."
  exit
fi
# Ask for directory and dataset names. Make sure the dataset name has no white spaces or special characters
# other than _
read -r -p "Enter the name of the directory where the dataset is located: " directory
# Check if the directory exists
if [ ! -d "$HOME/$directory" ]; then
  echo "The directory does not exist. Please make sure the dataset is in HOME."
  exit
fi
read -r -p "Enter the name you want to give to the dataset: " dataset_name
# Check dataset name for white spaces or special characters and check that the name is shorter than 20 characters and
# not empty
while [[ ! "$dataset_name" =~ ^[a-zA-Z0-9_]+$ ]] || [ ${#dataset_name} -gt 20 ] || [ -z "$dataset_name" ]; do
  echo "The dataset name can only contain letters, numbers, and underscores, and must be 20 characters or less."
  read -r -p "Enter the name you want to give to the dataset: " dataset_name
done
result=$(export ENV_FILE_LOCATION=$HOME/image-viz/.env && python3 -m src.dataset_creation.check_if_dataset_exists -c "$dataset_name")
if [ $? -ne 0 ]; then
  exit
fi

while [ "$result" != "All good." ]; do
  echo "The dataset already exists."
  read -r -p "Do you want to overwrite the dataset collections? (y/n) " condition
  if [ "$condition" == "y" ]; then
    # Exit the loop
    break
  fi
  read -r -p "Enter the name you want to give to the dataset: " dataset_name
  while [[ ! "$dataset_name" =~ ^[a-zA-Z0-9_]+$ ]] || [ ${#dataset_name} -gt 20 ] || [ -z "$dataset_name" ]; do
    echo "The dataset name can only contain letters, numbers, and underscores, and must be 20 characters or less."
    read -r -p "Enter the name you want to give to the dataset: " dataset_name
  done
  result=$(export ENV_FILE_LOCATION=$HOME/image-viz/.env && python3 -m src.dataset_creation.check_if_dataset_exists -c "$dataset_name")
  if [ $? -ne 0 ]; then
    exit
  fi
done

# Ask for information about the dataset
echo "Adding information about the dataset to datasets.json..."
# Ask if a new class for the dataset has been created
read -r -p "Has a new class been created for the dataset? (y/n, n for default) " condition
class_name="SupportDatasetForImagesCommon"
if [ "$condition" == "y" ]; then
  read -r -p "Enter the name of the new class: " class_name
fi
# Ask if a new collate_fn for the dataset has been created
read -r -p "Has a new collate_fn been created for the dataset? (y/n, n for default) " condition
collate_fn="common_collate_fn"
if [ "$condition" == "y" ]; then
  read -r -p "Enter the name of the new collate_fn: " collate_fn
fi

# Run the script to add the dataset to datasets.json
export ENV_FILE_LOCATION=$HOME/image-viz/.env && python3 -m src.dataset_creation.add_dataset_to_list -c "$dataset_name" -s "$class_name" -f "$collate_fn" -l "$directory"
if [ $? -ne 0 ]; then
  exit
fi

# Create dataset with embeddings
echo "Creating dataset with embeddings..."
# Choose batch size
read -r -p "Enter the batch size for the dataset: " batch_size
export ENV_FILE_LOCATION=$HOME/image-viz/.env && python3 -m src.db_utilities.create_and_populate_embeddings_collection -c "$dataset_name" -b "$batch_size" -r y
if [ $? -ne 0 ]; then
  echo "An error occurred. Please try again."
  exit
fi

# Create tiles and image-to-tile collections
echo "Creating tiles and image-to-tile collections..."
export ENV_FILE_LOCATION=$HOME/image-viz/.env && python3 -m src.db_utilities.create_and_populate_clusters_collection -c "$dataset_name" -r y
if [ $? -ne 0 ]; then
  echo "An error occurred. Please try again."
  exit
fi

echo "Creating folder with resized images. These images will be served by the backend to avoid fetching the original images.
This will make the application faster. Skip if the images are already small, as the resizing would not help."
read -r -p "Do you want to resize the images? (y/n) " condition_resize
if [ "$condition_resize" == "y" ]; then
  # Resize images
  echo "Resizing images..."
  export ENV_FILE_LOCATION=$HOME/image-viz/.env && python3 -m src.resize_images -d "$dataset_name" -o y
  if [ $? -ne 0 ]; then
    echo "An error occurred. Please try again."
    exit
  fi
fi

# Add location to the nginx.conf.template file
echo "Adding location to nginx.conf.template..."
# First, update the nginx.conf.json file
export ENV_FILE_LOCATION=$HOME/image-viz/.env && python3 -m src.dataset_creation.add_location -n "$dataset_name" -d "$directory" -r "$condition_resize"
# Then, update the nginx.conf.template file
python3 -m src.dataset_creation.generate_nginx_conf > "$(pwd)"/nginx/nginx.conf.template
# Then, update the docker-compose.yml file
export ENV_FILE_LOCATION=$HOME/image-viz/.env && python3 -m src.dataset_creation.add_volume_to_nginx_service -d "$directory"
# Finally, recreate the nginx service
docker compose up -d --force-recreate nginx
