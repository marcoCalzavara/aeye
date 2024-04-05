#!/bin/bash

mkdir -p logs
envsubst < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
chmod 644 /frontend/build
find /frontend/build -type d -exec chmod 644 {} \;
find /frontend/build -type f -exec chmod 644 {} \;

chmod +rw /usr/share/nginx/best_artworks/
chmod +rw /usr/share/nginx/celebahq/
chmod +rw /usr/share/nginx/COCO-2017/
chmod +rw /usr/share/nginx/Fashion-MNIST/
chmod +rw /usr/share/nginx/MNIST/
chmod +rw /usr/share/nginx/wikiart/
chmod +rw /usr/share/nginx/CIFAR-100/

sleep 115

nginx -g 'daemon off;'