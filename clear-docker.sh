# The script will
#  - first stop all running containers (if any),
#  - remove containers
#  - remove images
#  - remove volumes
#

# stop all running containers
echo '####################################################'
echo 'Stopping running containers (if available)...'
echo '####################################################'
sudo docker stop "$(sudo docker ps -aq)"

# remove all stopped containers
echo '####################################################'
echo 'Removing containers ..'
echo '####################################################'
sudo docker rm "$(sudo docker ps -aq)"


# remove all images
echo '####################################################'
echo 'Removing images ...'
echo '####################################################'
sudo docker rmi "$(sudo docker images -q)"

# remove all stray volumes if any
echo '####################################################'
echo 'Revoming docker container volumes (if any)'
echo '####################################################'
sudo docker volume rm "$(sudo docker volume ls -q)"