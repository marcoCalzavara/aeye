# Download the dataset from drive
# Check if the wikiart folder does not exist
if [ ! -d "$HOME/wikiart" ]; then
  echo "Downloading wikiart dataset..."
  curl 'https://drive.usercontent.google.com/download?id=1vTChp3nU5GQeLkPwotrybpUGUXj12BTK&export=download&authuser=0&confirm=t&uuid=71326bf7-dcb2-4d17-85dd-af7246cddc81&at=APZUnTX8buaiJdWcX3GlidafmqOQ%3A1707648157721' \
  -H 'authority: drive.usercontent.google.com' \
  -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
  -H 'accept-language: en-US,en;q=0.9,it;q=0.8,it-IT;q=0.7' \
  -H 'cookie: SSID=AkW6RjgHKxWenURvz; HSID=A188sNAgXImInrzrF; APISID=pLKmA4hfJhZiSz3y/AG4sZGXVjVnc2Vbdc; __Secure-1PAPISID=Z5fLCYCT6k56tqIm/ATMXsKwLCd2RgUy4L; SAPISID=Z5fLCYCT6k56tqIm/ATMXsKwLCd2RgUy4L; __Secure-3PAPISID=Z5fLCYCT6k56tqIm/ATMXsKwLCd2RgUy4L; S=billing-ui-v3=3Sj8MMfV_qRZGi9eUb0c5roCXHRq-msp:billing-ui-v3-efe=3Sj8MMfV_qRZGi9eUb0c5roCXHRq-msp; SID=g.a000gAgE-5l7LvJW81aJYCo0mmipmghK6Rfcl080rwCqCR0LlUve9YfWSCA6MEpNqCWfRkToNAACgYKAWUSAQASFQHGX2MiTjFUYNS7NRzFkUrqf8HaZRoVAUF8yKp4MiBZU5S7HDuTh34lC9gi0076; __Secure-1PSID=g.a000gAgE-5l7LvJW81aJYCo0mmipmghK6Rfcl080rwCqCR0LlUveZRv5eKxcErHwtoiWjx3k0QACgYKAeISAQASFQHGX2MitQ5aKiqbZuCkd_fkoa-sshoVAUF8yKoQEgKXXd3UwYLaTbUiztbh0076; __Secure-3PSID=g.a000gAgE-5l7LvJW81aJYCo0mmipmghK6Rfcl080rwCqCR0LlUve7WDHtKjiXT0vNeqN_62z7wACgYKAfUSAQASFQHGX2Minft-rQ_N8KoIo5xmSr-V1xoVAUF8yKpXeJVD65cWeSrCJVCphaFr0076; NID=511=SpahKtVFuwXLwXJK6r8liDx6Rc8_Z5weWQibhi_CwDxkrjDTR4yGUB9MBSSPqRxt1qmeAmjI9DqV2U2JTfgF_rI13PtYKT4f00Y22-12bCH-gTJ9DHw6QYVH5ujMJMaRyxpwyYBX571yhXVhb1jeoLskbL58xeuYowyTH9MJFOPqlMmTmhJwR11b14-xFvPSL3aPTyUELDjxTOxcnmj5-dtbfTElCn9Q5fnDeVN9NUOWzjey4czYaA6sYTPcbLBWBmkOH_YRe_4c_lawracLWfOYrhVc81Jtd99s7ByXckffReVM90CI_bOMsd-vmaGIhMed5EE; 1P_JAR=2024-02-11-10; AEC=Ae3NU9PXwPYVhnFCSJQrIxhV1m9VJfBm1SdVU5bIyZie0HTR_3sbFXUc33g; __Secure-ENID=17.SE=KFWYycQ_4InHDdZW6ELpJlo78Vbu4edN4BhOmXSH6RBOXInfl6SPAr-yj1OXVLDqYquBySJHFDgatDXAuYCgSQwJGVzk-TbSjbhDSWZHdFzB-N_UoXIDuodvq49g9sL0afrLUA1r4YrLsFbjmL0VeBMPg7IDf4RIqYgClXR6P7rRSNZSqUWWgwosLe_83Kni6Fp8c1DCebnj39WHVQJS1f56ghDTsiKUET-lL1Uqvh4W906UzS-IRPVeE4PnA8s03fy3XA65SKRFeBVsXHzMWBB306imrzvCIOnjnPGkh0lEDCrqcpgD0DPydwPLEuEC6mTDlm0ePnZGSA2jCTgK5sczv_SH0G77n4FCsRocWkOisvQFZJs; __Secure-1PSIDTS=sidts-CjIBPVxjStrlP-_cBTe4ilD0t8w-PVUtfdmDDOubdmqQKOgWNG2WeNCl7-lyAVUBMK3pihAA; __Secure-3PSIDTS=sidts-CjIBPVxjStrlP-_cBTe4ilD0t8w-PVUtfdmDDOubdmqQKOgWNG2WeNCl7-lyAVUBMK3pihAA; SIDCC=ABTWhQGzw-MwTm7ze-WfUbLquFCdvbCaSra0mnLN3PiPB01570dsZScRz7VKnmYhqwbYnWgw8uI; __Secure-1PSIDCC=ABTWhQELv4kpjbNrZTrGpWG5zMQYj9Di9na52y5vZSvQTSO57UnG8zEztnNXLdHqLm7joe7FrXlR; __Secure-3PSIDCC=ABTWhQFZQX4afg4Swm25-wpTJMwLGtO1JVxv3EQ8nuseMQ2XBkLjtaxphVu2YNMYR73ofePhZ1I-' \
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
  -H 'x-client-data: CIS2yQEIorbJAQipncoBCNyOywEIk6HLAQiHoM0BCIPwzQEY9snNARin6s0BGMn4zQE=' \
  --compressed -o ~/wikiart.tar.gz

  # Extract everything
  # First, download tar package if not present
  apt-get install unzip
  unzip ~/wikiart.tar.gz -d ~

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
