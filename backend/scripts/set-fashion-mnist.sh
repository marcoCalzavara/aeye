cd ~ || exit

echo "Downloading FASHION-MNIST..."
export PATH=$PATH:~/.local/bin/
kaggle datasets download -d zalando-research/fashionmnist

echo "Unzipping..."
unzip ~/fashionmnist.zip -d ~/FASHION-MNIST

echo "Removing zip file..."
rm ~/fashionmnist.zip

echo "Removing any file or directory whose name contains the word label..."
find ~/FASHION-MNIST -name "*label*" -exec rm -rf {} \;

echo "Removing csv files..."
find ~/FASHION-MNIST -name "*.csv" -exec rm -rf {} \;

echo "Renaming files..."
mv ~/FASHION-MNIST/train-images-idx3-ubyte ~/FASHION-MNIST/train-images.idx3-ubyte
mv ~/FASHION-MNIST/t10k-images-idx3-ubyte ~/FASHION-MNIST/t10k-images.idx3-ubyte

echo "Saving images to mnist folder..."
cd ~/image-viz || exit
export ENV_FILE_LOCATION=$HOME/image-viz/.env && python3 -m backend.scripts.save-mnist --directory FASHION-MNIST