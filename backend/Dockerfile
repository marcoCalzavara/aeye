FROM python:3.10

# Set the working directory
WORKDIR /code

# Copy files
COPY ./requirements.txt requirements.txt
COPY ./start.sh start.sh

# Set execution permission for start.sh
RUN chmod +x ./start.sh

# Run pip install to install all dependencies
RUN pip3 install --upgrade pip
RUN pip3 install -r requirements.txt

# Export BACKEND_PORT. All other variables are exported in start.sh, but this variable must be exported here as its
# values comes from the environment file.
ARG BACKEND_PORT
ENV BACKEND_PORT=$BACKEND_PORT

CMD ["./start.sh"]