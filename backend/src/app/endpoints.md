# API ENDPOINTS: url and response example

### /api/collection-names
url example (path and query only): /api/collection-names <br>
response example: {"collections":["best_artworks"]}

### /api/image-text
url example (path and query only): /api/image-text?collection=best_artworks&text=A%20picture%20of%20a%20dog <br>
response example: {"path":"2876-Henri_de_Toulouse-Lautrec.jpg"}

### /api/grid
url example (path and query only): /api/tile-data?zoom_level=5&tile_x=12&tile_y=7&collection=best_artworks_zoom_levels_grid <br>
response example: {"zoom_plus_tile":[5.0,12.0,7.0],"images":{"indexes":[6363,3299],"x_cell":[3,3],"y_cell":[0,8]}}

### /api/clusters
url example (path and query only): /api/clusters?zoom_level=5&tile_x=13&tile_y=7&collection=best_artworks_zoom_levels_clusters <br>
response example: {"zoom_plus_tile":[5.0,13.0,7.0],"clusters_representatives":{"entities":[],"tile_coordinate_range":{"x_min": 0,"x_max":10,"y_min":1,"y_max":8},"index":764}

### /api/images
url example (path and query only): /api/images?indexes=1&indexes=2&collection=best_artworks <br>
response example: [{"path":"1-Alfred_Sisley.jpg","index":1},{"path":"2-Alfred_Sisley.jpg","index":2}]