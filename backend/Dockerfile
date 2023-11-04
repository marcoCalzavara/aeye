FROM python

# Set the working directory
WORKDIR /code

# Copy files
COPY backend/requirements.txt requirements.txt
COPY backend/start.sh start.sh

# Run pip install to install all dependencies
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Export BACKEND_PORT. All other variables are exported in start.sh, but this variable must be exported here as its
# values comes from the environment file.
ARG BACKEND_PORT
ENV BACKEND_PORT=$BACKEND_PORT

CMD ["./start.sh"]