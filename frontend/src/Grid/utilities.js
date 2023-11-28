import {DATASET} from "./Cache"

// FETCHING FUNCTIONS

/**
 * Fetch tile data from the server.
 *
 * @param {int} zoom_level - zoom level of the map
 * @param {number} x - x coordinate of the tile
 * @param {number} y - y coordinate of the tile
 * @param {string} host - host of the server
 * @return {Promise<Response>} - promise that resolves to the tile data
 */
export function fetchTileData(zoom_level, x, y, host = "") {
    const url = `${host}/api/tile-data?zoom_level=${zoom_level}&tile_x=${x}&tile_y=${y}&collection=${DATASET}_zoom_levels`;
    return fetch(url,
        {
            method: 'GET',
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Tile data could not be retrieved from the server.' +
                    ' Please try again later. Status: ' + response.status + ' ' + response.statusText);
            }
            return response.json();
        })
        .catch(error => {
            // Handle any errors that occur during the fetch operation
            console.error('Error:', error);
        });
}


/**
 * Fetch image paths from the server.
 *
 * @param {*[]} images_indexes - indexes of images to be fetched
 * @param {string} host - host of the server
 * @return {Promise<Response>} - promise that resolves to the image paths
 */
export function fetchImages(images_indexes, host = "") {
    if (images_indexes.length === 0) {
        // Return empty array if there are no images to be fetched
        return Promise.resolve([]);
    } else {
        // Create query string
        const query_string = images_indexes.map(index => `indexes=${index}`).join('&');
        // Fetch images from the server
        return fetch(`${host}/api/images?${query_string}&collection=${DATASET}`,
            {
                method: 'GET'
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Images could not be retrieved from the server.' +
                        ' Please try again later. Status: ' + response.status + ' ' + response.statusText);
                }
                return response.json();
            })
            .catch(error => {
                console.log(error)
            });
    }
}

// UTILITY FUNCTIONS

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
    cells_to_be_displayed.set(JSON.stringify({
        tile_x: tile_x + 1,
        tile_y: tile_y
    }), cells_to_be_displayed_next_tile_right)

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
 * @param {number} current_real_x - x coordinate of the next available cell in the real window
 * @param {number} current_real_y - y coordinate of the next available cell in the real window
 * @param {number} tile_x - x coordinate of the tile
 * @param {number} tile_y - y coordinate of the tile
 * @param {{}} tile_data - data of the tile
 * @param {Map} cells_to_be_displayed - map from coordinates of tiles to coordinates of cells to be displayed. The
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
    // Assert that the coordinates of the tile in tile data are the same as the ones passed as input
    if (tile_data["zoom_plus_tile"][1] !== tile_x || tile_data["zoom_plus_tile"][2] !== tile_y) {
        throw new Error("Coordinates of tile in tile data are not the same as the ones passed as input.");
    }
    // Use the tile data to create a mapping from cells coordinates to indexes of images to be displayed
    const cells_to_indexes = new Map();
    for (let i = 0; i < tile_data["images"]["indexes"].length; i++) {
        cells_to_indexes.set(JSON.stringify({
            cell_x: tile_data["images"]["x_cell"][i],
            cell_y: tile_data["images"]["y_cell"][i]
        }), tile_data["images"]["indexes"][i]);
    }
    // Get top left cell to be displayed in the current tile. This is the first element in the list of cells to be
    // displayed for the current tile.
    const top_left_cell_to_be_displayed = cells_to_be_displayed.get(JSON.stringify({
        tile_x: tile_x,
        tile_y: tile_y
    }))[0];
    // Define map from coordinates of images in the real window to indexes of images to be displayed
    const real_coordinates_to_indexes = new Map();
    // Define object for returning shift in x and y for real coordinates. This is equal to the difference between
    // the max and min coordinates of the cells to be displayed in the current tile.
    const max_min = {
        x: {
            max: cells_to_be_displayed.get(JSON.stringify({tile_x: tile_x, tile_y: tile_y}))[0].cell_x,
            min: cells_to_be_displayed.get(JSON.stringify({tile_x: tile_x, tile_y: tile_y}))[0].cell_x
        },
        y: {
            max: cells_to_be_displayed.get(JSON.stringify({tile_x: tile_x, tile_y: tile_y}))[0].cell_y,
            min: cells_to_be_displayed.get(JSON.stringify({tile_x: tile_x, tile_y: tile_y}))[0].cell_y
        }
    };
    // Get indexes of images that have the same tile coordinates as the cells to be displayed in the current tile.
    // Also, compute the corresponding coordinates of the images in the real window starting from the coordinate
    // (current_real_x, current_real_y).
    for (let i = 0; i < cells_to_be_displayed.get(JSON.stringify({tile_x: tile_x, tile_y: tile_y})).length; i++) {
        // Update max_min object
        if (cells_to_be_displayed.get(JSON.stringify({tile_x: tile_x, tile_y: tile_y}))[i].cell_x > max_min.x.max) {
            max_min.x.max = cells_to_be_displayed.get(JSON.stringify({tile_x: tile_x, tile_y: tile_y}))[i].cell_x;
        }
        if (cells_to_be_displayed.get(JSON.stringify({tile_x: tile_x, tile_y: tile_y}))[i].cell_x < max_min.x.min) {
            max_min.x.min = cells_to_be_displayed.get(JSON.stringify({tile_x: tile_x, tile_y: tile_y}))[i].cell_x;
        }
        if (cells_to_be_displayed.get(JSON.stringify({tile_x: tile_x, tile_y: tile_y}))[i].cell_y > max_min.y.max) {
            max_min.y.max = cells_to_be_displayed.get(JSON.stringify({tile_x: tile_x, tile_y: tile_y}))[i].cell_y;
        }
        if (cells_to_be_displayed.get(JSON.stringify({tile_x: tile_x, tile_y: tile_y}))[i].cell_y < max_min.y.min) {
            max_min.y.min = cells_to_be_displayed.get(JSON.stringify({tile_x: tile_x, tile_y: tile_y}))[i].cell_y;
        }

        // If the cell has an image, then add the index of the image to the list of indexes of images to be
        // displayed
        if (cells_to_indexes.has(JSON.stringify(cells_to_be_displayed.get(JSON.stringify({
            tile_x: tile_x,
            tile_y: tile_y
        }))[i]))) {
            // Get index of image
            const image_index = cells_to_indexes.get(JSON.stringify(cells_to_be_displayed.get(JSON.stringify({
                tile_x: tile_x,
                tile_y: tile_y
            }))[i]));
            // Compute coordinates of image in the real window
            const image_real_x = current_real_x +
                cells_to_be_displayed.get(JSON.stringify({
                    tile_x: tile_x,
                    tile_y: tile_y
                }))[i].cell_x - top_left_cell_to_be_displayed.cell_x;
            const image_real_y = current_real_y +
                cells_to_be_displayed.get(JSON.stringify({
                    tile_x: tile_x,
                    tile_y: tile_y
                }))[i].cell_y - top_left_cell_to_be_displayed.cell_y;

            // Add coordinates of image in the real window to the list of coordinates of images to be displayed
            real_coordinates_to_indexes.set(JSON.stringify({x: image_real_x, y: image_real_y}), image_index);
        }
    }

    // Return map from coordinates of images in the real window to indexes of images to be displayed, and shift in
    // x and y for real coordinates
    return {
        real_coordinates_to_indexes: real_coordinates_to_indexes,
        shift_x: max_min.x.max - max_min.x.min + 1 + current_real_x,
        shift_y: max_min.y.max - max_min.y.min + 1 + current_real_y
    };
}

/**
 * Define function for mapping coordinates of cells in the real window to images to be displayed.
 *
 * @param {Map<*, *>} cells_to_be_displayed - map from coordinates of tiles to coordinates of cells to be displayed.
 * @param {int} zoom_level - zoom level of the map
 * @param {string} host - host of the server
 * @return {Promise<Map>} - promise that resolves to a map from coordinates of images in the real window to paths of
 *                         images to be displayed
 */
export async function mapCellsToRealCoordinatePathPairs(
    cells_to_be_displayed,
    zoom_level,
    host = ""
) {
    // Remember that the first tile is the one with coordinates (x,y). The second tile is the one with coordinates
    // (x+1,y), the third tile is the one with coordinates (x,y+1), and the fourth tile is the one with coordinates
    // (x+1,y+1). This is because the keys are iterated in insertion order, and the first tile is the first one to
    // be inserted in the map.

    // Get keys of tiles
    const tiles_keys = Array.from(cells_to_be_displayed.keys());

    // Consider first tile
    const first_tile_key = JSON.parse(tiles_keys[0]);
    // Fetch tile data from the server
    const first_tile_data = await fetchTileData(zoom_level, first_tile_key.tile_x, first_tile_key.tile_y, host);
    // Get mappings from real coordinates to indexes of images to be displayed
    const return_value_first_tile = getRealCoordinatesAndIndexesOfImagesToBeDisplayed(0, 0, first_tile_key.tile_x,
        first_tile_key.tile_y, first_tile_data, cells_to_be_displayed);

    // Define map from real coordinates to index
    const real_coordinates_to_indexes = return_value_first_tile.real_coordinates_to_indexes;

    // Consider second tile, which is always the one on the right of the first tile
    let second_tile_key = tiles_keys[1];
    // Get data if the there is something to be displayed in the second tile
    if (cells_to_be_displayed.get(second_tile_key).length > 0) {
        second_tile_key = JSON.parse(second_tile_key);
        const second_tile_data = await fetchTileData(zoom_level, second_tile_key.tile_x, second_tile_key.tile_y, host);
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
    let third_tile_key = tiles_keys[2];
    // Get data if the there is something to be displayed in the third tile
    if (cells_to_be_displayed.get(third_tile_key).length > 0) {
        third_tile_key = JSON.parse(third_tile_key);
        const third_tile_data = await fetchTileData(zoom_level, third_tile_key.tile_x, third_tile_key.tile_y, host);
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
    let fourth_tile_key = tiles_keys[3];
    // Get data if the there is something to be displayed in the fourth tile
    if (cells_to_be_displayed.get(fourth_tile_key).length > 0) {
        fourth_tile_key = JSON.parse(fourth_tile_key);
        const fourth_tile_data = await fetchTileData(zoom_level, fourth_tile_key.tile_x, fourth_tile_key.tile_y, host);
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
    const list_indexes_paths = await fetchImages(Array.from(real_coordinates_to_indexes.values()), host);
    // Map indexes to paths
    const indexes_to_paths = new Map();
    // noinspection JSUnresolvedVariable
    list_indexes_paths.forEach((item) => indexes_to_paths.set(item["index"], item["path"]));
    // Map real coordinates to paths
    real_coordinates_to_indexes.forEach((value, key) => real_coordinates_to_images.set(key, indexes_to_paths.get(value)));
    return real_coordinates_to_images;
}


/**
 * Update zoom level. The zoom level is updated by the user when zooming in or out.
 *
 * @param {number} zoom_level - new zoom level
 * @param {number} prev_zoom_level - previous zoom level
 * @param {number} pointer_x - x coordinate of the pointer within the real window
 * @param {*} pointer_y - y coordinate of the pointer within the real window
 * @param {number} prev_x - x coordinate of the top left corner of the effective window
 * @param {number} prev_y  - y coordinate of the top left corner of the effective window
 * @param {number} prev_width_effective - width of the effective window
 * @param {number} prev_height_effective - height of the effective window
 * @param {number} width_real - width of the real window
 * @param {number} height_real - height of the real window
 * @param {number} window_size_in_cells_per_dim - number of cells along each dimension
 * @param {string} host - host of the server
 * @return {Promise<{x: number, y: number,
 * width_effective: number, height_effective: number,
 * real_coordinates_to_image_paths: Map}>} - new x and y coordinates of the top left corner of the effective window,
 * new width and height of the effective window, and a mapping from real coordinates to paths of images to be displayed
 */
export async function updateZoomLevel(zoom_level,
                                      prev_zoom_level,
                                      pointer_x,
                                      pointer_y,
                                      prev_x,
                                      prev_y,
                                      prev_width_effective,
                                      prev_height_effective,
                                      width_real,
                                      height_real,
                                      window_size_in_cells_per_dim,
                                      host = "") {
    // Note that the check on the validity of the new zoom level is done in the function that calls this function.
    // If the new zoom level is greater than the current zoom level, then the user is zooming in. Modify the location
    // of the effective window so that the point where the pointer is remains fixed.

    // Get position of the pointer in the effective window with respect to the coordinate system of the effective window.
    const pointer_x_effective_window = (pointer_x * prev_width_effective) / width_real;
    const pointer_y_effective_window = (pointer_y * prev_height_effective) / height_real;
    // The point where the pointer is remains fixed, the window shrinks or expands around it.
    // Compute x and y coordinates of the effective window.
    let x;
    let y;
    if (zoom_level > prev_zoom_level) {
        x = prev_x + pointer_x_effective_window / 2 ** (zoom_level - prev_zoom_level);
        y = prev_y + pointer_y_effective_window / 2 ** (zoom_level - prev_zoom_level);
    } else {
        x = prev_x - pointer_x_effective_window * 2 ** (prev_zoom_level - zoom_level - 1);
        y = prev_y - pointer_y_effective_window * 2 ** (prev_zoom_level - zoom_level - 1);
    }

    // Change width and height of effective window
    const width_effective = zoom_level === 0 ? width_real : width_real / (2 ** zoom_level);
    const height_effective = zoom_level === 0 ? height_real : height_real / (2 ** zoom_level);

    // Make sure x and y are within the real window
    if (x < 0) {
        x = 0;
    }
    if (y < 0) {
        y = 0;
    }
    if (x + width_effective > width_real) {
        x = width_real - width_effective;
    }
    if (y + height_effective > height_real) {
        y = height_real - height_effective;
    }

    // Get the cells to be displayed
    const cells_to_be_displayed = getGridCellsToBeDisplayed(x, y, width_effective, height_effective, window_size_in_cells_per_dim);

    // Now set_cells_to_be_displayed should be a map from tile coordinates to coordinates of cells that are within
    // the effective window. The coordinates of the cells are relative to the tile.
    // Return x, y, width_effective, height_effective, and a mapping from real cells to paths created with
    // mapCellsToRealCoordinatePathPairs. Organize the return value as an object.
    return {
        x: x,
        y: y,
        width_effective: width_effective,
        height_effective: height_effective,
        real_coordinates_to_image_paths: await mapCellsToRealCoordinatePathPairs(cells_to_be_displayed, zoom_level, host)
    };
}