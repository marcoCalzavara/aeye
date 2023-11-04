echo "Do you want to build the app? (y/n)"
read -r answer

if [ "$answer" = "y" ]; then
  echo "Building react application..."
  cd frontend || exit
  npm ci
  npm run build
  # Navigate back to image-viz directory
  cd ..
fi

docker compose up -d