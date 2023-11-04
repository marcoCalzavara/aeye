echo "Reloading nginx configuration..."
sudo docker container exec nginx nginx -s reload
echo "Nginx reloaded!"