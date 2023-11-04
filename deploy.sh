if [ ! -d "image-viz" ]; then
  echo "Directory image-viz does not exist. Pull it from github or change current directory."
  exit
fi
cd image-viz || exit

echo "Building react application..."

cd frontend || exit
npm run build

# Navigate back to image-viz directory
cd ..

sudo docker compose up -d