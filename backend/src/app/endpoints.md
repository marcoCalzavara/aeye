# API ENDPOINTS: url and response example

### /api/collection-names
url example (path and query only): /api/collection-names <br>
response example: {"collections":["best_artworks"]}

### /api/image-text
url example (path and query only): /api/image-text?collection=best_artworks&text=A%20picture%20of%20a%20dog <br>
response example: {"path":"2876-Henri_de_Toulouse-Lautrec.jpg"}

### /api/tile-data
url example (path and query only): /api/tile-data?zoom_level=5&tile_x=12&tile_y=7&collection=best_artworks_zoom_levels <br>
response example: {"zoom_plus_tile":[5.0,12.0,7.0],"images":{"indexes":[6363,3299],"x_cell":[3,3],"y_cell":[0,8]}}

### /api/images
url example (path and query only): /api/images?indexes=1&indexes=2&collection=best_artworks <br>
response example: [{"path":"1-Alfred_Sisley.jpg","index":1},{"path":"2-Alfred_Sisley.jpg","index":2}]