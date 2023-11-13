#!/bin/bash

# Stop and remove the existing backend container
docker-compose stop backend
docker-compose rm -f backend

# Build the backend container
docker-compose build backend

# Recreate the backend container
docker-compose up -d --no-deps backend

# Wait for the backend container to start
sleep 5

# Check the logs of the backend container
docker-compose logs -f backend


