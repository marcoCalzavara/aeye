#!/bin/bash

mkdir -p logs
envsubst < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
chmod 755 /frontend/build
find /frontend/build -type d -exec chmod 755 {} \;
find /frontend/build -type f -exec chmod 755 {} \;
chmod 755 /usr/share/nginx/best_artworks
find /usr/share/nginx/best_artworks -type d -exec chmod 755 {} \;
find /usr/share/nginx/best_artworks -type f -exec chmod 755 {} \;
chmod 755 /usr/share/nginx/wikiart
find /usr/share/nginx/wikiart -type d -exec chmod 755 {} \;
find /usr/share/nginx/wikiart -type f -exec chmod 755 {} \;

sleep 115

nginx -g 'daemon off;'