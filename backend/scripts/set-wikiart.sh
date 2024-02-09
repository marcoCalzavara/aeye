# Download the dataset from drive
# Check if the wikiart folder does not exist
if [ ! -d "$HOME/wikiart" ]; then
  echo "Downloading wikiart dataset..."
  curl 'https://drive.usercontent.google.com/download?id=1vTChp3nU5GQeLkPwotrybpUGUXj12BTK&export=download&authuser=0&confirm=t&uuid=bd66dba0-0ba8-413b-8adb-4469151f204b&at=APZUnTWc3N60EDtS2utfSDWXBQLo%3A1707475471657' \
  -H 'authority: drive.usercontent.google.com' \
  -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
  -H 'accept-language: en-US,en;q=0.9,it;q=0.8,it-IT;q=0.7' \
  -H 'cookie: SSID=AkW6RjgHKxWenURvz; HSID=A188sNAgXImInrzrF; APISID=pLKmA4hfJhZiSz3y/AG4sZGXVjVnc2Vbdc; __Secure-1PAPISID=Z5fLCYCT6k56tqIm/ATMXsKwLCd2RgUy4L; SAPISID=Z5fLCYCT6k56tqIm/ATMXsKwLCd2RgUy4L; __Secure-3PAPISID=Z5fLCYCT6k56tqIm/ATMXsKwLCd2RgUy4L; S=billing-ui-v3=3Sj8MMfV_qRZGi9eUb0c5roCXHRq-msp:billing-ui-v3-efe=3Sj8MMfV_qRZGi9eUb0c5roCXHRq-msp; SID=g.a000gAgE-5l7LvJW81aJYCo0mmipmghK6Rfcl080rwCqCR0LlUve9YfWSCA6MEpNqCWfRkToNAACgYKAWUSAQASFQHGX2MiTjFUYNS7NRzFkUrqf8HaZRoVAUF8yKp4MiBZU5S7HDuTh34lC9gi0076; __Secure-1PSID=g.a000gAgE-5l7LvJW81aJYCo0mmipmghK6Rfcl080rwCqCR0LlUveZRv5eKxcErHwtoiWjx3k0QACgYKAeISAQASFQHGX2MitQ5aKiqbZuCkd_fkoa-sshoVAUF8yKoQEgKXXd3UwYLaTbUiztbh0076; __Secure-3PSID=g.a000gAgE-5l7LvJW81aJYCo0mmipmghK6Rfcl080rwCqCR0LlUve7WDHtKjiXT0vNeqN_62z7wACgYKAfUSAQASFQHGX2Minft-rQ_N8KoIo5xmSr-V1xoVAUF8yKpXeJVD65cWeSrCJVCphaFr0076; 1P_JAR=2024-02-09-10; AEC=Ae3NU9Pd3lU1qAv22_39f12enyW_Z-jP0yDzRresFKfz1XVe29GunnjYjS4; __Secure-ENID=17.SE=rVZcoAKwR8OtO1ZnjFF0HkMKyEEDGkloMDlTwbyyBVqGuZAcdC_m3YBKVGbk0NLb3nv0xcnyuslvCeFmOb0quFzQju2B-TTyqCDuHgdH_xwukyn0PDyj-PZH2Lcrjc2gR-c7efgZ7XE8THNhCh5C8TsBbi8jgZPmRSCrWf3-fNFqmcYOyUTA2rPRLFDkMPGkT7dkr1gQ5g0_PLnME0uGaplPSWjFkDCl41EilkgXnyt8ODDASyRO1VNPBbsgl4IOrVkf4RSj-Jtdc57Mqn4erCPGECg5AEIyWUn7WGsIPmbM3Sn_IxqqH0QW956IvlikAx7ufN6Vf9K7I332QZQoQBq8S1ErnOiCygcEi8xLWauhGMrouhg; __Secure-1PSIDTS=sidts-CjIBPVxjSsKoiDHu_Rj8eYmo1o5A9asKBFQgnSzp7BSEwdaeLzUkGdGMNp2m9KPMLSWkRxAA; __Secure-3PSIDTS=sidts-CjIBPVxjSsKoiDHu_Rj8eYmo1o5A9asKBFQgnSzp7BSEwdaeLzUkGdGMNp2m9KPMLSWkRxAA; NID=511=H5KginX2r0rDC8BWwt1_FyBXCl3Fx43AmBIqWERZnjRnkB0dS32h6-LQI-eIMunIq81KEBuntqdfy5yr32bWN6pAGqoWL8Ul1t2kLqTSg6l7TX1J4CXr83gT3oB9jUXR8SQTdTxFSpogYVCNdDNFaekUp8sVawNQespMa_4z0EGyBRBYaFuy5QBpMegriq9KdIMQWrho7705I782BDF5-F3R9D9-0OHEc-EqeT04iXLKXDFNmCii61D_Xa4zLPO-1p7JelZDepDm97tonZ3XRvGq_sscfLZEtadGJzsknWsP5qtlhxy0MW3YdxO7hECuJfqZ2Nc; SIDCC=ABTWhQFBELcawWX78KrGJEmptvIXkQBB1x9DaKZLAzZ3kBrkMICEMK8UxnjeIU8rkuREs3aYcBk; __Secure-1PSIDCC=ABTWhQFeBvNu-FZDPLg5pejzdqJQABgGwry4v83-99WfFlOjRpkJnlajY7nje5zWEYxilj36rol7; __Secure-3PSIDCC=ABTWhQGqggSBh4geLJ5oyPKMBcFiEZ0SG73HbkpX1ffyoqbPRZ-vyeMOe8ak_NIdtOOuakwiOMlY' \
  -H 'sec-ch-ua: "Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"' \
  -H 'sec-ch-ua-arch: ""' \
  -H 'sec-ch-ua-bitness: "64"' \
  -H 'sec-ch-ua-full-version: "121.0.6167.160"' \
  -H 'sec-ch-ua-full-version-list: "Not A(Brand";v="99.0.0.0", "Google Chrome";v="121.0.6167.160", "Chromium";v="121.0.6167.160"' \
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
  -H 'user-agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36' \
  -H 'x-client-data: CIS2yQEIorbJAQipncoBCNyOywEIlKHLAQiHoM0BCIPwzQEY9snNARin6s0BGMn4zQE=' \
  --compressed > ~/wikiart.tar.gz

  # Extract everything
  # First, download tar package if not present
  apt-get install -y tar
  tar -xzf ~/wikiart.tar.gz -C ~

  # Remove tar package
  rm ~/wikiart.tar.gz
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
