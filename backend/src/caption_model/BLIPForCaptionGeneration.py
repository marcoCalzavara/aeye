from abc import ABC

from transformers import Blip2ForConditionalGeneration, BlipProcessor, BlipForConditionalGeneration

from ..CONSTANTS import *
from .CaptionModel import CaptionModel


class BLIPForCaptionGeneration(CaptionModel, ABC):
    def __init__(self, device):
        self.device = device
        # self.model = Blip2ForConditionalGeneration.from_pretrained(BLIP2_MODEL).to(self.device)
        self.model = BlipForConditionalGeneration.from_pretrained(BLIP_MODEL).to(self.device)
        self.processor = BlipProcessor.from_pretrained(BLIP_MODEL)

    def getImageCaption(self, image) -> str:
        """
        Return caption for image.
        @param image: Image for which caption is to be generated.
        @return: Caption for image.
        """
        try:
            inputs = self.processor(images=image, return_tensors="pt").to(self.device)
            # Get embeddings_model output
            output = self.model.generate(**inputs)
            # Get caption
            caption = self.processor.decode(output[0], skip_special_tokens=True)
            # Return caption with capitalization for first letter
            return caption[0].upper() + caption[1:]
        except Exception as e:
            print(e.__str__())
