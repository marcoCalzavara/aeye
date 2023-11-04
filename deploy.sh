echo "Building react application..."

cd frontend || exit
npm run build

# Navigate back to image-viz directory
cd ..

docker compose up -d