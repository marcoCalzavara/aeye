// This file contains utility functions for the map.

/**
 * Get the tiles at the next zoom level.
 * @param tile_x The x coordinate of the tile.
 * @param tile_y The y coordinate of the tile.
 * @param zoom_level The zoom level.
 * @param max_zoom_level The maximum zoom level.
 * @returns {*[]} An array containing the tiles at the next zoom level.
 */
function addTilesNextZoomLevel(tile_x, tile_y, zoom_level, max_zoom_level) {
    const tiles_to_add = [];

    if (zoom_level + 1 <= max_zoom_level) {
        // The current tile is divided into 4 tiles at the next zoom level
        const tile_x_next_zoom_level = tile_x * 2;
        const tile_y_next_zoom_level = tile_y * 2;
        tiles_to_add.push({x: tile_x_next_zoom_level, y: tile_y_next_zoom_level});
        tiles_to_add.push({x: tile_x_next_zoom_level + 1, y: tile_y_next_zoom_level});
        tiles_to_add.push({x: tile_x_next_zoom_level, y: tile_y_next_zoom_level + 1});
        tiles_to_add.push({x: tile_x_next_zoom_level + 1, y: tile_y_next_zoom_level + 1});
    }

    return tiles_to_add;
}

/**
 * Get the tiles at the previous zoom level.
 * @param tile_x The x coordinate of the tile.
 * @param tile_y The y coordinate of the tile.
 * @param zoom_level The zoom level.
 * @returns {*[]} An array containing the tiles at the previous zoom level.
 */
function addTilesPreviousZoomLevel(tile_x, tile_y, zoom_level) {
    // Locate the tile at the previous zoom level, and if possible get all neighboring tiles.
    const tiles_to_add = [];

    if (zoom_level - 1 >= 0) {
        const tile_x_previous_zoom_level = Math.floor(tile_x / 2);
        const tile_y_previous_zoom_level = Math.floor(tile_y / 2);
        tiles_to_add.push({x: tile_x_previous_zoom_level, y: tile_y_previous_zoom_level});
        if (tile_x_previous_zoom_level > 0) {
            tiles_to_add.push({x: tile_x_previous_zoom_level - 1, y: tile_y_previous_zoom_level});
            if (tile_y_previous_zoom_level > 0) {
                tiles_to_add.push({x: tile_x_previous_zoom_level - 1, y: tile_y_previous_zoom_level - 1});
            }
            if (tile_y_previous_zoom_level < 2 ** (zoom_level - 1) - 1) {
                tiles_to_add.push({x: tile_x_previous_zoom_level - 1, y: tile_y_previous_zoom_level + 1});
            }
        }
        if (tile_x_previous_zoom_level < 2 ** (zoom_level - 1) - 1) {
            tiles_to_add.push({x: tile_x_previous_zoom_level + 1, y: tile_y_previous_zoom_level});
            if (tile_y_previous_zoom_level > 0) {
                tiles_to_add.push({x: tile_x_previous_zoom_level + 1, y: tile_y_previous_zoom_level - 1});
            }
            if (tile_y_previous_zoom_level < 2 ** (zoom_level - 1) - 1) {
                tiles_to_add.push({x: tile_x_previous_zoom_level + 1, y: tile_y_previous_zoom_level + 1});
            }
        }
        if (tile_y_previous_zoom_level > 0) {
            tiles_to_add.push({x: tile_x_previous_zoom_level, y: tile_y_previous_zoom_level - 1});
        }
        if (tile_y_previous_zoom_level < 2 ** (zoom_level - 1) - 1) {
            tiles_to_add.push({x: tile_x_previous_zoom_level, y: tile_y_previous_zoom_level + 1});
        }
    }

    return tiles_to_add;
}

/**
 * Get the tiles to fetch for a given tile.
 * @param tile_x The x coordinate of the tile.
 * @param tile_y The y coordinate of the tile.
 * @param zoom_level The zoom level.
 * @param max_zoom_level
 * @returns {Map<number, Array<{x: number, y: number}>>} A map containing the tiles to fetch for each zoom level.
 */
export function getTilesToFetch(tile_x, tile_y, zoom_level, max_zoom_level) {
    // Get the number of tiles at the current zoom level
    const number_of_tiles = 2 ** zoom_level;

    const all_tiles = new Map();
    const tiles_current_zoom_level = [];
    const tiles_previous_zoom_level = [];
    const tiles_next_zoom_level = [];

    // First, add all tiles from the previous zoom level.
    tiles_previous_zoom_level.push(...addTilesPreviousZoomLevel(tile_x, tile_y, zoom_level));

    // Then, add all tiles from the current zoom level and the next zoom level.
    tiles_current_zoom_level.push({x: tile_x, y: tile_y});
    tiles_next_zoom_level.push(...addTilesNextZoomLevel(tile_x, tile_y, zoom_level, max_zoom_level));
    // Get all neighboring tiles. This means all tiles at a distance of 1, plus tiles at a distance of 2 on the bottom
    // and on the right.
    if (tile_x > 0) {
        tiles_current_zoom_level.push({x: tile_x - 1, y: tile_y});
        tiles_next_zoom_level.push(...addTilesNextZoomLevel(tile_x - 1, tile_y, zoom_level, max_zoom_level));
        if (tile_y > 0) {
            tiles_current_zoom_level.push({x: tile_x - 1, y: tile_y - 1});
            tiles_next_zoom_level.push(...addTilesNextZoomLevel(tile_x - 1, tile_y - 1, zoom_level, max_zoom_level));
        }
        if (tile_y < number_of_tiles - 1) {
            tiles_current_zoom_level.push({x: tile_x - 1, y: tile_y + 1});
            tiles_next_zoom_level.push(...addTilesNextZoomLevel(tile_x - 1, tile_y + 1, zoom_level, max_zoom_level));
        }
    }
    if (tile_x < number_of_tiles - 1) {
        tiles_current_zoom_level.push({x: tile_x + 1, y: tile_y});
        tiles_next_zoom_level.push(...addTilesNextZoomLevel(tile_x + 1, tile_y, zoom_level, max_zoom_level));
        if (tile_y > 0) {
            tiles_current_zoom_level.push({x: tile_x + 1, y: tile_y - 1});
            tiles_next_zoom_level.push(...addTilesNextZoomLevel(tile_x + 1, tile_y - 1, zoom_level, max_zoom_level));
        }
        if (tile_y < number_of_tiles - 1) {
            tiles_current_zoom_level.push({x: tile_x + 1, y: tile_y + 1});
            tiles_next_zoom_level.push(...addTilesNextZoomLevel(tile_x + 1, tile_y + 1, zoom_level, max_zoom_level));
        }
    }
    if (tile_x < number_of_tiles - 2) {
        tiles_current_zoom_level.push({x: tile_x + 2, y: tile_y});
        tiles_next_zoom_level.push(...addTilesNextZoomLevel(tile_x + 2, tile_y, zoom_level, max_zoom_level));
        if (tile_y < number_of_tiles - 1) {
            tiles_current_zoom_level.push({x: tile_x + 2, y: tile_y + 1});
            tiles_next_zoom_level.push(...addTilesNextZoomLevel(tile_x + 2, tile_y + 1, zoom_level, max_zoom_level));
        }
        if (tile_y < number_of_tiles - 2) {
            tiles_current_zoom_level.push({x: tile_x + 2, y: tile_y + 2});
            tiles_next_zoom_level.push(...addTilesNextZoomLevel(tile_x + 2, tile_y + 2, zoom_level, max_zoom_level));
        }
    }
    if (tile_y < number_of_tiles - 2) {
        tiles_current_zoom_level.push({x: tile_x, y: tile_y + 2});
        tiles_next_zoom_level.push(...addTilesNextZoomLevel(tile_x, tile_y + 2, zoom_level, max_zoom_level));
        if (tile_x < number_of_tiles - 1) {
            tiles_current_zoom_level.push({x: tile_x + 1, y: tile_y + 2});
            tiles_next_zoom_level.push(...addTilesNextZoomLevel(tile_x + 1, tile_y + 2, zoom_level, max_zoom_level));
        }
    }
    if (tile_y > 0) {
        tiles_current_zoom_level.push({x: tile_x, y: tile_y - 1});
        tiles_next_zoom_level.push(...addTilesNextZoomLevel(tile_x, tile_y - 1, zoom_level, max_zoom_level));
    }
    if (tile_y < number_of_tiles - 1) {
        tiles_current_zoom_level.push({x: tile_x, y: tile_y + 1});
        tiles_next_zoom_level.push(...addTilesNextZoomLevel(tile_x, tile_y + 1, zoom_level, max_zoom_level));
    }

    // Add all tiles to the map
    all_tiles.set(zoom_level, tiles_current_zoom_level);
    if (zoom_level - 1 >= 0) {
        all_tiles.set(zoom_level - 1, tiles_previous_zoom_level);
    }
    if (zoom_level + 1 <= max_zoom_level) {
        all_tiles.set(zoom_level + 1, tiles_next_zoom_level);
    }

    return all_tiles;
}