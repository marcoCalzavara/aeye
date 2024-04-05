#!/bin/bash

mkdir -p logs
envsubst < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
chmod 644 /frontend/build
find /frontend/build -type d -exec chmod 644 {} \;
find /frontend/build -type f -exec chmod 644 {} \;

sleep 115

nginx -g 'daemon off;'