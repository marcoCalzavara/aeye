import Cache from './Cache.js';
import React from 'react';
import {getGridCellsToBeDisplayed, mapCellsToRealCoordinatePathPairs} from './utilities.js';


// Define constants
const WINDOW_SIZE_IN_CELLS_PER_DIM = 10;
const MAX_CACHE_SIZE = 100;
const MAX_ZOOM_LEVEL = 5; // TODO get max zoom level from other component
// TODO: both the dataset and the max zoom level should be fetched from the server using /api/collection-info

// Define react component for the map. The map is a grid of tiles of size 10x10 tiles. The tiles are of fixed size and
// rectangular. The real window is fixed, while the effective window changes by a factor of 4 (2 in each direction) when
// moving from one zoom level to the next. The map scales by keeping the point where the pointer is fixed.
export default function Grid() {
    // Define zoom level
    const [zoom_level, setZoomLevel] = React.useState(0);
    // Define position of effective window with respect to left upper corner of real window
    const [x, setX] = React.useState(0);
    const [y, setY] = React.useState(0);

    // Define width and height of real window, set them to width and height of window
    const width_real = window.screen.width;
    const height_real = window.screen.height;

    // Define width and height of effective window
    const [width_effective, setWEff] = React.useState(window.screen.width);
    const [height_effective, setHEff] = React.useState(window.screen.height);

    // Define cache for images. We keep not only the images to be displayed, but also the images in the tiles
    // surrounding the tiles to be displayed. This is done to avoid having to fetch the images from the server every
    // time the user moves the pointer. The cache is map from indexes to images. This should speed up the transition
    // between tiles when the user moves the pointer.
    const images = new Cache(MAX_CACHE_SIZE);

    // Define tile data to be displayed. This is a map from tile coordinates to coordinates of cells that are within
    // the effective window. The coordinates of the cells are relative to the tile.
    const [cells_to_be_displayed, setCellsToBeDisplayed] = React.useState(new Map());

    // Define data structure for storing the images with the real window coordinates. This is a map from
    // coordinates of images in the real window to paths.
    const [real_coordinates_to_image_paths, setRealCoordinatesToImagePaths] = React.useState(new Map());


    // Define function for updating the zoom level. The zoom level is updated by the user when zooming in or out.
    const updateZoomLevel = (new_zoom_level) => {
        // Note that the check on the validity of the new zoom level is done in the function that calls this function.
        // If the new zoom level is greater than the current zoom level, then the user is zooming in. Modify the location
        // of the effective window so that the point where the pointer is remains fixed.
        // Compute temporary x and y coordinates of the effective window
        const x_temp = x + width_effective / 2 ** (new_zoom_level - zoom_level);
        const y_temp = y + height_effective / 2 ** (new_zoom_level - zoom_level);
        // Move x and y so that the point coincides with the top right corner of the cell in the tile which contains (x,y).
        // Note that the effective window is always equal to a tile and there are 10x10 grid cells in a tile.
        setX(x_temp - x_temp % (width_effective / WINDOW_SIZE_IN_CELLS_PER_DIM));
        setY(y_temp - y_temp % (height_effective / WINDOW_SIZE_IN_CELLS_PER_DIM));

        // Update zoom level
        setZoomLevel(new_zoom_level);
        // Change width and height of effective window
        setWEff(width_real / (2 ** new_zoom_level));
        setHEff(height_real / (2 ** new_zoom_level));

        // Get the cells to be displayed
        setCellsToBeDisplayed(getGridCellsToBeDisplayed(x, y, width_effective, height_effective, WINDOW_SIZE_IN_CELLS_PER_DIM));

        // Now set_cells_to_be_displayed should be a map from tile coordinates to coordinates of cells that are within
        // the effective window. The coordinates of the cells are relative to the tile.
        setRealCoordinatesToImagePaths(mapCellsToRealCoordinatePathPairs(cells_to_be_displayed, zoom_level));
    }

    // Define handler for wheel event. The handler is called when the user zooms in or out.
    const onWheel = (event) => {
        // Prevent default behavior of the event
        event.preventDefault();
        // Get the new zoom level
        let new_zoom_level = zoom_level - event.deltaY / 100;
        // Check that the zoom level is not lower than 0 or greater than the max available zoom level for the collection
        if (new_zoom_level < 0) {
            new_zoom_level = 0;
        } else if (new_zoom_level > MAX_ZOOM_LEVEL) {
            new_zoom_level = MAX_ZOOM_LEVEL;
        }
        // Update zoom level if it has changed
        if (new_zoom_level !== zoom_level) {
            updateZoomLevel(new_zoom_level);
        }
    }

    // Define handler for drag event. The handler is called when the user drags the map.
    const onDrag = (event) => {
        // Prevent default behavior of the event
        event.preventDefault();
        // Get the new location of the effective window
        const new_x = x + event.movementX;
        const new_y = y + event.movementY;
        // First, check that the new location is valid. The new location is valid if the effective window is still
        // within the real window. The effective window is defined by the top left corner and the bottom right corner.
        // The top left corner is (x,y) and the bottom right corner is (x+width_effective, y+height_effective).
        // The new location is valid if the top left corner is within the real window and the bottom right corner is
        // within the real window.
        if (new_x >= 0 && new_y >= 0 && new_x + width_effective <= width_real && new_y + height_effective <= height_real) {
            // The new location is valid. Update the location of the effective window.
            setX(new_x);
            setY(new_y);
        }
        // Else crop the new location so that the effective window is within the real window.
        else {
            // If the top left corner is outside the real window, then set it to the top left corner of the real window.
            if (new_x < 0) {
                setX(0);
            }
            if (new_y < 0) {
                setY(0);
            }
            // If the bottom right corner is outside the real window, then set it to the bottom right corner of the real
            // window.
            if (new_x + width_effective > width_real) {
                setX(width_real - width_effective);
            }
            if (new_y + height_effective > height_real) {
                setY(height_real - height_effective);
            }
        }
        // Update the list of images to be displayed
        // Get the cells to be displayed
        setCellsToBeDisplayed(getGridCellsToBeDisplayed(x, y, width_effective, height_effective, WINDOW_SIZE_IN_CELLS_PER_DIM));
        // Now set_cells_to_be_displayed should be a map from tile coordinates to coordinates of cells that are within
        // the effective window. The coordinates of the cells are relative to the tile.
        setCellsToBeDisplayed(mapCellsToRealCoordinatePathPairs(cells_to_be_displayed, zoom_level));
    }

    // Return react component. The React component is a div component with many div components inside. The div components
    // are the tiles, and they are positioned as a grid inside the div component. Also define behavior of the component
    // when the user zooms in or out or drags the map.
    return (
        // Define div component for the map. The div component is divided into 10 buckets in each direction. Each bucket
        // stores an image or is left empty.
        <div className="w-full h-full flex justify-between items-center z-10 bg-black rounded-lg" onWheel={onWheel}
                                                                                        onDrag={onDrag}>
            {/* Loop over each direction from 0 to WINDOW_SIZE_IN_CELLS_PER_DIM - 1, check if the coordinate of the cell
            is among the coordinates of the cells to be displayed, and if so, display the image. Otherwise, display
            an empty div. */}
            {
                images.add_batch(Array.from(real_coordinates_to_image_paths.values())) &&
                (Array.from(Array(WINDOW_SIZE_IN_CELLS_PER_DIM).keys()).map((x_cell) => (
                    Array.from(Array(WINDOW_SIZE_IN_CELLS_PER_DIM).keys()).map((y_cell) => (
                        // Define div component for the cell. The div component is a square with side equal to the width of
                        // the real window divided by the number of cells in each direction.
                        <div className="w-1/10 h-1/10 bg-black" key={x_cell * WINDOW_SIZE_IN_CELLS_PER_DIM + y_cell}>
                            {/* If the cell is among the cells to be displayed, then display the image. The image is in the
                        cache, so it is fetched from the cache. */}
                            {
                                real_coordinates_to_image_paths.has({x: x_cell, y: y_cell}) &&
                                <img src={images.get(real_coordinates_to_image_paths.get({x: x_cell, y: y_cell}))}
                                     alt={real_coordinates_to_image_paths.get({x: x_cell, y: y_cell}).remove(".jpg")}/>
                            }
                        </div>
                    )))))
            }
        </div>
    );
}
