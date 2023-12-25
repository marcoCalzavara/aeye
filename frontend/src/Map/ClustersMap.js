import {useEffect, useRef} from 'react';
import * as PIXI from "pixi.js";
import {useApp} from "@pixi/react";
import 'tailwindcss/tailwind.css'

const maxZoomLevel = 7;
const DURATION = 4; // seconds


export function fetchClusterData(zoom_level, tile_x, tile_y, dataset, host = "") {
    const url = `${host}/api/clusters?zoom_level=${zoom_level}&tile_x=${tile_x}&tile_y=${tile_y}&collection=${dataset}_zoom_levels_clusters`;
    return fetch(url,
        {
            method: 'GET',
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Cluster data could not be retrieved from the server.' +
                    ' Please try again later. Status: ' + response.status + ' ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            // Transform data["representatives"]["entities"] from an array of strings to an array of objects
            const entities = data["clusters_representatives"]["entities"];
            for (let i = 0; i < entities.length; i++) {
                entities[i] = JSON.parse(entities[i]);
            }
            return data;
        })
        .catch(error => {
            // Handle any errors that occur during the fetch operation
            console.error('Error:', error);
        });
}

function makeSpritePulse(sprite) {
    // Make the image pulse for 4 seconds
    const ticker = new PIXI.Ticker();
    const originalWidth = sprite.width;
    const originalHeight = sprite.height;
    const originalX = sprite.x;
    const originalY = sprite.y;
    const startTime = performance.now();

    ticker.add(() => {
        const now = performance.now();
        const elapsed = (now - startTime) / 1000; // convert to seconds

        if (elapsed > DURATION) {
            // Stop the ticker after 5 seconds
            ticker.stop();
        } else {
            // Calculate scale factor using a sine function
            const scaleFactor = 1 + Math.abs(Math.sin(elapsed / (0.2 * Math.PI)));

            // Calculate the difference in size before and after scaling
            const diffWidth = originalWidth * scaleFactor - originalWidth;
            const diffHeight = originalHeight * scaleFactor - originalHeight;
            // Adjust the x and y coordinates of the sprite by half of the difference in size
            sprite.x = originalX - diffWidth / 2;
            sprite.y = originalY - diffHeight / 2;
            // Increase size of sprite from the center
            sprite.width = originalWidth * scaleFactor;
            sprite.height = originalHeight * scaleFactor;
        }
    });
    ticker.start();
}


/**
 * The implementation is as follows:
 *     1. The stage is where we place our artworks. The visible area of the stage is from (0, 0) to (props.width, props.height),
 *        where props.width and props.height are the width and height of the viewport.
 *     2. The stage is fixed, but we keep a reference to the effective position of the stage within the real embedding space.
 *     3. The effective position of the stage determines the artworks that are visible. The data is fetched from the server.
 *        Using the stage allows as to have partially visible artworks.
 *     4. The stage can be "virtually" moved by the user. This means that the effective position of the stage changes,
 *        but the stage itself is fixed.
 *     5. From the server, we receive global coordinates for the artworks. The function mapGlobalCoordinatesToStageCoordinates
 *        maps the global coordinates to stage coordinates. This is just a translation of the global coordinates by the effective
 *        position of the stage.
 *     6. The user can also zoom in and out. When zooming in, what changes is the effective size of the stage. The effective
 *        position of the stage changes (see note *). When zooming out, the effective size of the stage increases, while it
 *        decreases when zooming in.
 *     7. At the beginning, we create a pool of sprites. The sprites are reused. Whe keep a map from index of artwork to sprite
 *        for fast access.
 *
 *     * Note: The mouse position in global coordinates must remain the same after zooming in/out. This means that the effective
 *       position of the stage must change, so that the mouse position in global coordinates remains the same. This is done
 *       simply by measuring the distance between the mouse position and the effective position of the stage before the
 *       zooming operation and then applying the same scaled translation after the zooming operation to obtain the new
 *       position of the upper left corner of the stage.
 *
 *     Observation: we re-render the stage manually through a call to app.render(). Hence, we do not use state or tickers
 *     to re-render the stage.
 * @param props
 * @returns {JSX.Element}
 * @constructor
 */
const ClustersMap = (props) => {
    // Define state for the effective position of the stage. The change of the effective position of the stage does not
    // necessary trigger a re-rendering of the stage.
    const effectivePosition = useRef({x: 0, y: 0});
    // Define effective size of the stage. This is the size of the stage in the embedding space.
    const effectiveWidth = useRef(0);
    const effectiveHeight = useRef(0);
    // Define state for the zoom level
    const zoomLevel = useRef(0);
    const depth = useRef(0);
    // Define state for the sprites. The sprites are reused. Whe keep a map from index of artwork to sprite for fast access.
    const sprites = useRef(new Map());
    // Define map for sprites global coordinates
    const spritesGlobalInfo = useRef(new Map());
    // Define sprite pool of available sprites
    const spritePool = useRef(new Array(800));
    // Define max width and height of a sprite. These values depend on the size of the viewport.
    const maxWidth = useRef(props.width / 10);
    const maxHeight = useRef(props.height / 10);
    // Define state for limits of embedding space. These values are initialized when the component is mounted and never change.
    const minX = useRef(0);
    const maxX = useRef(0);
    const minY = useRef(0);
    const maxY = useRef(0);
    // Define boolean for mouse down
    const mouseDown = useRef(false);
    // Define state for artworks in tiles
    const artworksInTiles = useRef(new Map());
    // Define width and height of the viewport

    // Define state for the app
    const app = useApp()
    // Create container for the stage
    const container = useRef(null);

    // Define constant for transition steps and depth steps
    const transitionSteps = 100;
    const depthStep = 0.02;

    const mapGlobalCoordinatesToStageCoordinates = (global_x, global_y) => {
        // Map global coordinates to stage coordinates
        const stage_x = ((global_x - effectivePosition.current.x) * (props.width - maxWidth.current)) / effectiveWidth.current;
        const stage_y = ((global_y - effectivePosition.current.y) * (props.height - maxHeight.current)) / effectiveHeight.current;
        return {
            x: stage_x,
            y: stage_y
        }
    }

    const mapStageCoordinatesToGlobalCoordinates = (stage_x, stage_y) => {
        // Map stage coordinates to global coordinates
        const global_x = (stage_x * effectiveWidth.current) / props.width;
        const global_y = (stage_y * effectiveHeight.current) / props.height;
        return {
            x: global_x + effectivePosition.current.x,
            y: global_y + effectivePosition.current.y
        }
    }


    const setSpriteOnPointerDown = (sprite, index) => {
        // Remove only the pointerdown event handler
        sprite.removeAllListeners('pointerdown');

        sprite.on('pointerdown', () => {
            props.setClickedImageIndex(index);
            props.setShowCarousel(true);
        });
    }


    const addSpriteToStage = (index, path, width, height, global_x, global_y, num_of_entities,
                              is_in_previous_zoom_level) => {
        // Get sprite from sprite pool
        const sprite = spritePool.current.pop();
        // Update sprite
        sprite.texture = PIXI.Texture.from(props.host + "/" + props.selectedDataset + "/resized_images/" + path);
        // Save global coordinates of the artwork
        spritesGlobalInfo.current.set(index, {
            x: global_x, y: global_y, width: width, height: height, path: path,
            num_of_entities: num_of_entities,
            is_in_previous_zoom_level: is_in_previous_zoom_level
        });

        // Get position of artwork in stage coordinates.
        const artwork_position = mapGlobalCoordinatesToStageCoordinates(global_x, global_y);
        // Set position of sprite
        sprite.x = artwork_position.x;
        sprite.y = artwork_position.y;

        // Scale up the sprite from 0 to the final size
        const aspect_ratio = width / height;
        if (width > height) {
            sprite.width = maxWidth.current;
            sprite.height = maxWidth.current / aspect_ratio;
        } else {
            sprite.height = maxHeight.current;
            sprite.width = maxHeight.current * aspect_ratio;
        }

        // Set alpha proportional to the depth
        if (is_in_previous_zoom_level || depth.current === 0) {
            sprite.alpha = 1;
            sprite.interactive = true;
        } else {
            // Set alpha proportional to the depth
            if (depth.current > 0)
                sprite.alpha = (1 - Math.cos(depth.current * Math.PI / 2)) ** 3;
            else
                sprite.alpha = (1 - Math.cos((1 + depth.current) * Math.PI / 2)) ** 3;
            sprite.interactive = false;
        }

        // Make sprite not visible if outside the stage
        /*sprite.visible = artwork_position.x >= -2*maxWidth.current
            && artwork_position.x <= props.width + 2*maxWidth.current
            && artwork_position.y >= -2*maxHeight.current
            && artwork_position.y <= props.height + 2*maxHeight.current;*/

        // On click, create rectangle with the sprite inside on the right and some text on the left. Make everything unclickable,
        // such that the user has to click on the rectangle to close it. The rectangle should be at the center of the screen,
        // and it should appear smoothly on click on the sprite.
        sprite.cursor = 'pointer';
        setSpriteOnPointerDown(sprite, index);

        sprite.on('mouseover', () => {
            // Put image in front
            sprite.zIndex = 10;
            // Sort children
            container.current.sortChildren();
            // Calculate the difference in size before and after scaling
            const diffWidth = sprite.width * 0.2;
            const diffHeight = sprite.height * 0.2;
            // Adjust the x and y coordinates of the sprite by half of the difference in size
            sprite.x -= diffWidth / 2;
            sprite.y -= diffHeight / 2;
            // Increase size of sprite from the center
            sprite.width += diffWidth;
            sprite.height += diffHeight;
        });

        sprite.on('mouseout', () => {
            // Calculate the difference in size before and after scaling
            const diffWidth = sprite.width * 0.2;
            const diffHeight = sprite.height * 0.2;
            // Adjust the x and y coordinates of the sprite by half of the difference in size
            sprite.x += diffWidth / 2;
            sprite.y += diffHeight / 2;
            // Decrease size of sprite
            sprite.width -= diffWidth;
            sprite.height -= diffHeight;
            // Put image back in place
            sprite.zIndex = 0;
        });

        // Add sprite to sprites
        sprites.current.set(index, sprite);
        // Add sprite to stage
        container.current.addChild(sprite);
    }

    const reset = () => {
        // Reset everything at the initial state
        // Reset zoom level
        zoomLevel.current = 0;
        depth.current = 0;
        // Move all sprites back to the sprite pool
        for (let index of sprites.current.keys()) {
            let sprite = sprites.current.get(index);
            // Complete reset of sprite
            sprite.removeAllListeners();
            // Remove sprite from stage
            container.current.removeChild(sprite);
            // Add sprite back to sprite pool
            spritePool.current.push(sprites.current.get(index));
        }
        // Reset sprites global info
        spritesGlobalInfo.current.clear();
        // Reset artworks in tiles
        artworksInTiles.current.clear();
        // Make sure spritePool contains 800 sprites
        console.assert(spritePool.current.length === 800);
    }

    // Create useEffect for initialization of the component. This is called every time the selected dataset changes.
    useEffect(() => {
        // Reset everything at the initial state
        reset()

        // Create container for the stage
        if (!container.current) {
            // Create container
            container.current = new PIXI.Container();
            app.stage.addChild(container.current);
        }

        // Define container pointer
        container.current.cursor = 'grab';

        // Add handlers to stage
        container.current.hitArea = new PIXI.Rectangle(0, 0, props.width, props.height);
        container.current.interactive = true;
        container.sortableChildren = true;
        container.current
            .on('pointerdown', handleMouseDown)
            .on('pointerup', handleMouseUp)
            .on('pointermove', handleMouseMove)
            .on('wheel', handleMouseWheel);

        // Fetch cluster data from the server
        fetchClusterData(zoomLevel.current, 0, 0, props.selectedDataset, props.host)
            .then(data => {
                // Update the limits of the embedding space
                minX.current = data["tile_coordinate_range"]["x_min"];
                maxX.current = data["tile_coordinate_range"]["x_max"];
                minY.current = data["tile_coordinate_range"]["y_min"];
                maxY.current = data["tile_coordinate_range"]["y_max"];

                // Update the effective position of the stage
                effectivePosition.current.x = minX.current;
                effectivePosition.current.y = minY.current;

                // Update effective size of the stage
                effectiveWidth.current = maxX.current - minX.current;
                effectiveHeight.current = maxY.current - minY.current;

                // Populate the sprite pool
                for (let i = 0; i < spritePool.current.length; i++) {
                    spritePool.current[i] = new PIXI.Sprite();
                }

                // Loop over artworks in tile and add them to the stage. Take the sprites from the sprite pool.
                // noinspection JSUnresolvedVariable
                for (let i = 0; i < data["clusters_representatives"]["entities"].length; i++) {
                    // Add sprite to stage
                    addSpriteToStage(
                        data["clusters_representatives"]["entities"][i]["representative"]["index"],
                        data["clusters_representatives"]["entities"][i]["representative"]["path"],
                        data["clusters_representatives"]["entities"][i]["representative"]["width"],
                        data["clusters_representatives"]["entities"][i]["representative"]["height"],
                        data["clusters_representatives"]["entities"][i]["representative"]["low_dimensional_embedding_x"],
                        data["clusters_representatives"]["entities"][i]["representative"]["low_dimensional_embedding_y"],
                        data["clusters_representatives"]["entities"][i]["number_of_entities"],
                        true
                    );
                }
                // Save artworks in tiles
                // noinspection JSUnresolvedVariable
                artworksInTiles.current.set(zoomLevel.current + "-0-0",
                    data["clusters_representatives"]["entities"].map(entity => entity["representative"]["index"]));
            })
            .catch(error => {
                // Handle any errors that occur during the fetch operation
                console.error('Error:', error);
            });
    }, [props.selectedDataset]);

    useEffect(() => {
        // Resize container and set hit area
        container.current.hitArea = new PIXI.Rectangle(0, 0, props.width, props.height);

        // Update max width and height of a sprite and update all sprites
        maxWidth.current = props.width / 10;
        maxHeight.current = props.height / 10;

        for (let index of sprites.current.keys()) {
            // Get position of artwork in stage coordinates.
            const artwork_position = mapGlobalCoordinatesToStageCoordinates(
                spritesGlobalInfo.current.get(index).x,
                spritesGlobalInfo.current.get(index).y
            );
            // Set position of sprite
            sprites.current.get(index).x = artwork_position.x;
            sprites.current.get(index).y = artwork_position.y;

            // Update size of sprite
            const width = spritesGlobalInfo.current.get(index).width;
            const height = spritesGlobalInfo.current.get(index).height;
            const aspect_ratio = width / height;
            if (width > height) {
                sprites.current.get(index).width = maxWidth.current;
                sprites.current.get(index).height = maxWidth.current / aspect_ratio;
            } else {
                sprites.current.get(index).height = maxHeight.current;
                sprites.current.get(index).width = maxHeight.current * aspect_ratio;
            }
            // Update set sprite on pointer down
            setSpriteOnPointerDown(sprites.current.get(index), spritesGlobalInfo.current.get(index).index);
        }
    }, [props.width, props.height]);

    useEffect(() => {
        // This effect is called when the search data changes. This means that the user has searched something using the
        // search bar.
        if (Object.keys(props.searchData).length !== 0) {
            moveToImage(props.searchData.tile, props.searchData.image);
        }
    }, [props.searchData]);

    const updateStage = () => {
        // Get tile coordinates of the visible tiles. The number of tiles is not computed on the current zoom level, but
        // on Math.ceil(zoomLevel.current + depth.current). This is because we want to fetch data for the next zoom level
        // when the user is zooming in, and for the current zoom level when the user is zooming out.
        const effective_zoom_level = Math.ceil(zoomLevel.current + depth.current);

        const number_of_tiles = 2 ** effective_zoom_level;
        const tile_step_x = (maxX.current - minX.current) / number_of_tiles;
        const tile_step_y = (maxY.current - minY.current) / number_of_tiles;
        // Get all tiles that are visible. We can have at most 4 tiles that are visible.
        const visible_tiles = [];
        // Get tile coordinates of the tile that contains the upper left corner of the stage.
        const tile_x = Math.min(Math.floor((effectivePosition.current.x - minX.current) / tile_step_x), number_of_tiles - 1);
        const tile_y = Math.min(Math.floor((effectivePosition.current.y - minY.current) / tile_step_y), number_of_tiles - 1);
        visible_tiles.push({x: tile_x, y: tile_y});
        // Get all neighboring tiles. This means all tiles at a distance of 1, plus tiles at a distance of 2 on the bottom
        // and on the right.
        if (tile_x > 0) {
            visible_tiles.push({x: tile_x - 1, y: tile_y});
            if (tile_y > 0) {
                visible_tiles.push({x: tile_x - 1, y: tile_y - 1});
            }
            if (tile_y < number_of_tiles - 1) {
                visible_tiles.push({x: tile_x - 1, y: tile_y + 1});
            }
        }
        if (tile_x < number_of_tiles - 1) {
            visible_tiles.push({x: tile_x + 1, y: tile_y});
            if (tile_y > 0) {
                visible_tiles.push({x: tile_x + 1, y: tile_y - 1});
            }
            if (tile_y < number_of_tiles - 1) {
                visible_tiles.push({x: tile_x + 1, y: tile_y + 1});
            }
        }
        if (tile_x < number_of_tiles - 2) {
            visible_tiles.push({x: tile_x + 2, y: tile_y});
            if (tile_y < number_of_tiles - 1) {
                visible_tiles.push({x: tile_x + 2, y: tile_y + 1});
            }
            if (tile_y < number_of_tiles - 2) {
                visible_tiles.push({x: tile_x + 2, y: tile_y + 2});
            }
        }
        if (tile_y < number_of_tiles - 2) {
            visible_tiles.push({x: tile_x, y: tile_y + 2});
            if (tile_x < number_of_tiles - 1) {
                visible_tiles.push({x: tile_x + 1, y: tile_y + 2});
            }
        }
        if (tile_y > 0) {
            visible_tiles.push({x: tile_x, y: tile_y - 1});
        }
        if (tile_y < number_of_tiles - 1) {
            visible_tiles.push({x: tile_x, y: tile_y + 1});
        }

        // Remove tiles and sprites of tiles that are not visible
        for (let tile of artworksInTiles.current.keys()) {
            // If the tile is from the previous zoom level, delete the entry from artworksInTiles but do not delete all
            // the sprites. This is because some of the sprites might still be visible.
            if (effective_zoom_level === parseInt(tile.split("-")[0]) + 1) {
                for (let index of artworksInTiles.current.get(tile)) {
                    // Check the tile the sprite is in. If the sprite is not among the tiles in visible_tiles, then
                    // remove it, else set is_in_previous_zoom_level to true.
                    const spriteGlobalPosition = spritesGlobalInfo.current.get(index);
                    const tile_x = Math.min(Math.floor((spriteGlobalPosition.x - minX.current) / tile_step_x), number_of_tiles - 1);
                    const tile_y = Math.min(Math.floor((spriteGlobalPosition.y - minY.current) / tile_step_y), number_of_tiles - 1);
                    if (!visible_tiles.some(visible_tile =>
                        visible_tile.x === tile_x && visible_tile.y === tile_y)) {
                        // Remove every event handler from sprite
                        sprites.current.get(index).removeAllListeners();
                        // Remove sprite from stage
                        container.current.removeChild(sprites.current.get(index));
                        // Add sprite back to sprite pool
                        spritePool.current.push(sprites.current.get(index));
                        // Remove sprite from sprites
                        sprites.current.delete(index);
                        // Remove sprite from spritesGlobalInfo
                        spritesGlobalInfo.current.delete(index);
                    } else {
                        // Set is_in_previous_zoom_level to true
                        spritesGlobalInfo.current.get(index).is_in_previous_zoom_level = true;
                    }
                }
                // Delete tile from artworksInTiles
                artworksInTiles.current.delete(tile);
            }
            else if (!(effective_zoom_level === parseInt(tile.split("-")[0])) || !visible_tiles.some(visible_tile =>
                visible_tile.x === parseInt(tile.split("-")[1]) && visible_tile.y === parseInt(tile.split("-")[2]))) {

                // Deal with case where the zoom level of the tile is equal to the current zoom level - 1. In this case,
                // the sprites that are still visible


                // The tile is not among the visible ones.
                for (let index of artworksInTiles.current.get(tile)) {
                    if (sprites.current.has(index)) {
                        // Remove every event handler from sprite
                        sprites.current.get(index).removeAllListeners();
                        // Remove sprite from stage
                        container.current.removeChild(sprites.current.get(index));
                        // Add sprite back to sprite pool
                        spritePool.current.push(sprites.current.get(index));
                        // Remove sprite from sprites
                        sprites.current.delete(index);
                        // Remove sprite from spritesGlobalInfo
                        spritesGlobalInfo.current.delete(index);
                    }
                }
                // Delete tile from artworksInTiles
                artworksInTiles.current.delete(tile);
            }
        }

        // Change position of all sprites that are on stage
        for (let index of sprites.current.keys()) {
            // Get position of artwork in stage coordinates.
            const artwork_position = mapGlobalCoordinatesToStageCoordinates(
                spritesGlobalInfo.current.get(index).x,
                spritesGlobalInfo.current.get(index).y
            );
            // Make sprite not visible if outside the stage
            /*sprites.current.get(index).visible = artwork_position.x >= -2*maxWidth.current
                && artwork_position.x <= props.width + 2*maxWidth.current
                && artwork_position.y >= -2*maxHeight.current
                && artwork_position.y <= props.height + 2*maxHeight.current;*/

            // Update position of sprite
            sprites.current.get(index).x = artwork_position.x;
            sprites.current.get(index).y = artwork_position.y;

            // Set alpha of sprite
            if (spritesGlobalInfo.current.get(index).is_in_previous_zoom_level || depth.current === 0) {
                sprites.current.get(index).alpha = 1;
                // Activate sprite's event handlers
                sprites.current.get(index).interactive = true;
            } else {
                // Set alpha proportional to the depth
                if (depth.current > 0)
                    sprites.current.get(index).alpha = (1 - Math.cos(depth.current * Math.PI / 2)) ** 3;
                else
                    sprites.current.get(index).alpha = (1 - Math.cos((1 + depth.current) * Math.PI / 2)) ** 3;
                // Deactivate sprite's event handlers
                sprites.current.get(index).interactive = false;
            }
        }

        // Fetch data for the visible tiles
        visible_tiles.map(tile => {
            // If tile is in artworksInTiles, then we do not need to fetch data for it.
            if (!artworksInTiles.current.has(effective_zoom_level + "-" + tile.x + "-" + tile.y)) {
                // The tile is not in artworksInTiles. We need to fetch data for it.
                fetchClusterData(effective_zoom_level, tile.x, tile.y, props.selectedDataset, props.host)
                    .then(data => {
                        // Loop over artworks in tile and add them to the stage.
                        // noinspection JSUnresolvedVariable
                        for (let j = 0; j < data["clusters_representatives"]["entities"].length; j++) {
                            // Check if the artwork is already on stage. If it is not, add it to the stage.
                            if (!sprites.current.has(data["clusters_representatives"]["entities"][j]["representative"]["index"])) {
                                // Add sprite to stage
                                addSpriteToStage(
                                    data["clusters_representatives"]["entities"][j]["representative"]["index"],
                                    data["clusters_representatives"]["entities"][j]["representative"]["path"],
                                    data["clusters_representatives"]["entities"][j]["representative"]["width"],
                                    data["clusters_representatives"]["entities"][j]["representative"]["height"],
                                    data["clusters_representatives"]["entities"][j]["representative"]["low_dimensional_embedding_x"],
                                    data["clusters_representatives"]["entities"][j]["representative"]["low_dimensional_embedding_y"],
                                    data["clusters_representatives"]["entities"][j]["number_of_entities"],
                                    data["clusters_representatives"]["entities"][j]["is_in_previous_zoom_level"]
                                );
                            }
                        }
                        // Save artworks in tiles
                        // noinspection JSUnresolvedVariable
                        artworksInTiles.current.set(effective_zoom_level + "-" + tile.x + "-" + tile.y,
                            data["clusters_representatives"]["entities"].map(entity => entity["representative"]["index"]));
                    })
                    .catch(error => {
                        // Handle any errors that occur during the fetch operation
                        console.error('Error:', error);
                    });
            }
        });

        // Do asserts to check that everything is correct
        console.assert(sprites.current.size === spritesGlobalInfo.current.size);
        console.assert(sprites.current.size + spritePool.current.length === 800);
        console.assert(artworksInTiles.current.size <= 14);
    }

    // Create function for handling click on image or search
    const moveToImage = async (tile, image) => {
        // 1. Transition to the new location in the embedding space without changing the zoom level.

        // Compute translation such that at the end of the translation the tile is perfectly centered. The translation is
        // computed in global coordinates.
        let final_effective_position_x = image.x - effectiveWidth.current / 2;
        let final_effective_position_y = image.y - effectiveHeight.current / 2;

        // Make sure the final position is within the limits of the embedding space
        final_effective_position_x = Math.max(Math.min(final_effective_position_x, maxX.current - effectiveWidth.current), minX.current);
        final_effective_position_y = Math.max(Math.min(final_effective_position_y, maxY.current - effectiveHeight.current), minY.current);

        // Define steps
        const step_x = (final_effective_position_x - effectivePosition.current.x) / transitionSteps;
        const step_y = (final_effective_position_y - effectivePosition.current.y) / transitionSteps;

        function awaitTranslationTicker() {
            return new Promise((resolve) => {
                const translation_ticker = new PIXI.Ticker();

                translation_ticker.add(() => {
                    // Check if position is super close to the target position
                    if (effectivePosition.current.x === final_effective_position_x
                        && effectivePosition.current.y === final_effective_position_y) {
                        console.log("Translation ticker stopped");
                        // Stop ticker
                        translation_ticker.stop();
                        resolve();
                    } else {
                        effectivePosition.current.x += step_x;
                        effectivePosition.current.y += step_y;
                        // Check if we have gone too far. If so, set the position to the target position.
                        if (Math.sign(step_x) === Math.sign(effectivePosition.current.x - final_effective_position_x)
                            && Math.sign(step_y) === Math.sign(effectivePosition.current.y - final_effective_position_y)) {
                            effectivePosition.current.x = final_effective_position_x;
                            effectivePosition.current.y = final_effective_position_y;
                        }
                        // Update stage
                        updateStage();
                    }
                });

                translation_ticker.start();
            });
        }
        // Wait for translation ticker to finish
        await awaitTranslationTicker();

        function awaitZoomTicker() {
            return new Promise((resolve) => {
                const zoom_ticker = new PIXI.Ticker();

                zoom_ticker.add(() => {
                    if (zoomLevel.current === tile[0] && depth.current === 0) {
                        // Stop ticker
                        console.log("Zoom ticker stopped");
                        zoom_ticker.stop();
                        resolve();
                    }
                    else {
                        // Change depth by 0.05. If the depth is -1 or 1, then change zoom level by 1 and reset depth sum or
                        // subtract 1 from delta.
                        let delta;
                        if (zoomLevel.current !== tile[0]) {
                            delta = Math.sign(tile[0] - zoomLevel.current) * depthStep;
                        } else {
                            delta = -Math.sign(depth.current) * depthStep; // If depth is greater than 0, then we have to reduce
                            // depth by 0.05, hence we have to subtract 0.05 from delta. If depth is smaller than 0, then we have
                            // to increase depth by 0.05, hence we have to add 0.05 to delta.
                        }

                        // Update depth
                        depth.current = Math.min(Math.max(depth.current + delta, -1), 1);

                        const position = {
                            x: image.x,
                            y: image.y
                        }

                        // First, compute the new effective position and effective size of the stage.
                        // Get translation of the mouse position from the upper left corner of the stage in global coordinates
                        const translation_x = position.x - effectivePosition.current.x
                        const translation_y = position.y - effectivePosition.current.y;
                        // Change the effective size of the stage.
                        effectiveWidth.current = (maxX.current - minX.current) / (2 ** (zoomLevel.current + depth.current));
                        effectiveHeight.current = (maxY.current - minY.current) / (2 ** (zoomLevel.current + depth.current));

                        // Change the effective position of the stage. Make sure that it does not exceed the limits of the embedding space.
                        // The translation of the mouse is adjusted so that the mouse position in global coordinates remains the same.
                        effectivePosition.current.x = Math.max(
                            Math.min(position.x - translation_x * 2 ** (-delta), maxX.current -
                                effectiveWidth.current), minX.current);
                        effectivePosition.current.y = Math.max(
                            Math.min(position.y - translation_y * 2 ** (-delta), maxY.current -
                                effectiveHeight.current), minY.current);

                        // Check if we have reached a new zoom level. If so, update zoom level and reset depth.
                        if (Math.abs(depth.current) === 1) {
                            // Change zoom level
                            zoomLevel.current += Math.sign(depth.current);
                            // Reset depth
                            depth.current = 0;
                        }

                        // Update stage
                        updateStage();
                    }
                });
                zoom_ticker.start();
            });
        }
        // Wait for zoom ticker to finish
        await awaitZoomTicker();

        // TODO problem with getting sprite when transitioning back because the sprites are removed and added again, hence the sprite could not be available here

/*        // Get sprite for the image and put it in the foreground
        const sprite = sprites.current.get(image.index);
        sprite.zIndex = 30;
        // Sort children
        container.current.sortChildren();
        // Make sprite pulse
        makeSpritePulse(sprite);*/
    }

    // Create handler for mouse down
    const handleMouseDown = () => {
        // Set mouse down to true
        container.current.cursor = 'grabbing';
        mouseDown.current = true;
    }

    // Create handler for mouse up
    const handleMouseUp = () => {
        // Set mouse down to false
        container.current.cursor = 'grab';
        mouseDown.current = false;
    }

    // Create handler for mouse move
    const handleMouseMove = (event) => {
        // If mouse is down, then move the stage
        if (mouseDown.current) {
            // Get mouse position. Transform movement of the mouse to movement in the embedding space.
            const mouse_x = ((-event.movementX) * effectiveWidth.current) / props.width;
            const mouse_y = ((-event.movementY) * effectiveHeight.current) / props.height;
            // Change the effective position of the stage. Make sure that it does not exceed the limits of the embedding space.
            const new_x = Math.max(
                Math.min(effectivePosition.current.x + mouse_x, maxX.current - effectiveWidth.current), minX.current);
            const new_y = Math.max(
                Math.min(effectivePosition.current.y + mouse_y, maxY.current - effectiveHeight.current), minY.current);

            // Update the effective position of the stage
            effectivePosition.current.x = new_x;
            effectivePosition.current.y = new_y;

            // Update the data that is displayed on the stage. This consists of finding out the tiles that are visible,
            // fetching the data from the server and putting on stage the sprites that are visible.
            updateStage();
        }
    }

    const testContains = (sprite, mouse_position) => {
        return mouse_position.x >= sprite.x && mouse_position.x <= sprite.x + sprite.width
            && mouse_position.y >= sprite.y && mouse_position.y <= sprite.y + sprite.height;
    }

    // Method for finding which image is under the mouse
    const getGlobalCoordinatesOfSpriteUnderMouse = (mouse_position) => {
        let coordinates_to_return = null;
        let z_index = -100;
        // Iterate over all sprites in the container
        for (let index of sprites.current.keys()) {
            // Check if mouse is over the sprite
            if (testContains(sprites.current.get(index), mouse_position)) {
                // Mouse is over the sprite
                // If the z index of the sprite is higher than the z index of the previous sprite, then update the sprite
                // and the z index
                if (sprites.current.get(index).zIndex > z_index) {
                    z_index = sprites.current.get(index).zIndex;
                    // Get global coordinates of sprite from spritesGlobalInfo
                    const info = spritesGlobalInfo.current.get(index);
                    coordinates_to_return = {
                        x: info.x,
                        y: info.y,
                        width: info.width,
                        height: info.height
                    }
                }
            }
        }
        return coordinates_to_return;
    };

    // Create handler for mouse wheel. We change the zoom level only if the user scrolls until a certain value of change in
    // depth is reached. This is to avoid changing the zoom level too often. We use a transition which depends on the percentage
    // of the change in depth in order to make the transition smoother. When the new zoom level is reached, we update
    // everything on the stage.
    const handleMouseWheel = (event) => {
        // Get DOM element and remove default behavior
        // Define delta
        let delta = event.deltaY / 1000;
        // Deal with border cases
        if (zoomLevel.current === maxZoomLevel && depth.current + delta > 0) {
            // Keep depth at 0
            depth.current = 0;
            return;
        } else if (zoomLevel.current === 0 && depth.current + delta < 0) {
            // Keep depth at 0
            depth.current = 0;
            return;
        }

        // Update depth
        const new_depth = Math.min(Math.max(depth.current + delta, -1), 1);
        // Update delta
        delta = new_depth - depth.current;
        depth.current = new_depth;

        // Get mouse position with respect to container
        const position = event.data.getLocalPosition(container.current);
        // Get sprite under mouse
        const global_coordinates_sprite_under_mouse = getGlobalCoordinatesOfSpriteUnderMouse(position);

        // Fix zoom on top left corner of the sprite under the mouse
        let global_mouse_position;
        if (global_coordinates_sprite_under_mouse == null)
            global_mouse_position = mapStageCoordinatesToGlobalCoordinates(position.x, position.y);
        else {
            global_mouse_position = {
                x: global_coordinates_sprite_under_mouse.x,
                y: global_coordinates_sprite_under_mouse.y
            }
        }

        // Change measures after zooming in/out

        // When |depth| < 1, we are in an intermediate state between zoom levels, but the data shown always belongs to
        // the finer grained zoom level. Hence, as soon as delta becomes bigger than 0, get the data from the next
        // zoom level. If on the other hand delta becomes smaller than 0, keep current data and start transitioning to
        // the next zoom level.
        // Observation: the position of the mouse in global coordinates must remain the same after zooming in/out.

        // First, compute the new effective position and effective size of the stage.
        // Get translation of the mouse position from the upper left corner of the stage in global coordinates
        const translation_x = global_mouse_position.x - effectivePosition.current.x
        const translation_y = global_mouse_position.y - effectivePosition.current.y;
        // Change the effective size of the stage.
        effectiveWidth.current = (maxX.current - minX.current) / (2 ** (zoomLevel.current + depth.current));
        effectiveHeight.current = (maxY.current - minY.current) / (2 ** (zoomLevel.current + depth.current));

        // Change the effective position of the stage. Make sure that it does not exceed the limits of the embedding space.
        // The translation of the mouse is adjusted so that the mouse position in global coordinates remains the same.
        effectivePosition.current.x = Math.max(
            Math.min(global_mouse_position.x - translation_x * 2 ** (-delta), maxX.current -
                effectiveWidth.current), minX.current);
        effectivePosition.current.y = Math.max(
            Math.min(global_mouse_position.y - translation_y * 2 ** (-delta), maxY.current -
                effectiveHeight.current), minY.current);

        // Check if we have reached a new zoom level. If so, update zoom level and reset depth.
        if (Math.abs(depth.current) === 1) {
            // Change zoom level
            zoomLevel.current += Math.sign(depth.current);
            // Make sure the zoom level is within the limits
            zoomLevel.current = Math.min(Math.max(zoomLevel.current, 0), maxZoomLevel);
            // Reset depth
            depth.current = 0;
        }

        // Update stage
        updateStage();
    }


    return (
        <></>
    );
}


export default ClustersMap;