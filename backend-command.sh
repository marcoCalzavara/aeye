# Execute command on docker container backend
read -rp "Enter command to execute on backend container: " command
docker exec -it backend bash -c "$command"
