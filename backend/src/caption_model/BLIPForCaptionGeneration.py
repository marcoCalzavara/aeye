from abc import ABC
from typing import List

from transformers import Blip2ForConditionalGeneration, Blip2Processor  # , BlipForConditionalGeneration, BlipProcessor

from ..CONSTANTS import *
from .CaptionModel import CaptionModel


class BLIPForCaptionGeneration(CaptionModel, ABC):
    def __init__(self, device):
        self.device = device
        self.model = Blip2ForConditionalGeneration.from_pretrained(BLIP2_MODEL).to(self.device)
        # self.model = BlipForConditionalGeneration.from_pretrained(BLIP_MODEL).to(self.device)
        # self.processor = BlipProcessor.from_pretrained(BLIP_MODEL)
        self.processor = Blip2Processor.from_pretrained(BLIP2_MODEL)

    def getImageCaption(self, inputs) -> List[str]:
        """
        Return caption for image.
        @param inputs: Inputs to the caption_model which generates the captions.
        @return: Caption for image.
        """
        try:
            # Get embeddings_model output
            output = self.model.generate(**inputs, max_new_tokens=50)
            # Get caption
            captions = self.processor.batch_decode(output, skip_special_tokens=True)
            # Return caption with capitalization for first letter
            return captions
        except Exception as e:
            print(e.__str__())
