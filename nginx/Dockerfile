# Base image is nginx
FROM nginx

# Copy start script and make it executable
COPY ./start.sh start.sh
RUN chmod +x ./start.sh

CMD ["./start.sh"]
