import React from 'react';
import {DATASET} from "./Cache"

// Define constants
const WINDOW_SIZE_IN_CELLS_PER_DIM = 10;
const MAX_ZOOM_LEVEL = 5; // TODO get max zoom level from other component
// TODO: both the dataset and the max zoom level should be fetched from the server using /api/collection-info

// FETCHING FUNCTIONS

export function fetchZoomLevelImageData(zoom_level, image_x, image_y, host = "") {
    const url = `${host}/api/zoom-level-data?zoom_level=${zoom_level}&image_x=${image_x}&image_y=${image_y}
                            &collection=${DATASET}_zoom_levels_images`;
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


export function fetchZoomLevelImage(path, host = "") {
    // Fetch images from the server
    return fetch(`${host}/${DATASET}/${path}`,
        {
            method: 'GET'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Images could not be retrieved from the server.' +
                    ' Please try again later. Status: ' + response.status + ' ' + response.statusText);
            }
            return response.blob();
        })
        .catch(error => {
            console.log(error)
        });
}

// Define react component for the map.
export default function Map() {
    // Define constants
    const TILE_WIDTH_IN_PIXELS = WINDOW_SIZE_IN_CELLS_PER_DIM * 2 ** (MAX_ZOOM_LEVEL + 3);
    const TILE_HEIGHT_IN_PIXELS = WINDOW_SIZE_IN_CELLS_PER_DIM * 2 ** (MAX_ZOOM_LEVEL + 2) * 1.5;
    const MAP_WIDTH_IN_PIXELS = TILE_WIDTH_IN_PIXELS * 2 ** MAX_ZOOM_LEVEL;
    const MAP_HEIGHT_IN_PIXELS = TILE_HEIGHT_IN_PIXELS * 2 ** MAX_ZOOM_LEVEL;
    // Define state variables
    // First render
    const [first, setFirst] = React.useState(true);
    // Define x and y coordinates of the top left corner of the moving window
    const [x, setX] = React.useState(0);
    const [y, setY] = React.useState(0);
    // Define zoom level
    const [zoom_level, setZoomLevel] = React.useState(0);
    // Define percentage of transition between zoom levels. The percentage is a number between -1 and 1.
    const [transition_percentage, setTransitionPercentage] = React.useState(0);
    // Define variable for mouse down
    const [mouse_down, setMouseDown] = React.useState(false);
    // Define variables for the tiles that are displayed or are at the next zoom level or previous zoom level
    const [tiles, setTiles] = React.useState([]);
    // Define variable for tiles position.
    const [tiles_positions, setTilesPositions] = React.useState([]);

    // Define what to do on mount
    React.useEffect(() => {
        const fetchInitialData = async () => {
            // Get tile at zoom level 0
            const data = await fetchZoomLevelImageData(0, 0, 0, "http://localhost:80")
            setTiles(new Map().set(JSON.stringify({x: 0, y: 0}), {path: data["path_to_image"], abs_position: {x: 0, y: 0}}));
        }
        if (first) {
            // Set first to false
            setFirst(false);
            // Fetch initial data
            // noinspection JSIgnoredPromiseFromCall
            fetchInitialData();
        }
    }, []);

    // Define function for computing the tile coordinates. The tile coordinates are given by the following formula:
    // tile_x = Math.floor(x / TILE_WIDTH_IN_PIXELS), TILE_WIDTH_IN_PIXELS = WINDOW_SIZE_IN_CELLS_PER_DIM * 2 ** (MAX_ZOOM_LEVEL + 3)
    // tile_y = Math.floor(y / TILE_HEIGHT_IN_PIXELS), TILE_HEIGHT_IN_PIXELS = WINDOW_SIZE_IN_CELLS_PER_DIM * 2 ** (MAX_ZOOM_LEVEL + 2) * 1.5
    const getTileCoordinates = (x, y) => {
        // Compute the tile coordinates. x and y are the coordinates of the top left corner of the moving window.
        // Do not round the values as we want to know where we are within the tile.
        // Note that the perceived size of the tile is the entire map at zoom level 0, a quarter of the map at zoom level 1,
        // and so on.
        const tile_x = x / (TILE_WIDTH_IN_PIXELS * 2 ** (MAX_ZOOM_LEVEL - zoom_level));
        const tile_y = y / (TILE_HEIGHT_IN_PIXELS * 2 ** (MAX_ZOOM_LEVEL - zoom_level));
        // Return the tile coordinates
        return [tile_x, tile_y];
    }

    const getPathsAndLocations = async (tile_x, tile_y) => {
        // Get tiles to display. The first tile is the current one, then we also take the tiles on the right, on the
        // bottom, and on the right bottom if tile_x - Math.floor(tile_x) or tile_y - Math.floor(tile_y) are greater
        // than 0.
        const temp_tiles_to_display = [];
        const temp_tiles_position = [];
        // Add current tile. All other tiles are positioned relatively to this tile.
        const data = await fetchZoomLevelImageData(zoom_level, Math.floor(tile_x), Math.floor(tile_y), "http://localhost:80")
        temp_tiles_to_display.push({path: data["path_to_image"], tile: {x: Math.floor(tile_x), y: Math.floor(tile_y)}});
        temp_tiles_position.push({x: tile_x, y: tile_y});

        // Add tiles on the right
        if (tile_x - Math.floor(tile_x) > 0) {
            const data = await fetchZoomLevelImageData(zoom_level, Math.floor(tile_x) + 1, Math.floor(tile_y), "http://localhost:80")
            temp_tiles_to_display.push({path: data["path_to_image"], tile: {x: Math.floor(tile_x) + 1, y: Math.floor(tile_y)}});
            temp_tiles_position.push({x: tile_x + 1, y: tile_y});
        }
        // Add tiles on the bottom
        if (tile_y - Math.floor(tile_y) > 0) {
            const data = await fetchZoomLevelImageData(zoom_level, Math.floor(tile_x), Math.floor(tile_y) + 1, "http://localhost:80")
            temp_tiles_to_display.push({path: data["path_to_image"], tile: {x: Math.floor(tile_x), y: Math.floor(tile_y) + 1}});
            temp_tiles_position.push({x: tile_x, y: tile_y + 1});

        }
        // Add tile on the right bottom
        if (tile_x - Math.floor(tile_x) > 0 && tile_y - Math.floor(tile_y) > 0) {
            const data = await fetchZoomLevelImageData(zoom_level, Math.floor(tile_x) + 1, Math.floor(tile_y) + 1, "http://localhost:80")
            temp_tiles_to_display.push({path: data["path_to_image"], tile: {x: Math.floor(tile_x) + 1, y: Math.floor(tile_y) + 1}});
            temp_tiles_position.push({x: tile_x + 1, y: tile_y + 1});
        }

        return [temp_tiles_to_display, temp_tiles_position];
    }

    // Define handler for mouse down event. The handler is called when the user clicks on the map.
    const onMouseDown = () => {
        // Set mouse down to true
        setMouseDown(true);
    }

    // Define handler for mouse up event. The handler is called when the user releases the mouse button.
    const onMouseUp = () => {
        // Set mouse down to false
        setMouseDown(false);
    }

    // Define handler for drag event. The handler is called when the user drags the map.
    const onMouseMove = async (event) => {
        // If the mouse is not down, then return
        if (!mouse_down) {
            return;
        }

        // Transform the shift to actual map shift
        const shift_x = event.movementX * 2 ** (MAX_ZOOM_LEVEL - zoom_level);
        const shift_y = event.movementY * 2 ** (MAX_ZOOM_LEVEL - zoom_level);

        // Check that the new location is valid. The new location is valid if it is within the limits.
        // If the new location is valid, then update the location of the moving window.
        setX(Math.min(Math.max(x + shift_x, 0), MAP_HEIGHT_IN_PIXELS - TILE_WIDTH_IN_PIXELS * 2 ** (MAX_ZOOM_LEVEL - zoom_level)));
        setY(Math.min(Math.max(y + shift_y, 0), MAP_HEIGHT_IN_PIXELS - TILE_HEIGHT_IN_PIXELS * 2 ** (MAX_ZOOM_LEVEL - zoom_level)));

        // Update the tiles that are displayed
        const [tile_x, tile_y] = getTileCoordinates(x, y);
        // If the first tile has changed, then change all other tiles as well, else change only the positions of the tiles.
        // Get index of the first tile
        const first_tile_x = Math.floor(tiles_positions[0].x);
        const first_tile_y = Math.floor(tiles_positions[0].y);
        // If it has changed then update all tiles
        if (first_tile_x !== Math.floor(tile_x) || first_tile_y !== Math.floor(tile_y)) {
            // Get paths and locations
            const [temp_tiles_to_display, temp_tiles_position] = await getPathsAndLocations(tile_x, tile_y);
            // Update the tiles that are displayed
            setTiles(temp_tiles_to_display);
            // Update the tiles position
            setTilesPositions(temp_tiles_position);
        }
        else {
            // Just change the position of the tiles
            // Change location of first tile
            const temp_tiles_position = [];
            const shift_left = - tile_x + Math.floor(tile_x);
            const shift_top = - tile_y + Math.floor(tile_y);
            temp_tiles_position.push({x: shift_left, y: shift_top});
            // Add tiles on the right
            temp_tiles_position.push({x: shift_left + 1, y: shift_top});
            // Add tiles on the bottom
            temp_tiles_position.push({x: shift_left, y: shift_top + 1});
            // Add tile on the right bottom
            temp_tiles_position.push({x: shift_left + 1, y: shift_top + 1});
            // Update the tiles position
            setTilesPositions(temp_tiles_position);
        }
    }

    // Define handler for wheel event. The handler is called when the user zooms in or out.
    const onWheel = async (event) => {
        // Compute the delta of transition percentage.
        const delta_transition_percentage = event.deltaY / 1000;

        if (zoom_level === 0 && transition_percentage + delta_transition_percentage < 0) {
            // If the zoom level is 0 and the user wants to zoom out, then return
            return;
        }

        // Get position of the mouse
        const x_pointer = event.clientX;
        const y_pointer = event.clientY;

        // Identify the tile where the mouse is.


        // Map this value from container coordinates to map coordinates
        const container_width = event.eventTarget.offsetWidth;
        const container_height = event.eventTarget.offsetHeight;
        // The location in the map depends on the tile where the mouse is.
        // Update the transition percentage. If it exceeds 1 or -1, then update the zoom level and put the transition
        // percentage back to the difference between the transition percentage and 1 or -1.
        const new_transition_percentage = transition_percentage + delta_transition_percentage;
        if (new_transition_percentage > 1) {
            // Update the zoom level
            setZoomLevel(zoom_level + 1);
            // Update the transition percentage
            setTransitionPercentage(new_transition_percentage - 1);
        } else if (new_transition_percentage < -1) {
            // Update the zoom level
            const new_zoom_level = zoom_level - 1;
            // Update the transition percentage
            setTransitionPercentage(new_transition_percentage + 1);
        } else {
            // Update the transition percentage
            setTransitionPercentage(new_transition_percentage);
        }

        // What has changed is the perceived size of the tiles. The perceived size of the tile at zoom level 0 is
        // the entire map; the perceived size of the tile at zoom level 1 is a quarter of the map, and so on.
        // Compute the tile we are in.
        const [tile_x, tile_y] = getTileCoordinates(x_map, y_map);
        // Get tiles to display. The first tile is the current one, then we also take the tiles on the right, on the
        // bottom, and on the right bottom if tile_x - Math.floor(tile_x) or tile_y - Math.floor(tile_y) are greater
        // than 0.
        // Get paths and locations
        const [temp_tiles_to_display, temp_tiles_position] = await getPathsAndLocations(tile_x, tile_y);
        // Update the tiles that are displayed
        setTiles(temp_tiles_to_display);
        // Update the tiles position
        setTilesPositions(temp_tiles_position);
    }

    // Return react component.

    return (
        <div className="w-2/3 h-920px z-10 bg-black rounded-lg m-1 cursor-grab">
            {/*Place images and rescale them to the size of the container. Images are placed absolutely.
            Place first image based on absolute position information, place all other images based on the position of the
            first image.*/}
            {tiles.map((tile, index) => {
                const key = JSON.stringify({x: index_x, y: index_y});
                return <img key={key}
                            src={`http://localhost:80/best_artworks/zoom_levels/${tile.path}`}
                            alt={tile.path}
                            className="absolute w-full h-full"
                            style={{left: `${shift_left * 100}%`, top: `${shift_top * 100}%`}}/>
            })}
            {/*Place moving window. The moving window is placed absolutely.*/}

        </div>
    );
}