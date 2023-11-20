// FETCHING FUNCTIONS
// Define function for fetching tile data from the server
function fetchTileData(zoom_level, x, y) {
    // Fetch tile data from the server and return it
    return fetch(`/api/tile-data?$zoom_level=${zoom_level}&tile_x=${x}&tile_y${y}`)
        .then(response => response.json())
        .catch(error => console.log(error));
}

// Define function for fetching images from the server. The function takes as input a list of indexes of images to
// be fetched and return a list of paths of images.
function fetchImages(images_indexes) {
    // Define query string
    const query_string = images_indexes.map(index => `indexes=${index}`).join('&');
    // Save fetched path of images in a list
    const images_paths = new Map();
    // Fetch images from the server
    fetch(`/api/images?${query_string}`)
        .then(response => response.json())
        .then(data => {
            // For each image, save the path in the list
            data.forEach(image => images_paths.set(image.index, image.path));
        })
        .catch(error => console.log(error));
    // Return map from indexes to paths of images
    return images_paths;
}

/**
 * @param {number} x - x coordinate of the top left corner of the effective window
 * @param {number} y - y coordinate of the top left corner of the effective window
 * @param {number} width_effective - width of the effective window
 * @param {number} height_effective - height of the effective window
 * @param {number} window_size_in_cells_per_dim - number of cells in the effective window along each dimension
 * @return {Map} - map from coordinates of tiles to coordinates of cells to be displayed. Coordinates of tiles are
 *                 in the reference system of the real window, while coordinates of cells are in the reference system
 *                 of the tile.
 */
export function getGridCellsToBeDisplayed(
    x,
    y,
    width_effective,
    height_effective,
    window_size_in_cells_per_dim
) {
    // Compute x and y coordinates of the tile which contains x and y
    const tile_x = Math.floor(x / width_effective);
    const tile_y = Math.floor(y / height_effective);
    // Now locate the cell within the tile which contains (x,y) and compute its coordinates in the reference system of
    // the tile
    const cell_x = Math.floor((x - tile_x * width_effective) / (width_effective / window_size_in_cells_per_dim));
    const cell_y = Math.floor((y - tile_y * height_effective) / (height_effective / window_size_in_cells_per_dim));

    // Compute cells to be displayed for the main tile.
    // Keep map from tile coordinates to cells to be displayed within the tile
    const cells_to_be_displayed = new Map();
    // Define array to store coordinates of cells to be displayed for the current tile
    const cells_to_be_displayed_main_tile = [];

    // All cells within the current tile with index x between cell_x and 9 and index y between cell_y and 9 are to
    // be displayed
    for (let i = cell_x; i < window_size_in_cells_per_dim; i++) {
        for (let j = cell_y; j < window_size_in_cells_per_dim; j++) {
            cells_to_be_displayed_main_tile.push({cell_x: i, cell_y: j});
        }
    }
    // Add cells to be displayed for the main tile to the map. Use JSON.stringify to use objects as keys in the map.
    cells_to_be_displayed.set(JSON.stringify({tile_x: tile_x, tile_y: tile_y}), cells_to_be_displayed_main_tile)

    // Keep track of remaining shift in x and y. This is equal to 10 minus the number of cells selected in each
    // direction above. If cell_x was 8, then remaining_shift is 8, as there were only 2 coordinates available in x
    // in the previous tile, which are 8 and 9.
    let remaining_shift_x = cell_x;
    let remaining_shift_y = cell_y;

    // If there are still cells to be displayed, then they are in the next tile on the right or bottom or both

    // Define array to store coordinates of cells to be displayed for the next tile on the right
    const cells_to_be_displayed_next_tile_right = [];

    // Start from the next tile on the right. The y coordinate is the same as the previous tile, while the x
    // coordinate is set to 0 as we start from the left of the tile again. Remember that cells coordinates are
    // relative to the tile.
    for (let i = 0; i < remaining_shift_x; i++) {
        for (let j = cell_y; j < window_size_in_cells_per_dim; j++) {
            cells_to_be_displayed_next_tile_right.push({cell_x: i, cell_y: j});
        }
    }

    // Add cells to be displayed for the next tile on the right to the map
    cells_to_be_displayed.set(JSON.stringify({tile_x: tile_x + 1, tile_y: tile_y}), cells_to_be_displayed_next_tile_right)

    // Define array to store coordinates of cells to be displayed for the next tile on the bottom
    const cells_to_be_displayed_next_tile_bottom = [];

    // Start from the next tile on the bottom. The x coordinate is the same as the first tile, while the y
    // coordinate is set to 0 as we start from the top of the tile again.
    for (let i = cell_x; i < window_size_in_cells_per_dim; i++) {
        for (let j = 0; j < remaining_shift_y; j++) {
            cells_to_be_displayed_next_tile_bottom.push({cell_x: i, cell_y: j});
        }
    }

    // Add cells to be displayed for the next tile on the bottom to the map
    cells_to_be_displayed.set(JSON.stringify({
        tile_x: tile_x,
        tile_y: tile_y + 1
    }), cells_to_be_displayed_next_tile_bottom)

    // Define array to store coordinates of cells to be displayed for the next tile on the bottom right
    const cells_to_be_displayed_next_tile_bottom_right = [];

    // Start from the next tile on the bottom right. The x and y coordinates are set to 0 as we start from
    // the top left of the tile again.
    for (let i = 0; i < remaining_shift_x; i++) {
        for (let j = 0; j < remaining_shift_y; j++) {
            cells_to_be_displayed_next_tile_bottom_right.push({cell_x: i, cell_y: j});
        }
    }

    // Add cells to be displayed for the next tile on the bottom right to the map
    cells_to_be_displayed.set(JSON.stringify({
        tile_x: tile_x + 1,
        tile_y: tile_y + 1
    }), cells_to_be_displayed_next_tile_bottom_right)

    // Return cells to be displayed
    return cells_to_be_displayed;
}

/**
 * Get mapping from coordinates of cells in the real window to indexes of images to be displayed on those cells.
 *
 * @param {*} current_real_x - x coordinate of the next available cell in the real window
 * @param {*} current_real_y - y coordinate of the next available cell in the real window
 * @param {*} tile_x - x coordinate of the tile
 * @param {*} tile_y - y coordinate of the tile
 * @param {*} tile_data - data of the tile
 * @param {*} cells_to_be_displayed - map from coordinates of tiles to coordinates of cells to be displayed. The
 *                                    coordinates of the cells are relative to the tile.
 * @return {{}} - map from coordinates of images in the real window to indexes of images to be displayed, and shift
 *               in x and y for real coordinates with respect to the coordinate (0,0) of the real window.
 */
export function getRealCoordinatesAndIndexesOfImagesToBeDisplayed(
    current_real_x,
    current_real_y,
    tile_x,
    tile_y,
    tile_data,
    cells_to_be_displayed
) {
    // Use the tile data to create a mapping from cells coordinates to indexes of images to be displayed
    const cells_to_indexes = new Map();
    for (let i = 0; i < tile_data["images"]["indexes"].length; i++) {
        cells_to_indexes.set({
            cell_x: tile_data["images"]["x_cell"][i],
            cell_y: tile_data["images"]["y_cell"][i]
        }, tile_data["images"]["indexes"][i]);
    }
    // Get top left cell to be displayed in the current tile. This is the first element in the list of cells to be
    // displayed for the current tile.
    const top_left_cell_to_be_displayed = cells_to_be_displayed.get({tile_x: tile_x, tile_y: tile_y})[0];
    // Define map from coordinates of images in the real window to indexes of images to be displayed
    const real_coordinates_to_indexes = new Map();
    // Define object for returning shift in x and y for real coordinates. This is equal to the difference between
    // the max and min coordinates of the cells to be displayed in the current tile.
    const max_min = {
        x: {
            max: cells_to_be_displayed.get({tile_x: tile_x, tile_y: tile_y})[0].cell_x,
            min: cells_to_be_displayed.get({tile_x: tile_x, tile_y: tile_y})[0].cell_x
        },
        y: {
            max: cells_to_be_displayed.get({tile_x: tile_x, tile_y: tile_y})[0].cell_y,
            min: cells_to_be_displayed.get({tile_x: tile_x, tile_y: tile_y})[0].cell_y
        }
    };
    // Get indexes of images that have the same tile coordinates as the cells to be displayed in the current tile.
    // Also, compute the corresponding coordinates of the images in the real window starting from the coordinate
    // (current_real_x, current_real_y).
    for (let i = 0; i < cells_to_be_displayed.get({tile_x: tile_x, tile_y: tile_y}).length; i++) {
        // Update max_min object
        if (cells_to_be_displayed.get({tile_x: tile_x, tile_y: tile_y})[i].cell_x > max_min.x.max) {
            max_min.x.max = cells_to_be_displayed.get({tile_x: tile_x, tile_y: tile_y})[i].cell_x;
        }
        if (cells_to_be_displayed.get({tile_x: tile_x, tile_y: tile_y})[i].cell_x < max_min.x.min) {
            max_min.x.min = cells_to_be_displayed.get({tile_x: tile_x, tile_y: tile_y})[i].cell_x;
        }
        if (cells_to_be_displayed.get({tile_x: tile_x, tile_y: tile_y})[i].cell_y > max_min.y.max) {
            max_min.y.max = cells_to_be_displayed.get({tile_x: tile_x, tile_y: tile_y})[i].cell_y;
        }
        if (cells_to_be_displayed.get({tile_x: tile_x, tile_y: tile_y})[i].cell_y < max_min.y.min) {
            max_min.y.min = cells_to_be_displayed.get({tile_x: tile_x, tile_y: tile_y})[i].cell_y;
        }

        // If the cell has an images, then add the index of the image to the list of indexes of images to be
        // displayed
        if (cells_to_indexes.has(cells_to_be_displayed.get({tile_x: tile_x, tile_y: tile_y})[i])) {
            // Get index of image
            const image_index = cells_to_indexes.get(cells_to_be_displayed.get({
                tile_x: tile_x,
                tile_y: tile_y
            })[i]);
            // Compute coordinates of image in the real window
            const image_real_x = current_real_x +
                cells_to_be_displayed.get({
                    tile_x: tile_x,
                    tile_y: tile_y
                })[i].cell_x - top_left_cell_to_be_displayed.cell_x;
            const image_real_y = current_real_y +
                cells_to_be_displayed.get({
                    tile_x: tile_x,
                    tile_y: tile_y
                })[i].cell_y - top_left_cell_to_be_displayed.cell_y;

            // Add coordinates of image in the real window to the list of coordinates of images to be displayed
            real_coordinates_to_indexes.set({x: image_real_x, y: image_real_y}, image_index);
        }
    }

    // Return map from coordinates of images in the real window to indexes of images to be displayed, and shift in
    // x and y for real coordinates
    return {
        real_coordinates_to_indexes: real_coordinates_to_indexes, shift_x: max_min.x.max - max_min.x.min + 1,
        shift_y: max_min.y.max - max_min.y.min + 1
    };
}

/**
 * Define function for mapping coordinates of cells in the real window to images to be displayed.
 *
 * @param {*} x - x coordinate of the top left corner of the effective window
 * @param {*} y - y coordinate of the top left corner of the effective window
 * @param {Map<*, *>} cells_to_be_displayed - map from coordinates of tiles to coordinates of cells to be displayed.
 * @param {*} zoom_level - zoom level of the map
 * @return {Map} - map from coordinates of cells in the real window to paths of images to be displayed
 */
export function mapCellsToRealCoordinatePathPairs(
    x,
    y,
    cells_to_be_displayed,
    zoom_level
) {
    // Remember that the first tile is the one with coordinates (x,y). The second tile is the one with coordinates
    // (x+1,y), the third tile is the one with coordinates (x,y+1), and the fourth tile is the one with coordinates
    // (x+1,y+1). This is because the keys are iterated in insertion order, and the first tile is the first one to
    // be inserted in the map.

    // Get keys of tiles
    const tiles_keys = Array.from(cells_to_be_displayed.keys());

    // Consider first tile
    const first_tile_key = tiles_keys[0];
    // Fetch tile data from the server
    const first_tile_data = fetchTileData(zoom_level, first_tile_key.tile_x, first_tile_key.tile_y);
    // Get mappings from real coordinates to indexes of images to be displayed
    const return_value_first_tile = getRealCoordinatesAndIndexesOfImagesToBeDisplayed(x, y, first_tile_key.tile_x,
        first_tile_key.tile_y, first_tile_data, cells_to_be_displayed);

    // Define map from real coordinates to index
    const real_coordinates_to_indexes = return_value_first_tile.real_coordinates_to_indexes;

    // Consider second tile, which is always the one on the right of the first tile
    const second_tile_key = tiles_keys[1];
    // Get data if the there is something to be displayed in the second tile
    if (cells_to_be_displayed.get(second_tile_key).length > 0) {
        const second_tile_data = fetchTileData(zoom_level, second_tile_key.tile_x, second_tile_key.tile_y);
        // Get mappings from real coordinates to indexes of images to be displayed
        // Current x is equal to the number of cells from the first tile along the x direction.
        const second_tile_real_coordinates_to_indexes = getRealCoordinatesAndIndexesOfImagesToBeDisplayed(return_value_first_tile.shift_x,
            0, second_tile_key.tile_x, second_tile_key.tile_y, second_tile_data, cells_to_be_displayed);
        // Add new mappings to real_coordinates_to_indexes
        second_tile_real_coordinates_to_indexes.real_coordinates_to_indexes.forEach(
            (value, key) => real_coordinates_to_indexes.set(key, value)
        );
    }

    // Consider third tile, which is always the one on the bottom of the first tile
    const third_tile_key = tiles_keys[2];
    // Get data if the there is something to be displayed in the third tile
    if (cells_to_be_displayed.get(third_tile_key).length > 0) {
        const third_tile_data = fetchTileData(zoom_level, third_tile_key.tile_x, third_tile_key.tile_y);
        // Get mappings from real coordinates to indexes of images to be displayed
        // Current y is equal to the number of cells from the first tile along the y direction.
        const third_tile_real_coordinates_to_indexes = getRealCoordinatesAndIndexesOfImagesToBeDisplayed(0,
            return_value_first_tile.shift_y, third_tile_key.tile_x, third_tile_key.tile_y, third_tile_data, cells_to_be_displayed);
        // Add new mappings to real_coordinates_to_indexes
        third_tile_real_coordinates_to_indexes.real_coordinates_to_indexes.forEach(
            (value, key) => real_coordinates_to_indexes.set(key, value)
        );
    }

    // Consider fourth tile, which is always the one on the bottom right of the first tile
    const fourth_tile_key = tiles_keys[3];
    // Get data if the there is something to be displayed in the fourth tile
    if (cells_to_be_displayed.get(fourth_tile_key).length > 0) {
        const fourth_tile_data = fetchTileData(zoom_level, fourth_tile_key.tile_x, fourth_tile_key.tile_y);
        // Get mappings from real coordinates to indexes of images to be displayed
        // Current x is equal to the number of cells from the first tile along the x direction.
        const fourth_tile_real_coordinates_to_indexes = getRealCoordinatesAndIndexesOfImagesToBeDisplayed(return_value_first_tile.shift_x,
            return_value_first_tile.shift_y, fourth_tile_key.tile_x, fourth_tile_key.tile_y, fourth_tile_data, cells_to_be_displayed);
        // Add new mappings to real_coordinates_to_indexes
        fourth_tile_real_coordinates_to_indexes.real_coordinates_to_indexes.forEach(
            (value, key) => real_coordinates_to_indexes.set(key, value)
        );
    }

    // Change the mapping from real coordinates to indexes of images to be displayed to a mapping from real coordinates
    // to paths of images to be displayed
    const real_coordinates_to_images = new Map();
    const indexes_to_paths = fetchImages(Array.from(real_coordinates_to_indexes.values()));
    real_coordinates_to_indexes.forEach((value, key) => real_coordinates_to_images.set(key, indexes_to_paths.get(value)));
    return real_coordinates_to_images;
}