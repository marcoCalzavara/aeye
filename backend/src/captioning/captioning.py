# Run this script with
# accelerate launch captioning.py --start *start* --end *end* --batch_size *batch_size* --dataset *dataset*

import argparse
import csv
import os

from PIL import Image
from accelerate import Accelerator
from accelerate.utils import gather_object
from torch import bfloat16
from torch.utils.data import DataLoader
from torchvision.transforms import ToTensor
from torch.utils.data import Dataset as TorchDataset
from tqdm import tqdm
from transformers import AutoProcessor, LlavaForConditionalGeneration, BitsAndBytesConfig

# Variables
MAX_TOKENS_LLAVA = 128
MODEL_LLAVA = "llava-hf/llava-1.5-7b-hf"
QUERY_LLAVA = "USER: <image>\nDescribe the image.\nASSISTANT:"
CACHE_DIR = "/itet-stor/mcalzavara/net_scratch/.cache"
DATA = "/itet-stor/mcalzavara/net_scratch/"
MAX_IMAGE_PIXELS = 110000000

# Set maximum number of pixels for images
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


class DatasetForImages(TorchDataset):
    def __init__(self, root_dir, idx_to_path_file):
        self.root_dir = root_dir
        self.start = 0
        self.file_list = []

        # Open csv file with index to path mapping and save each mapping in self.file_list
        with open(idx_to_path_file, "r") as file:
            for i, line in enumerate(file):
                if i == 0:
                    continue  # Skip the first line
                idx, path = line.strip().split(",")
                self.file_list.append([idx, path])

        self.transform = ToTensor()

    def __len__(self):
        return len(self.file_list)

    def __getitem__(self, idx):
        # Get image height and width
        image = Image.open(os.path.join(self.root_dir, self.file_list[idx][1])).convert('RGB')
        index = self.file_list[idx][0]
        if self.transform:
            image = self.transform(image)

        return {
            'images': image,
            'index': index,
        }

    def do_slicing(self, start, end):
        self.start = start
        self.file_list = self.file_list[start:end]


def collate_fn(batch):
    """
    Collate function for the best_artworks dataset.
    @param batch: Batch of data.
    @return: Collated batch of data.
    """
    # Create dictionary to return
    return {
        'images': [item["images"] for item in batch],
        'index': [item["index"] for item in batch]
    }


def inference(args):
    # Create accelerator
    accelerator = Accelerator()
    # Create processor and model
    processor = AutoProcessor.from_pretrained(MODEL_LLAVA, cache_dir=CACHE_DIR)
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_compute_dtype=bfloat16
    )
    model = LlavaForConditionalGeneration.from_pretrained(
        MODEL_LLAVA,
        cache_dir=CACHE_DIR,
        torch_dtype=bfloat16,
        low_cpu_mem_usage=True,
        quantization_config=bnb_config,
        device_map={"": accelerator.process_index}
    )
    # Set model to eval mode
    model.eval()
    # Wait for everyone to be ready
    accelerator.wait_for_everyone()
    # Create dataset, sampler and dataloader
    dataset = DatasetForImages(f"{DATA}{args.dataset}", f"{DATA}index_to_path_{args.dataset}.csv")

    # Define start and end indices
    if args.start >= len(dataset):
        raise Exception("Start index is out of range.")
    if args.end == -1:
        args.end = len(dataset)
    if args.end > len(dataset):
        raise Exception("End index is out of range.")
    if args.start >= args.end:
        raise Exception("Start index is greater than or equal to end index.")

    # Slice dataset and create sampler and dataloader
    accelerator.print(f"The dataset has {len(dataset)} images. Keeping images from {args.start} to {args.end}.")
    dataset.do_slicing(args.start, args.end)
    dataloader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        num_workers=4,
        collate_fn=collate_fn,
        shuffle=False
    )
    # Pass all pytorch objects to the accelerator prepare method
    # model, processor, dataloader = accelerator.prepare(model, processor, dataloader)
    # Wait for everyone to be ready
    accelerator.wait_for_everyone()

    # Generate captions
    with open(f"captions_{args.dataset}_{args.start}_{args.end}.csv", "w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["index", "caption"])
        # Process the dataset
        for i, data in enumerate(
                tqdm(
                    dataloader,
                    desc="Processing",
                    ncols=100,
                    bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]"
                )
        ):
            # Split data across devices
            # noinspection all
            with accelerator.split_between_processes(data["images"]) as images:
                # Generate input
                if len(images) != 0:
                    # noinspection all
                    inputs = processor([QUERY_LLAVA for _ in images], images=images,
                                       return_tensors="pt").to(bfloat16).to(accelerator.device)
                    # Generate outputs
                    outputs = model.generate(**inputs, max_new_tokens=MAX_TOKENS_LLAVA, do_sample=False)
                    # Get captions
                    captions = processor.batch_decode(outputs, skip_special_tokens=True)
                else:
                    captions = []

            gathered_captions = gather_object(captions)
            # noinspection all
            assert len(gathered_captions) == len(data["index"])
            # Write captions to csv file
            # noinspection all
            for j in range(len(data["index"])):
                # noinspection all
                writer.writerow([data["index"][j], gathered_captions[j]])
        else:
            accelerator.print("Data is empty...moving on to next batch.")

    accelerator.print("Process finished!")


def main():
    parser = argparse.ArgumentParser(description="Inference script for captioning.")
    parser.add_argument(
        "--start",
        type=int,
        default=0,
        help="Start index for the dataset."
    )
    parser.add_argument(
        "--end",
        type=int,
        default=-1,
        help="End index for the dataset."
    )
    parser.add_argument(
        "--batch_size",
        type=int,
        default=36,
        help="Batch size."
    )
    parser.add_argument(
        "--dataset",
        type=str,
        default="wikiart",
        help="Dataset to use."
    )
    args = parser.parse_args()
    inference(args)


if __name__ == "__main__":
    main()
