echo "Reloading nginx configuration..."
docker container exec nginx nginx -s reload
echo "Nginx reloaded!"