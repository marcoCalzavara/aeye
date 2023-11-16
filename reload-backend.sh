#!/bin/bash

# Stop and remove the existing backend container
docker stop backend
docker rm -f backend

docker compose build backend

# Recreate the backend container
docker compose up -d --no-deps backend

# Wait for the backend container to start
sleep 5

# Check the logs of the backend container
docker logs -f backend
