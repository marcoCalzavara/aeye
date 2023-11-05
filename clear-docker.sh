# The script will
#  - first stop all running containers (if any),
#  - remove containers
#  - remove images
#  - remove volumes

# Stop all running containers
echo 'Stopping running containers (if available)...'
# shellcheck disable=SC2046
docker stop $(docker ps -a -q)

# Remove all stopped containers
echo 'Removing containers ..'
# shellcheck disable=SC2046
docker rm $(docker ps -a -q)


# Remove all images
echo 'Removing images ...'
# shellcheck disable=SC2046
docker rmi $(docker images -a -q)

# Remove all stray volumes if any
echo 'Revoming docker container volumes (if any)'
# shellcheck disable=SC2046
docker volume rm $(docker volume ls -q)

# Remove volumes directory in milvus
cd milvus || exit
rm -r volumes
cd ..