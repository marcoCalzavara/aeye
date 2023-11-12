cd ~ || exit

echo "Downloading best artworks..."
kaggle datasets download ikarus777/best-artworks-of-all-time

echo "Unzipping..."
unzip ~/best-artworks-of-all-time.zip -d ~/best-artworks

echo "Removing zip file..."
rm ~/best-artworks-of-all-time.zip

echo "Removing directories of less famous artists..."
rm -rf ~/best-artworks/images/images/Albrecht_Du╠Иrer
rm -rf ~/best-artworks/images/images/Albrecht_DuтХа├кrer
rm -rf ~/best-artworks/images/images/Mikhail_Vrubel

echo "Moving images to main folder..."
for directory in ~/best-artworks/images/images/*; do
  if [ -d "$directory" ]; then
    mv "$directory"/* ~/best-artworks/
    rmdir "$directory"
  fi
done

echo "Removing unnecessary directories and files..."
rm -rf ~/best-artworks/images
rm -rf ~/best-artworks/artists.csv
rm -rf ~/best-artworks/resized


echo "Changing filenames..."
index=0
for file_path in ~/best-artworks/*; do
  if [ -f "$file_path" ]; then
    # Extract the filename from the path
    file_name=$(basename "$file_path")

    # Extract the filename without the extension
    filename_no_extension="${file_name%.*}"

    # Remove the final number from the filename
    filename_no_number=$(echo "$filename_no_extension" | sed 's/[0-9]*$//')

    # Construct the new filename with the index
    new_filename="${index}_${filename_no_number}${file_name##*_}"

    # Rename the file
    mv "$file_path" "best-artworks/$new_filename"

    # Increment the index for the next file
    ((index++))
  fi
done