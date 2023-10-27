import unittest

import torch

from src.Model.CLIPEmbeddings import ClipEmbeddings
from src.Model.EmbeddingsModel import EmbeddingsModel
import cv2


class TestCLIPEmbeddings(unittest.TestCase):

    def test_CLIPEmbeddings_instance_of_EmbeddingsModel(self):
        clip = ClipEmbeddings()
        self.assertIsInstance(clip, EmbeddingsModel)

    def test_shape_text_embeddings(self):
        clip = ClipEmbeddings()
        text = "test shape _embeddings"
        self.assertEqual((1, 512), clip.getTextEmbeddings(text).shape)

    def test_shape_image_embeddings(self):
        clip = ClipEmbeddings()
        img = cv2.imread("test_assets/mona_lisa.jpg")
        self.assertEqual((1, 512), clip.getEmbeddings(img).shape)

    def test_get_similarity_score(self):
        clip = ClipEmbeddings()

        with self.assertRaises(AssertionError):
            clip.getSimilarityScore(torch.randn(100, 128), torch.randn(100, 126))

        img = cv2.imread("test_assets/mona_lisa.jpg")
        img_embeddings = clip.getEmbeddings(img)

        text = "test shape _embeddings"
        text_embeddings = clip.getTextEmbeddings(text)

        score = clip.getSimilarityScore(img_embeddings, text_embeddings)

        self.assertTrue(0 <= score.item() <= 1)
