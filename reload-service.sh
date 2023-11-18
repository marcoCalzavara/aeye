#!/bin/bash

# Get service name using read
read -r  -p "Enter service name: " service_name

# Stop and remove the existing service container
docker stop "$service_name"
docker rm -f "$service_name"

docker compose build "$service_name"

# Recreate the backend container
docker compose up -d --no-deps "$service_name"

# Wait for the backend container to start
sleep 5

# Check the logs of the backend container
docker logs -f "$service_name"
