#!/bin/bash

mkdir -p logs
envsubst < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
chmod -R 755 /frontend/build

for dir in best_artworks celebahq COCO-2017 Fashion-MNIST MNIST wikiart CIFAR-100
do
    chmod -R 755 /usr/share/nginx/$dir/
done

nginx -g 'daemon off;'