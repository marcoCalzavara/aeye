#!/bin/bash

# Generate password for milvus database and other environment variables
PASSWD=$(tr -dc 'A-Za-z0-9!"#$%&'\''()*+,-./:;<=>?@[\]^_`{|}~' </dev/urandom | head -c 13)
export PASSWD
export CHANGE_ROOT_USER=1
export MILVUS_IP=milvus-standalone
export MILVUS_PORT=19530
export START=1

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

# Change password for root to connect to Milvus database
echo "Changing password of Milvus root user..."
python -m src.db_utilities.manage_user
echo "Password changed."

# Set CHANGE_ROOT_USER=0 to redefine normal behavior of manage_user.py
export CHANGE_ROOT_USER=0

echo "Creating database and collection..."
python -m src.db_utilities.create_collection
echo "Database and collection created."

python -m src.app.main
