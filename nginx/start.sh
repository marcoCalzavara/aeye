#!/bin/bash

mkdir logs
envsubst < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
chmod 755 /usr/share/nginx/html
find /usr/share/nginx/html -type d -exec chmod 755 {} \;
find /usr/share/nginx/html -type f -exec chmod 644 {} \;
chmod 755 /usr/share/nginx/best-artworks
find /usr/share/nginx/best-artworks -type d -exec chmod 755 {} \;
find /usr/share/nginx/best-artworks -type f -exec chmod 644 {} \;
nginx -g 'daemon off;'