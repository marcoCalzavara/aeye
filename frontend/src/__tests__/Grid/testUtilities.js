// Test grid component
// ----------------------------------------------------------------------------
const { getGridCellsToBeDisplayed } = require('../../Grid/utilities');

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
    expect(total_length).toEqual(window_size_in_cells_per_dim* window_size_in_cells_per_dim);

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
});