#!/bin/bash

# Write variables to a .env file
{
  echo "MILVUS_IP=$MILVUS_IP"
  echo "MILVUS_PORT=$MILVUS_PORT"
  echo "BACKEND_PORT=$BACKEND_PORT"
  echo "START=1"
  echo "WIKIART_COLLECTION=$WIKIART_COLLECTION"
  echo "BEST_ARTWORKS_COLLECTION=$BEST_ARTWORKS_COLLECTION"
} > /.env

# Install netcat
apt-get update
apt-get install -y netcat-openbsd

# Loop until milvus service is available. It should be available as the backend depends on it
max_retries=10
retry_count=0

while ! nc -z "$MILVUS_IP" "$MILVUS_PORT" && [ "$retry_count" -lt "$max_retries" ]; do
  echo "Milvus service not available. Retrying in 5 seconds..."
  sleep 5
  ((retry_count++))
done

if [ "$retry_count" -eq "$max_retries" ]; then
  echo "Failed to connect to Milvus service after $max_retries attempts."
  exit
else
  echo "Milvus service is available at $MILVUS_IP:$MILVUS_PORT."
fi

echo "Creating database and collections..."
for var in $(compgen -e); do
  # Check if the variable ends with "COLLECTION"
  if [[ "$var" == *COLLECTION ]]; then
    # Get value of the variable
    value="${!var}"
    # Create a temporary collection name
    export TEMP_COLLECTION_NAME="temp_$value"
    # Write the temporary collection name to .env file
    echo "TEMP_COLLECTION_NAME=$TEMP_COLLECTION_NAME" >> /.env
    python -m src.db_utilities.create_embeddings_collection
    # Remove "TEMP_COLLECTION_NAME=$TEMP_COLLECTION_NAME" from /.env file
    sed -i '/TEMP_COLLECTION_NAME/d' /.env
  fi
done

# Remove "START=$START" from /.env
sed -i '/START/d' /.env

echo "Database and collections created."

python -m src.app.main
