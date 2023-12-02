import "jest-canvas-mock";

// Test ClustersMap component
// ----------------------------------------------------------------------------
const {
    fetchClusterData
} = require('../../Map/ClustersMap');

// Test fetchTileData
// ----------------------------------------------------------------------------
test('fetchClusterData', async () => {
    // Test fetching of data from the server
    // Define zoom level
    const zoom_level = 3;
    // Define tile coordinates
    const tile_x = 3;
    const tile_y = 5;
    // Fetch tile data
    return await fetchClusterData(zoom_level, tile_x, tile_y, "http://localhost:80").then(data => {
        // Check that the tile data contains the expected keys
        expect(data).toHaveProperty('tile_coordinate_range');
        expect(data['tile_coordinate_range']).toHaveProperty('x_min');
        expect(data['tile_coordinate_range']).toHaveProperty('x_max');
        expect(data['tile_coordinate_range']).toHaveProperty('y_min');
        expect(data['tile_coordinate_range']).toHaveProperty('y_max');
        expect(data).toHaveProperty('zoom_plus_tile');
        expect(data).toHaveProperty('clusters_representatives');
        expect(data['clusters_representatives']).toBeInstanceOf(Object);
        expect(data['clusters_representatives']).toHaveProperty('entities');
        const entities = data['clusters_representatives']['entities'];
        // Check that an entity is a string, then transform it into an object and check its keys
        for (let i = 0; i < entities.length; i++) {
            expect(entities[i]).toHaveProperty('representative');
            expect(entities[i]).toHaveProperty('number_of_entities');
            const in_entity = entities[i]['representative'];
            expect(in_entity).toHaveProperty('low_dimensional_embedding_x');
            expect(in_entity).toHaveProperty('low_dimensional_embedding_y');
            expect(in_entity).toHaveProperty('index');
            expect(in_entity).toHaveProperty('author');
            expect(in_entity).toHaveProperty('path');
            expect(in_entity).toHaveProperty('height');
            expect(in_entity).toHaveProperty('width');
        }
    });
});