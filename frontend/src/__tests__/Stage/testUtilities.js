// Test grid component
// ----------------------------------------------------------------------------
const {
    fetchTileData,
    fetchImages,
    getGridCellsToBeDisplayed,
    getRealCoordinatesAndIndexesOfImagesToBeDisplayed,
    mapCellsToRealCoordinatePathPairs,
    updateZoomLevel
} = require('../../Map/utilities');

// Test fetchTileData
// ----------------------------------------------------------------------------
test('fetchTileData', async () => {
    // Test fetching of data from the server
    // Define zoom level
    const zoom_level = 3;
    // Define tile coordinates
    const tile_x = 3;
    const tile_y = 5;
    // Fetch tile data
    return await fetchTileData(zoom_level, tile_x, tile_y, "http://localhost:80").then(data => {
        // Check that the tile data contains the expected keys
        expect(data).toHaveProperty("images");
        expect(data).toHaveProperty("zoom_plus_tile");
        // Check that the tile data contains the expected values
        expect(data["images"]).toHaveProperty("indexes");
        expect(data["images"]).toHaveProperty("x_cell");
        expect(data["images"]).toHaveProperty("y_cell");
        expect(data["zoom_plus_tile"]).toEqual([3.0, 3.0, 5.0]);
    });
});

// Test fetchImages
// ----------------------------------------------------------------------------
test('fetchImages', async () => {
    // Define paths of images to be fetched
    const indexes = [1, 2];
    // Fetch images
    return await fetchImages(indexes, "http://localhost:80").then(data => {
        // Check that the data is an array
        expect(Array.isArray(data)).toEqual(true);
        // Check that the data contains the expected number of elements
        expect(data.length).toEqual(2);
        // Check that the data contains the expected elements
        expect(data[0]).toHaveProperty("path");
        expect(data[0]).toHaveProperty("index");
        expect(data[1]).toHaveProperty("path");
        expect(data[1]).toHaveProperty("index");
        expect(data[0]["path"]).toEqual("1-Alfred_Sisley.jpg");
        expect(data[0]["index"]).toEqual(1);
        expect(data[1]["path"]).toEqual("2-Alfred_Sisley.jpg");
        expect(data[1]["index"]).toEqual(2);
    });
});

// Test getGridCellsToBeDisplayed
// ----------------------------------------------------------------------------
test('getGridCellsToBeDisplayed', () => {
    // Define the parameters for the function
    const x = 1012;
    const y = 1929;
    const width_effective = 1000;
    const height_effective = 1000;
    const window_size_in_cells_per_dim = 10;
    // Get the cells to be displayed
    const cells_to_be_displayed = getGridCellsToBeDisplayed(x, y, width_effective, height_effective, window_size_in_cells_per_dim);
    // Check that cells_to_be_displayed contains a total of 100 elements across all values. cells_to_be_displayed is a Map from
    // objects to arrays, and we want to check that the sum of the lengths of all the arrays is 100.
    let total_length = 0;
    for (let value of cells_to_be_displayed.values()) {
        total_length += value.length;
    }
    expect(total_length).toEqual(window_size_in_cells_per_dim * window_size_in_cells_per_dim);

    // Check content of cells_to_be_displayed
    // First, define expected values
    const expected_cells_to_be_displayed = new Map();
    const first_tile = []
    for (let i = 0; i < window_size_in_cells_per_dim; i++) {
        for (let j = 9; j < window_size_in_cells_per_dim; j++) {
            first_tile.push({cell_x: i, cell_y: j});
        }
    }
    expected_cells_to_be_displayed.set(JSON.stringify({tile_x: 1, tile_y: 1}), first_tile);

    const second_tile = []
    for (let i = 0; i < 0; i++) {
        for (let j = 9; j < window_size_in_cells_per_dim; j++) {
            second_tile.push({cell_x: i, cell_y: j});
        }
    }
    expected_cells_to_be_displayed.set(JSON.stringify({tile_x: 2, tile_y: 1}), second_tile);

    const third_tile = []
    for (let i = 0; i < window_size_in_cells_per_dim; i++) {
        for (let j = 0; j < 9; j++) {
            third_tile.push({cell_x: i, cell_y: j});
        }
    }
    expected_cells_to_be_displayed.set(JSON.stringify({tile_x: 1, tile_y: 2}), third_tile);

    const fourth_tile = []
    for (let i = 0; i < 0; i++) {
        for (let j = 0; j < 9; j++) {
            fourth_tile.push({cell_x: i, cell_y: j});
        }
    }
    expected_cells_to_be_displayed.set(JSON.stringify({tile_x: 2, tile_y: 2}), fourth_tile);

    // Check that the keys of the two maps are the same
    expect(cells_to_be_displayed.size).toEqual(expected_cells_to_be_displayed.size);
    for (let key of cells_to_be_displayed.keys()) {
        expect(expected_cells_to_be_displayed.has(key)).toEqual(true);
    }

    // Check that the arrays of the two maps are the same
    for (let key of cells_to_be_displayed.keys()) {
        expect(cells_to_be_displayed.get(key)).toEqual(expected_cells_to_be_displayed.get(key));
    }

    // Test initial conditions
    // Define the parameters for the function
    const x1 = 0;
    const y1 = 0;
    const width_effective1 = 1920;
    const height_effective1 = 1080;
    const cells_to_be_displayed1 = getGridCellsToBeDisplayed(x1, y1, width_effective1, height_effective1, window_size_in_cells_per_dim);
    // Check that the first key of cells_to_be_displayed1 contains all 100 cells
    expect(cells_to_be_displayed1.get(JSON.stringify({tile_x: 0, tile_y: 0})).length).toEqual(100);
});

// Test getRealCoordinatesAndIndexesOfImagesToBeDisplayed
// ----------------------------------------------------------------------------
test('getRealCoordinatesAndIndexesOfImagesToBeDisplayed', () => {
    // Define the parameters for the function
    let tile_data = {
        "zoom_plus_tile": [3.0, 4.0, 7.0],
        "images":
            {
                "indexes": [3921, 385, 4235, 4433, 4514, 3584, 4347, 4430, 4311, 5253, 3651, 4143, 5022, 4196, 3597, 3655, 4126, 4282,
                    4167, 4463, 4480, 4472, 6408, 5033, 4422, 4218, 4364, 3908, 3589, 4304, 4477, 4244, 4279, 4394, 4535, 985, 3030, 3624,
                    4136, 4166, 3606, 979, 2966, 4301, 4482, 4209, 4312, 4346, 3098, 4179, 3630, 5093, 4510, 4222, 724, 5029, 5089, 5053,
                    4948, 3654, 4964],
                "x_cell": [0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7,
                    8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9],
                "y_cell": [0, 1, 3, 4, 0, 1, 2, 3, 4, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 6, 0, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 0, 1, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 7, 1,
                    2, 3, 5, 6, 7, 0, 2, 3, 4, 5, 6, 7]
            }
    };
    // Define cells_to_be_displayed in the current tile
    let cells_to_be_displayed = new Map();
    let first_tile = []
    for (let i = 2; i < 10; i++) {
        for (let j = 4; j < 10; j++) {
            first_tile.push({cell_x: i, cell_y: j});
        }
    }
    cells_to_be_displayed.set(JSON.stringify({tile_x: 4, tile_y: 7}), first_tile);

    let current_real_x = 0;
    let current_real_y = 0;
    let tile_x = 4;
    let tile_y = 7;

    let res = getRealCoordinatesAndIndexesOfImagesToBeDisplayed(current_real_x, current_real_y, tile_x, tile_y, tile_data, cells_to_be_displayed);
    // Check that for all keys in the result the value of x is between 0 and 7 and the value of y is between 0 and 5. This
    // is because we start from the top left corner of the real window, x of the tile goes from 2 to 9 (total 8 values) and
    // y of the tile goes from 4 to 9 (total 6 values).
    for (let key of res.real_coordinates_to_indexes.keys()) {
        key = JSON.parse(key);
        expect(key.x).toBeGreaterThanOrEqual(0);
        expect(key.x).toBeLessThanOrEqual(7);
        expect(key.y).toBeGreaterThanOrEqual(0);
        expect(key.y).toBeLessThanOrEqual(5);
    }

    // Also check that there is no missing image. We check this from the indexes of the images by looping over the real coordinates
    // for x between 0 and 7 and y between 0 and 5. We translate the real coordinates to tile coordinates.
    // First, use the tile data to create a mapping from cells coordinates to indexes of images to be displayed
    let cells_to_indexes = new Map();
    for (let i = 0; i < tile_data["images"]["indexes"].length; i++) {
        cells_to_indexes.set(JSON.stringify({
            cell_x: tile_data["images"]["x_cell"][i],
            cell_y: tile_data["images"]["y_cell"][i]
        }), tile_data["images"]["indexes"][i]);
    }

    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 6; j++) {
            let x_cell = i + 2;
            let y_cell = j + 4;
            // Check that it if the cell is in tile data, then it is also in the result.
            if (cells_to_indexes.has(JSON.stringify({cell_x: x_cell, cell_y: y_cell}))) {
                expect(res.real_coordinates_to_indexes.has(JSON.stringify({x: i, y: j}))).toEqual(true);
            }
        }
    }

    // Check shifts
    expect(res.shift_x).toEqual(8);
    expect(res.shift_y).toEqual(6);

    // Do another test with a different tile
    tile_data = {
        "images":
            {
                "indexes":
                    [4189, 5018, 6919, 6977, 6954, 3464, 6924, 4928, 4481, 5755, 3471, 3539, 3553, 4937, 5019, 3472, 4220, 3523, 6961,
                        3542, 3460, 3551, 6929, 3544, 5077, 3529, 3357, 675, 4359, 3456, 6986, 5724, 5001, 3498, 6972, 6970, 4952, 3353,
                        2857, 5079, 3507, 4947, 4919, 5058, 4927, 6428, 3554, 3465, 5056, 4962, 3660, 4972, 3641, 5082, 619, 3368, 4944,
                        4999, 4925, 5061, 5075, 5006, 3640, 3358, 4303, 3135, 4956, 4941, 3566, 3679, 3591, 3350, 3664, 5775, 5023, 4994,
                        4976, 3559, 4912, 4967, 3578, 3633],
                "x_cell": [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4,
                    4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9],
                "y_cell": [0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7,
                    8, 0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 8, 1, 3, 4, 5, 6, 7, 3, 4, 5, 6, 7]
            },
        "zoom_plus_tile": [3.0, 5.0, 7.0]
    };
    let second_tile = []
    for (let i = 0; i < 2; i++) {
        for (let j = 4; j < 10; j++) {
            second_tile.push({cell_x: i, cell_y: j});
        }
    }

    cells_to_be_displayed.set(JSON.stringify({tile_x: 5, tile_y: 7}), second_tile);
    current_real_x = res.shift_x;
    current_real_y = 0;
    tile_x = 5;
    tile_y = 7;

    res = getRealCoordinatesAndIndexesOfImagesToBeDisplayed(current_real_x, current_real_y, tile_x, tile_y, tile_data, cells_to_be_displayed);
    for (let key of res.real_coordinates_to_indexes.keys()) {
        key = JSON.parse(key);
        expect(key.x).toBeGreaterThanOrEqual(8);
        expect(key.x).toBeLessThanOrEqual(9);
        expect(key.y).toBeGreaterThanOrEqual(0);
        expect(key.y).toBeLessThanOrEqual(5);
    }

    // Also check that there is no missing image. We check this from the indexes of the images by looping over the real coordinates
    // for x between 0 and 7 and y between 0 and 5. We translate the real coordinates to tile coordinates.
    // First, use the tile data to create a mapping from cells coordinates to indexes of images to be displayed
    cells_to_indexes = new Map();
    for (let i = 0; i < tile_data["images"]["indexes"].length; i++) {
        cells_to_indexes.set(JSON.stringify({
            cell_x: tile_data["images"]["x_cell"][i],
            cell_y: tile_data["images"]["y_cell"][i]
        }), tile_data["images"]["indexes"][i]);
    }

    for (let i = 8; i < 10; i++) {
        for (let j = 0; j < 6; j++) {
            let x_cell = i - 8;
            let y_cell = j + 4;
            // Check that it if the cell is in tile data, then it is also in the result.
            if (cells_to_indexes.has(JSON.stringify({cell_x: x_cell, cell_y: y_cell}))) {
                expect(res.real_coordinates_to_indexes.has(JSON.stringify({x: i, y: j}))).toEqual(true);
            }
        }
    }

    // Check shifts
    expect(res.shift_x).toEqual(10);
    expect(res.shift_y).toEqual(6);
});

// Test mapCellsToRealCoordinatePathPairs
// ----------------------------------------------------------------------------
test('mapCellsToRealCoordinatePathPairs', async () => {
    // Define cells_to_be_displayed in the current tile
    let cells_to_be_displayed = new Map();
    // Populate cells_to_be_displayed
    let first_tile_cells = []
    for (let i = 2; i < 10; i++) {
        for (let j = 4; j < 10; j++) {
            first_tile_cells.push({cell_x: i, cell_y: j});
        }
    }
    cells_to_be_displayed.set(JSON.stringify({tile_x: 3, tile_y: 5}), first_tile_cells);

    let second_tile_cells = []
    for (let i = 0; i < 2; i++) {
        for (let j = 4; j < 10; j++) {
            second_tile_cells.push({cell_x: i, cell_y: j});
        }
    }
    cells_to_be_displayed.set(JSON.stringify({tile_x: 4, tile_y: 5}), second_tile_cells);

    let third_tile_cells = []
    for (let i = 2; i < 10; i++) {
        for (let j = 0; j < 4; j++) {
            third_tile_cells.push({cell_x: i, cell_y: j});
        }
    }
    cells_to_be_displayed.set(JSON.stringify({tile_x: 3, tile_y: 6}), third_tile_cells);

    let fourth_tile_cells = []
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 4; j++) {
            fourth_tile_cells.push({cell_x: i, cell_y: j});
        }
    }
    cells_to_be_displayed.set(JSON.stringify({tile_x: 4, tile_y: 6}), fourth_tile_cells);

    // Define zoom level
    let zoom_level = 3;
    // Get the result
    let res = await mapCellsToRealCoordinatePathPairs(cells_to_be_displayed, zoom_level, "http://localhost:80");
    // Check that the result contains 100 elements
    expect(res.size).toBeLessThanOrEqual(100);


    // Test initial conditions
    // Define the parameters for the function
    const x1 = 0;
    const y1 = 0;
    const width_effective1 = 1920;
    const height_effective1 = 1080;
    const cells_to_be_displayed1 = getGridCellsToBeDisplayed(x1, y1, width_effective1, height_effective1, 10);
    // Get the result
    res = await mapCellsToRealCoordinatePathPairs(cells_to_be_displayed1, 0, "http://localhost:80");
    // Check that the result contains 100 elements
    expect(res.size).toBeLessThanOrEqual(100);
});

// Test updateZoomLevel
// ----------------------------------------------------------------------------
test('updateZoomLevel', async () => {
    let zoom_level = 2;
    let new_zoom_level = 3;
    let pointer_x = 1250;
    let pointer_y = 1000;
    let x = 1354;
    let y = 727;
    let width_effective = 1000;
    let height_effective = 1000;
    let width_real = 4000;
    let height_real = 4000;
    let window_size_in_cells_per_dim = 10;
    let res = await updateZoomLevel(new_zoom_level, zoom_level, pointer_x, pointer_y, x, y, width_effective,
        height_effective, width_real, height_real, window_size_in_cells_per_dim, "http://localhost:80");
    expect(res.x).toEqual(1354 + (1000 / 3.2) / 2);
    expect(res.y).toEqual(727 + 125);
    expect(res.width_effective).toEqual(500);
    expect(res.height_effective).toEqual(500);
    expect(res.real_coordinates_to_image_paths.size).toEqual(15);

    // Check shrinking
    zoom_level = 3;
    new_zoom_level = 2;
    width_effective = 500;
    height_effective = 500;
    res = await updateZoomLevel(new_zoom_level, zoom_level, pointer_x, pointer_y, x, y, width_effective,
        height_effective, width_real, height_real, window_size_in_cells_per_dim, "http://localhost:80");
    expect(res.x).toEqual(1354 - (1250 * 500 / 4000));
    expect(res.y).toEqual(727 - (1000 * 500 / 4000));
    expect(res.width_effective).toEqual(1000);
    expect(res.height_effective).toEqual(1000);
    expect(res.real_coordinates_to_image_paths.size).toEqual(61);
});
