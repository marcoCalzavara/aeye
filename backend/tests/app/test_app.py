from fastapi.testclient import TestClient
from pymilvus import utility
from backend.src.app.main import app, set_up_connection
from backend.src.db_utilities.datasets import DatasetOptions
from backend.src.db_utilities.collections import EMBEDDING_VECTOR_FIELD_NAME, ZOOM_LEVEL_VECTOR_FIELD_NAME

client = TestClient(app)

# Run set_up_connection() before running tests
set_up_connection()


def test_get_collection_names():
    client = TestClient(app)
    response = client.get("/api/collection-names")
    assert response.status_code == 200
    assert response.json() == {"collections": [dataset.value["name"] for dataset in DatasetOptions
                                               if dataset.value["name"] in utility.list_collections()]}


def test_get_image_from_text():
    # Create Text object
    text = "A painting of a dog."
    response = client.get("/api/image-text", params={"text": text, "collection": "best_artworks"})
    assert response.status_code == 200
    assert response.json() == {"path": "2881-Henri_de_Toulouse-Lautrec.jpg"}


def test_get_tile_data():
    response = client.get("/api/tile-data", params={"zoom_level": 0,
                                                    "tile_x": 0,
                                                    "tile_y": 0,
                                                    "collection": "best_artworks_zoom_levels"})
    assert response.status_code == 200
    assert response.json()[ZOOM_LEVEL_VECTOR_FIELD_NAME] == [0, 0, 0]
    assert response.json()["images"].keys() == {"indexes", "x_cell", "y_cell"}
    assert (len(response.json()["images"]["indexes"]) == len(response.json()["images"]["x_cell"])
            == len(response.json()["images"]["y_cell"]))

    # Make second request to test that status code is 404 when collection is not found
    response = client.get("/api/tile-data", params={"zoom_level": 0,
                                                    "tile_x": 0,
                                                    "tile_y": 0,
                                                    "collection": "test_collection"})
    assert response.status_code == 404
    # Check that the server returns 404 when the tile data is not found
    response = client.get("/api/tile-data", params={"zoom_level": 0,
                                                    "tile_x": 1,
                                                    "tile_y": 1,
                                                    "collection": "best_artworks_zoom_levels"})
    assert response.status_code == 404
