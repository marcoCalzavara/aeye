from fastapi.testclient import TestClient
from pymilvus import utility

import backend.src.app.main as main
from backend.src.db_utilities.collections import ZOOM_LEVEL_VECTOR_FIELD_NAME
from backend.src.db_utilities.datasets import DatasetOptions

client = TestClient(main.app)


def test_get_collection_names():
    response = client.get("/api/collection-names")
    assert response.status_code == 200
    assert response.json() == {"collections": [dataset.value["name"] for dataset in DatasetOptions
                                               if dataset.value["name"] in utility.list_collections()]}


def test_get_collection_info():
    # Create request
    collection = "best_artworks"
    response = client.get("/api/collection-info", params={"collection": collection})
    assert response.status_code == 200
    assert response.json() == {"number_of_entities": 7947, "zoom_levels": 5}

    # Make second request to test that status code is 404 when collection is not found
    collection = "test_collection"
    response = client.get("/api/collection-info", params={"collection": collection})
    assert response.status_code == 404


def test_get_image_from_text():
    # Create Text object
    text = "A painting of a dog."
    response = client.get("/api/image-text", params={"text": text, "collection": "best_artworks"})
    assert response.status_code == 200
    assert response.json().keys() == {"index", "author", "path", "low_dimensional_embedding_x",
                                      "low_dimensional_embedding_y", "width", "height"}
    assert response.json()["path"] == "2881-Henri_de_Toulouse-Lautrec.jpg"
    assert response.json()["author"] == "Henri de Toulouse"


def test_get_grid_data():
    response = client.get("/api/grid", params={"zoom_level": 0,
                                               "tile_x": 0,
                                               "tile_y": 0,
                                               "collection": "best_artworks_zoom_levels_grid"})
    assert response.status_code == 200
    assert response.json()[ZOOM_LEVEL_VECTOR_FIELD_NAME] == [0, 0, 0]
    assert response.json()["images"].keys() == {"indexes", "x_cell", "y_cell"}
    assert (len(response.json()["images"]["indexes"]) == len(response.json()["images"]["x_cell"])
            == len(response.json()["images"]["y_cell"]))

    # Make second request to test that status code is 404 when collection is not found
    response = client.get("/api/grid", params={"zoom_level": 0,
                                               "tile_x": 0,
                                               "tile_y": 0,
                                               "collection": "test_collection"})
    assert response.status_code == 404
    # Check that the server returns 404 when the tile data is not found
    response = client.get("/api/grid", params={"zoom_level": 0,
                                               "tile_x": 1,
                                               "tile_y": 1,
                                               "collection": "best_artworks_zoom_levels_grid"})
    assert response.status_code == 404


def test_get_map_data():
    response = client.get("/api/map", params={"zoom_level": 0,
                                              "image_x": 0,
                                              "image_y": 0,
                                              "collection": "best_artworks_zoom_levels_map"})
    assert response.status_code == 200
    assert response.json()[ZOOM_LEVEL_VECTOR_FIELD_NAME] == [0, 0, 0]
    assert len(response.json()["images"].keys()) == 1
    assert response.json()["images"]["has_info"] is False

    # Make second request to test that status code is 404 when collection is not found
    response = client.get("/api/map", params={"zoom_level": 0,
                                              "image_x": 0,
                                              "image_y": 0,
                                              "collection": "test_collection"})
    assert response.status_code == 404
    # Check that the server returns 404 when the tile data is not found
    response = client.get("/api/map", params={"zoom_level": 0,
                                              "image_x": 1,
                                              "image_y": 1,
                                              "collection": "best_artworks_zoom_levels_map"})
    assert response.status_code == 404

    # Check that an image from zoom level 5 has many more fields in images
    response = client.get("/api/map", params={"zoom_level": 5,
                                              "image_x": 0,
                                              "image_y": 0,
                                              "collection": "best_artworks_zoom_levels_map"})
    assert response.status_code == 200
    assert response.json()[ZOOM_LEVEL_VECTOR_FIELD_NAME] == [5, 0, 0]
    assert len(response.json()["images"].keys()) == 6
    assert response.json()["images"]["has_info"] is True
    assert (len(response.json()["images"]["indexes"]) == len(response.json()["images"]["x_cell"])
            == len(response.json()["images"]["y_cell"]))


def test_get_clusters_data():
    response = client.get("/api/clusters", params={"zoom_level": 0,
                                                   "tile_x": 0,
                                                   "tile_y": 0,
                                                   "collection": "best_artworks_zoom_levels_clusters"})
    assert response.status_code == 200
    assert response.json().keys() == {"index", ZOOM_LEVEL_VECTOR_FIELD_NAME, "clusters_representatives",
                                      "tile_coordinate_range"}
    assert response.json()["clusters_representatives"].keys() == {"entities"}
    assert list(response.json()["tile_coordinate_range"].keys()) == ['x_min', 'x_max', 'y_min', 'y_max']
    assert response.json()[ZOOM_LEVEL_VECTOR_FIELD_NAME] == [0, 0, 0]

    # Make second request to test that status code is 404 when collection is not found
    response = client.get("/api/clusters", params={"zoom_level": 0,
                                                   "tile_x": 0,
                                                   "tile_y": 0,
                                                   "collection": "test_collection"})
    assert response.status_code == 404
    # Check that the server returns 404 when the tile data is not found
    response = client.get("/api/clusters", params={"zoom_level": 0,
                                                   "tile_x": 1,
                                                   "tile_y": 1,
                                                   "collection": "best_artworks_zoom_levels_clusters"})
    assert response.status_code == 404


def test_get_tile_from_image():
    response = client.get("/api/image-to-tile", params={"index": 1,
                                                        "collection": "best_artworks_image_to_tile"})
    assert response.status_code == 200
    assert response.json().keys() == {"index", ZOOM_LEVEL_VECTOR_FIELD_NAME}
    assert response.json()[ZOOM_LEVEL_VECTOR_FIELD_NAME] == [7, 112, 22]

    # Make second request to test that status code is 404 when collection is not found
    response = client.get("/api/image-to-tile", params={"index": 2881,
                                                        "collection": "test_collection"})
    assert response.status_code == 404
    # Check that the server returns 404 when the tile data is not found
    response = client.get("/api/image-to-tile", params={"index": 8000,
                                                        "collection": "best_artworks_image_to_tile"})
    assert response.status_code == 404


def test_get_images():
    response = client.get("/api/images", params={"indexes": [2881, 5432], "collection": "best_artworks"})
    assert response.status_code == 200
    assert response.json() == [{"index": 2881, "path": "2881-Henri_de_Toulouse-Lautrec.jpg"},
                               {"index": 5432, "path": "5432-Pierre-Auguste_Renoir.jpg"}]
    # Make second request to test that status code is 404 when collection is not found
    response = client.get("/api/images", params={"indexes": [2881, 5432], "collection": "test_collection"})
    assert response.status_code == 404


def test_get_neighbours():
    response = client.get("/api/neighbors", params={"index": 2881, "k": 10, "collection": "best_artworks"})
    assert response.status_code == 200
    assert len(response.json()) == 10
    assert response.json()[0].keys() == {"index", "author", "path", "width", "height"}

    # Make second request to test that status code is 404 when collection is not found
    response = client.get("/api/neighbours", params={"index": 2881, "collection": "test_collection"})
    assert response.status_code == 404
