// This file contains utility functions for the map.

/**
 * Get the tiles to fetch for a given tile.
 * @param tile_x
 * @param tile_y
 * @param zoom_level
 * @returns {*[]}
 */
export function getTilesToFetch(tile_x, tile_y, zoom_level) {
    // Get the number of tiles at the current zoom level
    const number_of_tiles = 2 ** zoom_level;

    const tiles = [];
    tiles.push({x: tile_x, y: tile_y});
    // Get all neighboring tiles. This means all tiles at a distance of 1, plus tiles at a distance of 2 on the bottom
    // and on the right.
    if (tile_x > 0) {
        tiles.push({x: tile_x - 1, y: tile_y});
        if (tile_y > 0) {
            tiles.push({x: tile_x - 1, y: tile_y - 1});
        }
        if (tile_y < number_of_tiles - 1) {
            tiles.push({x: tile_x - 1, y: tile_y + 1});
        }
    }
    if (tile_x < number_of_tiles - 1) {
        tiles.push({x: tile_x + 1, y: tile_y});
        if (tile_y > 0) {
            tiles.push({x: tile_x + 1, y: tile_y - 1});
        }
        if (tile_y < number_of_tiles - 1) {
            tiles.push({x: tile_x + 1, y: tile_y + 1});
        }
    }
    if (tile_x < number_of_tiles - 2) {
        tiles.push({x: tile_x + 2, y: tile_y});
        if (tile_y < number_of_tiles - 1) {
            tiles.push({x: tile_x + 2, y: tile_y + 1});
        }
        if (tile_y < number_of_tiles - 2) {
            tiles.push({x: tile_x + 2, y: tile_y + 2});
        }
    }
    if (tile_y < number_of_tiles - 2) {
        tiles.push({x: tile_x, y: tile_y + 2});
        if (tile_x < number_of_tiles - 1) {
            tiles.push({x: tile_x + 1, y: tile_y + 2});
        }
    }
    if (tile_y > 0) {
        tiles.push({x: tile_x, y: tile_y - 1});
    }
    if (tile_y < number_of_tiles - 1) {
        tiles.push({x: tile_x, y: tile_y + 1});
    }

    return tiles;
}