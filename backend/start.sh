#!/bin/bash

# Write variables to a .env file
echo "MILVUS_IP=$MILVUS_IP" > /.env
# shellcheck disable=SC2129
echo "MILVUS_PORT=$MILVUS_PORT" >> /.env
echo "WIKIART_DIR=/wikiart" >> /.env
echo "BEST_ARTWORKS_DIR=/best_artworks" >> /.env
echo "CELEBAHQ_DIR=/celebahq" >> /.env
echo "MNIST_DIR=/MNIST" >> /.env
echo "CIFAR_100_DIR=/CIFAR-100" >> /.env
echo "FASHION_MNIST_DIR=/Fashion-MNIST" >> /.env
echo "COCO_2017_DIR=/COCO-2017" >> /.env
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

# Give permission to the directories
for dir in best_artworks celebahq COCO-2017 Fashion-MNIST MNIST wikiart CIFAR-100
do
    chmod -R 755 /usr/share/nginx/$dir/
done

# Create default database
echo "Creating default database..."
python -m src.db_utilities.create_database
# Remove ROOT from .env
sed -i '/ROOT/d' /.env

echo "Starting backend..."

# Start the backend
uvicorn src.app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload
