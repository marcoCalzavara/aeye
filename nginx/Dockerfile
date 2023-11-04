# Base image is nginx
FROM nginx

# Remove the default configuration
RUN rm /etc/nginx/conf.d/*.conf

# Define environment variables
ARG BACKEND_PORT
ENV BACKEND_PORT=$BACKEND_PORT

CMD ["nginx", "-g", "daemon off;"]