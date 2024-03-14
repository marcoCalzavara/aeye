#!/bin/bash

# Write variables to a .env file
echo "MILVUS_IP=$MILVUS_IP" > /.env
# shellcheck disable=SC2129
echo "MILVUS_PORT=$MILVUS_PORT" >> /.env
echo "WIKIART_COLLECTION=$WIKIART_COLLECTION" >> /.env
echo "WIKIART_DIR=/wikiart" >> /.env
echo "BEST_ARTWORKS_COLLECTION=$BEST_ARTWORKS_COLLECTION" >> /.env
echo "BEST_ARTWORKS_DIR=/best_artworks" >> /.env
echo "ROOT=1" >> /.env

# Export .env file location
export ENV_FILE_LOCATION=/.env

cat /.env

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

# Sleep for 100 seconds to allow time for the container hosting the milvus service to become healthy
sleep 100

# Get permissions for the datasets
chmod 755 /best_artworks
find /best_artworks -type d -exec chmod 755 {} \;
find /best_artworks -type f -exec chmod 755 {} \;
chmod 755 /wikiart
find /wikiart -type d -exec chmod 755 {} \;
find /wikiart -type f -exec chmod 755 {} \;

# Create default database
echo "Creating default database..."
python -m src.db_utilities.create_database
# Remove ROOT from .env
sed -i '/ROOT/d' /.env

echo "Starting backend..."

# Start the backend
uvicorn src.app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload
