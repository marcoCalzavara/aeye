import React from 'react';
import {getGridCellsToBeDisplayed, mapCellsToRealCoordinatePathPairs, updateZoomLevel} from './utilities.js';


// Define constants
const WINDOW_SIZE_IN_CELLS_PER_DIM = 10;
const MAX_ZOOM_LEVEL = 5; // TODO get max zoom level from other component
// TODO: both the dataset and the max zoom level should be fetched from the server using /api/collection-info

// Define react component for the map. The map is a grid of tiles of size 10x10 tiles. The tiles are of fixed size and
// rectangular. The real window is fixed, while the effective window changes by a factor of 4 (2 in each direction) when
// moving from one zoom level to the next. The map scales by keeping the point where the pointer is fixed.
export default function Grid() {
    // Define boolean for first render
    const [first_render, setFirstRender] = React.useState(true);
    // Define boolean for mouse down
    const [mouse_down, setMouseDown] = React.useState(false);
    // Define zoom level
    const [zoom_level, setZoomLevel] = React.useState(0);
    const [cumulative_zoom_level, setCumulativeZoomLevel] = React.useState(0);
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
    // const images = new Cache(MAX_CACHE_SIZE);

    // Define data structure for storing the images with the real window coordinates. This is a map from
    // coordinates of images in the real window to paths.
    const [real_coordinates_to_image_paths, setRealCoordinatesToImagePaths] = React.useState(new Map());


    // // Define what to do on mount
    React.useEffect(() => {
        const fetchInitialData = async () => {
            // Get the cells to be displayed
            const cells_to_be_displayed = getGridCellsToBeDisplayed(x, y, width_effective, height_effective, WINDOW_SIZE_IN_CELLS_PER_DIM);
            // Get the images to be displayed and set state
            const real_coordinates_to_image_paths = await mapCellsToRealCoordinatePathPairs(cells_to_be_displayed, zoom_level, "http://localhost:80"); // TODO remove localhost
            setRealCoordinatesToImagePaths(real_coordinates_to_image_paths);
        }
        if (first_render) {
            setFirstRender(false);
            // noinspection JSIgnoredPromiseFromCall
            fetchInitialData();
        }
    }, []);

    // Define handler for wheel event. The handler is called when the user zooms in or out.
    const onWheel = async (event) => {
        // Update cumulative zoom level
        setCumulativeZoomLevel(cumulative_zoom_level + event.deltaY / 100);
        console.log(event.deltaY)
        if (Math.round(cumulative_zoom_level) !== zoom_level) {
            let new_zoom_level = Math.round(cumulative_zoom_level);
            // Get position of pointer
            const pointer_x = event.clientX;
            const pointer_y = event.clientY;
            // Check that the zoom level is not lower than 0 or greater than the max available zoom level for the collection
            if (new_zoom_level < 0) {
                new_zoom_level = 0;
            } else if (new_zoom_level > MAX_ZOOM_LEVEL) {
                new_zoom_level = MAX_ZOOM_LEVEL;
            }
            // Update zoom level if it has changed
            if (new_zoom_level !== zoom_level) {
                const res = await updateZoomLevel(new_zoom_level, zoom_level, pointer_x, pointer_y, x, y, width_effective,
                    height_effective, width_real, height_real, WINDOW_SIZE_IN_CELLS_PER_DIM, "http://localhost:80"); // TODO remove localhost
                setZoomLevel(new_zoom_level)
                setX(res.x);
                setY(res.y);
                setWEff(res.width_effective);
                setHEff(res.height_effective);
                setRealCoordinatesToImagePaths(res.real_coordinates_to_image_paths)
            }
        }

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
        // Get the new location of the effective window
        const new_x = x - event.movementY / 3.;
        const new_y = y - event.movementX / 3.;
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
        const cells_to_be_displayed = getGridCellsToBeDisplayed(x, y, width_effective, height_effective, WINDOW_SIZE_IN_CELLS_PER_DIM);
        // Now set_cells_to_be_displayed should be a map from tile coordinates to coordinates of cells that are within
        // the effective window. The coordinates of the cells are relative to the tile.
        setRealCoordinatesToImagePaths(await mapCellsToRealCoordinatePathPairs(cells_to_be_displayed, zoom_level, "http://localhost:80"));
    }

    // Return react component. The React component is a div component with many div components inside. The div components
    // are the tiles, and they are positioned as a grid inside the div component. Also define behavior of the component
    // when the user zooms in or out or drags the map.
    return (
        <div className="w-2/3 h-920px flex flex-col z-10 bg-black rounded-lg m-1 cursor-grab"
             onWheel={onWheel}
             onMouseDown={onMouseDown}
             onMouseUp={onMouseUp}
             onMouseMove={onMouseMove}>
            {
                Array.from({length: WINDOW_SIZE_IN_CELLS_PER_DIM}).map((_, rowIndex) => (
                    <div
                        className={`h-1/10 flex border-t-4 border-black box-border ${rowIndex === WINDOW_SIZE_IN_CELLS_PER_DIM - 1 ? "border-b-4" : ""}`}
                        key={rowIndex}>
                        {
                            Array.from({length: WINDOW_SIZE_IN_CELLS_PER_DIM}).map((_, colIndex) => (
                                // Set ml-1 for all cells except the last one, which is set to mr-1
                                <div
                                    className={`w-1/10 pointer-events-none select-none flex border-l-4 border-black box-border ${colIndex === WINDOW_SIZE_IN_CELLS_PER_DIM - 1 ? "border-r-4" : ""}`}
                                    key={colIndex}>
                                    {/* If the cell is among the cells to be displayed, then display the image. The image is in the
                                        cache, so it is fetched from the cache. */}
                                    {
                                        real_coordinates_to_image_paths.has(JSON.stringify({
                                            x: rowIndex,
                                            y: colIndex
                                        })) &&
                                        // Resize the image to fit the cell
                                        <img
                                            // Make sure image takes up the whole cell with no gaps, so it is stretched
                                            // to fit the cell.
                                            className={"w-full h-full object-cover"}
                                            src={`http://localhost:80/best_artworks/${real_coordinates_to_image_paths.get(JSON.stringify({
                                                x: rowIndex,
                                                y: colIndex
                                            }))}`} // TODO remove localhost and best_artworks
                                            alt={real_coordinates_to_image_paths.get(JSON.stringify({
                                                x: rowIndex,
                                                y: colIndex
                                            }))}
                                        />
                                    }
                                </div>
                            ))
                        }
                    </div>
                ))
            }
        </div>
    );
}
