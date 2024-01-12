cd ~ || exit

# Download the dataset from drive
# Check if the wikiart folder does not exist
if [ ! -d "wikiart" ]; then
  echo "Downloading wikiart dataset..."
  curl 'https://drive.usercontent.google.com/download?id=1vTChp3nU5GQeLkPwotrybpUGUXj12BTK&export=download&authuser=0&confirm=t&uuid=8f576069-d7c7-4845-bd7e-026d4eeab3ab&at=APZUnTUATWAr2eLGIMTDOrtusWyA%3A1705068289308' \
    -H 'authority: drive.usercontent.google.com' \
    -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
    -H 'accept-language: en-US,en;q=0.9,it;q=0.8,it-IT;q=0.7' \
    -H 'cookie: HSID=A188sNAgXImInrzrF; SSID=AkW6RjgHKxWenURvz; APISID=pLKmA4hfJhZiSz3y/AG4sZGXVjVnc2Vbdc; SAPISID=Z5fLCYCT6k56tqIm/ATMXsKwLCd2RgUy4L; __Secure-1PAPISID=Z5fLCYCT6k56tqIm/ATMXsKwLCd2RgUy4L; __Secure-3PAPISID=Z5fLCYCT6k56tqIm/ATMXsKwLCd2RgUy4L; S=billing-ui-v3=3Sj8MMfV_qRZGi9eUb0c5roCXHRq-msp:billing-ui-v3-efe=3Sj8MMfV_qRZGi9eUb0c5roCXHRq-msp; SID=ewgE-8vCXug3rj4m_u-i3FF4GdbrADjzjjv1iW16Spnf6ezdLabTOvdqaAiPNswG6IwnYw.; __Secure-1PSID=ewgE-8vCXug3rj4m_u-i3FF4GdbrADjzjjv1iW16Spnf6ezdmsqfMqDXWfl8cxtQj0AYpQ.; __Secure-3PSID=ewgE-8vCXug3rj4m_u-i3FF4GdbrADjzjjv1iW16Spnf6ezdCpqYKv7fDum0ZcmY6zRzWw.; AEC=Ae3NU9PNvWu23BlVVbJUNuy4mOIHnQO8EnilBqQtkyQITwQdUgEe1fFfO2o; 1P_JAR=2024-01-12-13; __Secure-ENID=17.SE=MmdGkVfRp6KRZOhOYJWJW3c9A-Qw3ltxOm2SyIwKLjM2_hs5Bz4RNwVTm37rb_KKpz0_t3yJCdEfLocE3jIo3KzzFf8KHR5qTXRmXn3YI2S_miXR4c1U4F-8PB4seO7rfLshD_3DYoWk-pi8lxWvUs6CAgnzcYHtZBFZgwdpgDQonx0N7QO-6hH2D6_jni0-gex18LyuqEHF2-4jyApyd_1QwdhYC-x8juE6C4vORqSBBqt4D_I8bqgqh6AGvfxGhKrgw4Mws1ggymdwB0OWlZbZhCfhybCYzI1ifxWd90tzSyedSDLEdGFOY_WjIVl_zwOR3nZFNFZ0gVybUFEgH8ZLcFqmIabvRTVXu8W7QfMSSsQDPo8; NID=511=N1Syr5T14WphFXGLxNLGhn6Vip-wpN6QXF-9JbE1hJl0hi_QOdHGPRRgz1Gj5HhKbcR7x-8_7ZBYPgdKXZC3fCFZxWz7g6lZBahSvm8LFH8FScYZrLSopb54Oj5lamtnoHHlX7E8ya96bqJ8rggRqQNw7d-CDyfguQG-9V2gCQJTFCI4wbdGMR5IX9sQrSUQc2leFMeohrDpYH59jabT9TGyIN56G6K2CmcWf5B95xLySVFXsvAfAmG60OpbOp40QEvsp6ZSTO1rh9Hq0vJdAVRMBh8NqHVCAmk5czFiMnrhTZPMwubHiUviiOYuUuqUMlb-R6s; __Secure-1PSIDTS=sidts-CjIBPVxjSnSnqR7arkrv54sRfer0dUnf7EoB4ivopHKSySPe3-9CEIgSLRzbI2WuRYs8EBAA; __Secure-3PSIDTS=sidts-CjIBPVxjSnSnqR7arkrv54sRfer0dUnf7EoB4ivopHKSySPe3-9CEIgSLRzbI2WuRYs8EBAA; SIDCC=ABTWhQHLPk1kO-IkGYbabAtvOEqtXUx3up-qpwHbXkTpj0meaczDjGPHEuc43N_mLbKBJSrVBJw; __Secure-1PSIDCC=ABTWhQGMN43Vmmanf2MMjOJxOZWXYty-hPjUXmRrkoA-4aIKzaRlMkSFzjxX29wJsCE3n07d8TXv; __Secure-3PSIDCC=ABTWhQGmlLsHTyCrdRd48nvJmvSnh9enJkWIuxxqwPlgDjKxZ-prE1I05I7L46cCvmiYzDJErAmZ' \
    -H 'sec-ch-ua: "Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"' \
    -H 'sec-ch-ua-arch: ""' \
    -H 'sec-ch-ua-bitness: "64"' \
    -H 'sec-ch-ua-full-version: "120.0.6099.216"' \
    -H 'sec-ch-ua-full-version-list: "Not_A Brand";v="8.0.0.0", "Chromium";v="120.0.6099.216", "Google Chrome";v="120.0.6099.216"' \
    -H 'sec-ch-ua-mobile: ?1' \
    -H 'sec-ch-ua-model: "Nexus 5"' \
    -H 'sec-ch-ua-platform: "Android"' \
    -H 'sec-ch-ua-platform-version: "6.0"' \
    -H 'sec-ch-ua-wow64: ?0' \
    -H 'sec-fetch-dest: document' \
    -H 'sec-fetch-mode: navigate' \
    -H 'sec-fetch-site: cross-site' \
    -H 'sec-fetch-user: ?1' \
    -H 'upgrade-insecure-requests: 1' \
    -H 'user-agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' \
    -H 'x-client-data: CIS2yQEIorbJAQipncoBCNyOywEIlaHLAQiHoM0BCIPwzQEY9snNARin6s0BGPryzQE=' \
    --compressed > wikiart.tar.gz

  # Extract everything
  # First, download tar package if not present
  apt-get install -y tar
  tar -xzf wikiart.tar.gz -C ~

  # Remove tar package
  rm wikiart.tar.gz
fi

# The folder comes with a lot of directories. We only need the images, so move all the files outside of the directories
echo "Moving images to main folder..."
for directory in ~/wikiart/*; do
  if [ -d "$directory" ]; then
    # Extract the name of the directory from the path
    directory_name=$(basename "$directory")
    # Create new variable with the name of the directory by replacing _ with -
    directory_name="${directory_name//_/-}"
    # Add the name of the directory to the names of the files inside the directory
    for file in "$directory"/*; do
      # Extract the name of the file from the path
      file_name=$(basename "$file")
      # Add the name of the directory to the name of the file, and place and underscore between them
      file_name="${directory_name}_${file_name}"
      # Move the file to the main directory
      mv "$file" ~/wikiart/"$file_name"
    done
    # Remove the directory
    rmdir "$directory"
  fi
done

# Rename all the files. Keep everything and simply add the index at the beginning of the filename
echo "Changing filenames..."
index=0
for file_path in ~/wikiart/*; do
  # Extract the filename from the path
  file_name=$(basename "$file_path")
  # Add the index to the filename. Keep everything else
  mv "$file_path" ~/wikiart/"${index}_${file_name}"
  # Increment the index for the next file
  ((index++))
done
