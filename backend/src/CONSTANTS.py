CLIP_MODEL = "openai/clip-vit-base-patch16"
BLIP2_MODEL = "Salesforce/blip2-opt-2.7b"
BLIP_MODEL = "Salesforce/blip-image-captioning-large"
DEFAULT_N_NEIGHBORS = 100
DEFAULT_DIM = 2
DEFAULT_MIN_DIST = 0.1
DEFAULT_PROJECTION_METHOD = "umap"
UMAP_PROJ = "umap"
RANDOM_STATE = 42
DEFAULT_N_CLUSTERS = 20
BATCH_SIZE = 32
DEVICE = "cpu"
NUM_WORKERS = 0
WIKIART = 'hub://activeloop/wiki-art'
WIKIART_ATTRIBUTES = ['images', 'labels']
MAX_IMAGE_PIXELS = 110000000
LABELS_MAPPING = {0: 'abstract_expressionism', 1: 'action_painting', 2: 'analytical_cubism', 3: 'art_nouveau_modern',
                  4: 'baroque', 5: 'color_field_painting', 6: 'contemporary_realism', 7: 'cubism',
                  8: 'early_renaissance', 9: 'expressionism', 10: 'fauvism', 11: 'high_renaissance',
                  12: 'impressionism', 13: 'mannerism_late_renaissance', 14: 'minimalism', 15: 'naive_art_primitivism',
                  16: 'new_realism', 17: 'northern_renaissance', 18: 'pointillism', 19: 'pop_art',
                  20: 'post_impressionism', 21: 'realism', 22: 'rococo', 23: 'romanticism', 24: 'symbolism',
                  25: 'synthetic_cubism', 26: 'ukiyo_e'}
COLORS = ['red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'cyan', 'magenta', 'lime', 'teal', 'lavender',
          'brown', 'beige', 'maroon', 'olive', 'navy', 'indigo', 'azure', 'coral', 'crimson', 'darkgreen', 'dodgerblue',
          'gold', 'orangered', 'fuchsia', 'darkviolet']
FILE_MISSING_INDEXES = "missing_indexes.txt"
COORDINATES = ["x", "y"]

# Database constants
INSERT_SIZE = 500
SEARCH_LIMIT = 16384
ROOT_USER = "root"
ROOT_PASSWD = "Milvus"
DEFAULT_DATABASE_NAME = "aiplusart"
COSINE_METRIC = "COSINE"
L2_METRIC = "L2"
INDEX_TYPE = "FLAT"

# Environment variables names
MILVUS_IP = "MILVUS_IP"
MILVUS_PORT = "MILVUS_PORT"
DATABASE = "DATABASE"
DEFAULT_COLLECTION = "DEFAULT_COLLECTION"
START = "START"
BACKEND_PORT = "BACKEND_PORT"
TEMP_COLLECTION_NAME = "TEMP_COLLECTION_NAME"
ENV_FILE_LOCATION = "ENV_FILE_LOCATION"
BEST_ARTWORKS_DIR = "BEST_ARTWORKS_DIR"
HOME = "HOME"

# Variables for zoom levels collection
WINDOW_SIZE_IN_CELLS_PER_DIM = 10
IMAGE_WIDTH = 1280
IMAGE_HEIGHT = 920

# Variables for resizing images
RESIZING_WIDTH = 192
RESIZING_HEIGHT = 138
