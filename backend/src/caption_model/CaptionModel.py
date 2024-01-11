from abc import ABC, abstractmethod


class CaptionModel(ABC):

    @abstractmethod
    def getImageCaption(self, data):
        """
        Return caption for image.
        :param data: Image for which caption is to be generated.
        :return: Caption for image.
        """
        pass

