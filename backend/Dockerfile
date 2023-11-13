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

CMD ["bash", "-c", "source ./start.sh"]
