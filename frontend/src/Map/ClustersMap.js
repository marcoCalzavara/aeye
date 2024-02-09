import {useEffect, useRef} from 'react';
import * as PIXI from "pixi.js";
import {BlurFilter} from "pixi.js";
import Hammer from "hammerjs";
import {useApp} from "@pixi/react";
import {LRUCache} from "lru-cache";
import 'tailwindcss/tailwind.css';
import {getTilesToFetchCurrentZoomLevel} from "./utilities";
import {getUrlForImage} from "../utilities";

const DURATION = 4; // seconds

// function getUrlForClusterData(zoom_level, tile_x, tile_y, dataset, host = "") {
//     return `${host}/api/clusters?zoom_level=${zoom_level}&tile_x=${tile_x}&tile_y=${tile_y}&collection=${dataset}_zoom_levels_clusters`;
// }

function getUrlForFirst7ZoomLevels(dataset, host = "") {
    return `${host}/api/first_7_zoom_levels?collection=${dataset}_zoom_levels_clusters`;
}

export function fetchClusterData(url) {
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

/**
 * The function fetches the first 7 zoom levels in one unique batch at the beginning of the execution of the application.
 * @param url
 * @param signal
 * @param tilesCache The tiles cache is used to fetch the tiles. The tiles cache is an LRU cache.
 * @returns {Promise<unknown>}
 */
export function fetchFirst7ZoomLevels(url, signal, tilesCache) {
    return fetch(url, {
            method: 'GET'
        }
    )
        .then(response => {
            if (!response.ok) {
                throw new Error('Cluster data could not be retrieved from the server.' +
                    ' Please try again later. Status: ' + response.status + ' ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            // Save data in the cache. Use the triple of zoom level, tile x and tile y as key.
            // noinspection JSUnresolvedVariable
            for (let tile of data) {
                // Transform data["representatives"]["entities"] from an array of strings to an array of objects
                for (let i = 0; i < tile["clusters_representatives"]["entities"].length; i++) {
                    tile["clusters_representatives"]["entities"][i] = JSON.parse(tile["clusters_representatives"]["entities"][i]);
                }
                tilesCache.set(tile["zoom_plus_tile"][0] + "-" + tile["zoom_plus_tile"][1] + "-" + tile["zoom_plus_tile"][2], tile);
            }
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
            // Decrease z-index of sprite
            sprite.zIndex = 0;
            // Stop the ticker after 5 seconds
            ticker.stop();
        } else {
            // Calculate scale factor using a sine function
            const scaleFactor = 1 + 0.5 * Math.abs(Math.sin(elapsed / (0.2 * Math.PI)));

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

function throttle(func, limit) {
    // Throttle function. The function func is called at most once every limit milliseconds.
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
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
 *     Observation: we re-render the stage manually through a call to app1.render(). Hence, we do not use state or tickers
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
    // Define state for tiles which are currently on stage
    const tilesOnStage = useRef(new Map());
    // Define least recently used cache for tiles. Use fetchTileData to fetch tiles.
    const tilesCache = useRef(new LRUCache({
        max: 25000, // This is more or less 25MB
        fetchMethod: fetchClusterData,
    }));

    // Define state for the app1
    const app = useApp()
    // Create container for the stage
    const container = useRef(null);
    // Define hammer
    const hammer = useRef(null);
    // Define state for previous scale for pinching
    const previousScale = useRef(1);
    // Define constant for transition steps and depth steps
    const initial_transition_step = 100;
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

    const addSpriteToStage = (index, path, width, height, global_x, global_y, num_of_entities,
                              is_in_previous_zoom_level) => {
        // Get sprite from sprite pool
        const sprite = spritePool.current.pop();

        // Scale up the sprite from 0 to the final size
        const aspect_ratio = width / height;
        if (width > height) {
            sprite.width = maxWidth.current;
            sprite.height = maxWidth.current / aspect_ratio;
        } else {
            sprite.height = maxHeight.current;
            sprite.width = maxHeight.current * aspect_ratio;
        }

        let graphics = new PIXI.Graphics();
        graphics.beginFill(0x404040);
        graphics.drawRect(0, 0, sprite.width, sprite.height);
        graphics.endFill();

        // Set texture of sprite
        // First, set it to a gray texture, then set it to the actual texture. This is done to give the user the
        // impression that there is something happening in the background.
        // noinspection all
        sprite.texture = app.renderer.generateTexture(graphics);
        // Set as interactive
        sprite.interactive = true;
        sprite.cursor = "pointer";
        sprite.interactiveChildren = true;
        // Set main texture
        sprite.texture = PIXI.Texture.from(getUrlForImage(path, props.selectedDataset, props.host));

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

        // Set alpha proportional to the depth
        if (is_in_previous_zoom_level || depth.current === 0) {
            sprite.alpha = 1;
        } else {
            // Set alpha proportional to the depth
            if (depth.current > 0)
                sprite.alpha = (1 - Math.cos(depth.current * Math.PI / 2)) ** 3;
            else
                sprite.alpha = (1 - Math.cos((1 + depth.current) * Math.PI / 2)) ** 3;
        }

        // Make sprite interactive if the values of alpha is bigger than 0.2
        sprite.interactive = sprite.alpha > 0.2;

        // Make sprite not visible if outside the stage
        /*sprite.visible = artwork_position.x >= -2*maxWidth.current
            && artwork_position.x <= props.width + 2*maxWidth.current
            && artwork_position.y >= -2*maxHeight.current
            && artwork_position.y <= props.height + 2*maxHeight.current;*/

        // On click, create rectangle with the sprite inside on the right and some text on the left. Make everything unclickable,
        // such that the user has to click on the rectangle to close it. The rectangle should be at the center of the screen,
        // and it should appear smoothly on click on the sprite.
        // Remove all pointer down listeners
        sprite.removeAllListeners();

        sprite.on('pointerdown', () => {
            props.prevClickedImageIndex.current = props.clickedImageIndex;
            props.setClickedImageIndex(index);
            props.setShowCarousel(true);
            props.setMenuOpen(false);
        });

        sprite.on('pointerenter', () => {
            // Deactivate blur filter if present
            if (sprite.filters !== null && sprite.filters.length > 0) {
                sprite.filters[0].enabled = false;
            }
        });

        sprite.on('pointerleave', () => {
            // Reactivate blur filter if present
            if (sprite.filters !== null && sprite.filters.length > 0) {
                sprite.filters[0].enabled = true;
            }
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
        // Reset tiles on stage
        tilesOnStage.current.clear();
        // Clear tiles cache
        tilesCache.current.clear();
        // Make sure spritePool contains 800 sprites
        console.assert(spritePool.current.length === 800);
    }

    // Create useEffect for initialization of the component. This is called every time the selected dataset changes.
    useEffect(() => {
        // Reset everything at the initial state
        reset();

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

        // Create hammer. Bind it to the gesture area.
        // noinspection all
        hammer.current = new Hammer(app.view);
        // Disable all gestures except pinch
        hammer.current.get('pan').set({enable: false});
        hammer.current.get('swipe').set({enable: false});
        hammer.current.get('tap').set({enable: false});
        hammer.current.get('press').set({enable: false});
        hammer.current.get('rotate').set({enable: false});
        hammer.current.get('pinch').set({enable: true});
        hammer.current.on('pinchstart', handlePinchStart);
        hammer.current.on('pinch', handlePinch);

        // // Get tile coordinates of tiles at the next zoom level.
        // const tiles_level_1 = [];
        // for (let i = 0; i < 2; i++) {
        //     for (let j = 0; j < 2; j++) {
        //         tiles_level_1.push({x: i, y: j});
        //     }
        // }

        // Populate the sprite pool
        for (let i = 0; i < spritePool.current.length; i++) {
            spritePool.current[i] = new PIXI.Sprite();
        }

        // Fetch first 7 zoom levels
        fetchFirst7ZoomLevels(getUrlForFirst7ZoomLevels(props.selectedDataset, props.host), null, tilesCache.current)
            .then(() => {
                // Get cluster data for the first zoom level
                const data = tilesCache.current.get(0 + "-" + 0 + "-" + 0)
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
                tilesOnStage.current.set(zoomLevel.current + "-0-0",
                    data["clusters_representatives"]["entities"].map(entity => entity["representative"]["index"]));
            }).then(() => {
            props.setInitialLoadingDone(true);
        });

        // // Fetch cluster data from the server
        // tilesCache.current.fetch(getUrlForClusterData(0, 0, 0, props.selectedDataset, props.host))
        //     .then(data => {
        //         // Update the limits of the embedding space
        //         minX.current = data["tile_coordinate_range"]["x_min"];
        //         maxX.current = data["tile_coordinate_range"]["x_max"];
        //         minY.current = data["tile_coordinate_range"]["y_min"];
        //         maxY.current = data["tile_coordinate_range"]["y_max"];
        //
        //         // Update the effective position of the stage
        //         effectivePosition.current.x = minX.current;
        //         effectivePosition.current.y = minY.current;
        //
        //         // Update effective size of the stage
        //         effectiveWidth.current = maxX.current - minX.current;
        //         effectiveHeight.current = maxY.current - minY.current;
        //
        //         // Populate the sprite pool
        //         for (let i = 0; i < spritePool.current.length; i++) {
        //             spritePool.current[i] = new PIXI.Sprite();
        //         }
        //
        //         // Loop over artworks in tile and add them to the stage. Take the sprites from the sprite pool.
        //         // noinspection JSUnresolvedVariable
        //         for (let i = 0; i < data["clusters_representatives"]["entities"].length; i++) {
        //             // Add sprite to stage
        //             addSpriteToStage(
        //                 data["clusters_representatives"]["entities"][i]["representative"]["index"],
        //                 data["clusters_representatives"]["entities"][i]["representative"]["path"],
        //                 data["clusters_representatives"]["entities"][i]["representative"]["width"],
        //                 data["clusters_representatives"]["entities"][i]["representative"]["height"],
        //                 data["clusters_representatives"]["entities"][i]["representative"]["low_dimensional_embedding_x"],
        //                 data["clusters_representatives"]["entities"][i]["representative"]["low_dimensional_embedding_y"],
        //                 data["clusters_representatives"]["entities"][i]["number_of_entities"],
        //                 true
        //             );
        //         }
        //         // Save artworks in tiles
        //         // noinspection JSUnresolvedVariable
        //         tilesOnStage.current.set(zoomLevel.current + "-0-0",
        //             data["clusters_representatives"]["entities"].map(entity => entity["representative"]["index"]));
        //     })
        //     .catch(error => {
        //         // Handle any errors that occur during the fetch operation
        //         console.error('Error:', error);
        //     });
        //
        // // Fetch data for the next zoom level
        // tiles_level_1.map(tile => {
        //     // noinspection JSIgnoredPromiseFromCall
        //     tilesCache.current.fetch(getUrlForClusterData(1, tile.x, tile.y, props.selectedDataset, props.host))
        // });
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
            // Remove pointer down listener
            sprites.current.get(index).removeListener('pointerdown');
            sprites.current.get(index).on('pointerdown', () => {
                props.prevClickedImageIndex.current = props.clickedImageIndex;
                props.setClickedImageIndex(spritesGlobalInfo.current.get(index).index);
                props.setShowCarousel(true);
                props.setMenuOpen(false);
            });
        }
    }, [props.width, props.height]);

    useEffect(() => {
        // This effect is called when the search data changes. This means that the user has searched something using the
        // search bar.
        if (Object.keys(props.searchData).length !== 0) {
            // noinspection JSIgnoredPromiseFromCall
            moveToImage(props.searchData.tile, props.searchData.image);
        }
    }, [props.searchData]);


    useEffect(() => {
        // Block movement of the stage if the carousel is shown
        container.current.interactive = !props.showCarousel;
        // Set mouse down to false
        mouseDown.current = false;
        container.current.cursor = 'grab';
        // Loop over all sprites and make them blurry if the carousel is shown, else make them not blurry.
        for (let child of container.current.children) {
            if (props.showCarousel) {
                // Make sprite blurry
                if (child.filters === null || child.filters.length === 0) {
                    child.filters = [new BlurFilter(2)];
                } else
                    child.filters[0].enabled = true;
            } else {
                // Remove blur filter
                child.filters = [];
            }
        }
    }, [props.showCarousel]);


    const updateStage = () => {
        // Get tile coordinates of the visible tiles. The number of tiles is not computed on the current zoom level, but
        // on Math.ceil(zoomLevel.current + depth.current). This is because we want to fetch data for the next zoom level
        // when the user is zooming in, and for the current zoom level when the user is zooming out.
        const effective_zoom_level = Math.ceil(zoomLevel.current + depth.current);

        const number_of_tiles = 2 ** effective_zoom_level;
        const tile_step_x = (maxX.current - minX.current) / number_of_tiles;
        const tile_step_y = (maxY.current - minY.current) / number_of_tiles;

        // Get tile coordinates of the tile that contains the upper left corner of the stage.
        const tile_x = Math.min(Math.floor((effectivePosition.current.x - minX.current) / tile_step_x), number_of_tiles - 1);
        const tile_y = Math.min(Math.floor((effectivePosition.current.y - minY.current) / tile_step_y), number_of_tiles - 1);

        // Get tiles
        // const tiles = getTilesToFetch(tile_x, tile_y, effective_zoom_level, props.maxZoomLevel);
        // Get visible tiles. The visible tiles are the tiles at the current zoom level.
        // const visible_tiles = tiles.get(effective_zoom_level);

        const visible_tiles = getTilesToFetchCurrentZoomLevel(tile_x, tile_y, effective_zoom_level);

        // Remove tiles and sprites of tiles that are not visible
        for (let tile of tilesOnStage.current.keys()) {
            // If the tile is from the previous zoom level, delete the entry from tilesOnStage but do not delete all
            // the sprites. This is because some of the sprites might still be visible.
            if (effective_zoom_level === parseInt(tile.split("-")[0]) + 1) {
                for (let index of tilesOnStage.current.get(tile)) {
                    // Check the tile the sprite is in. If the sprite is not among the tiles in visible_tiles, then
                    // remove it, else set is_in_previous_zoom_level to true.
                    if (!spritesGlobalInfo.current.has(index)) {
                        continue;
                    }
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
                // Delete tile from tilesOnStage
                tilesOnStage.current.delete(tile);
            } else if (!(effective_zoom_level === parseInt(tile.split("-")[0])) || !visible_tiles.some(visible_tile =>
                visible_tile.x === parseInt(tile.split("-")[1]) && visible_tile.y === parseInt(tile.split("-")[2]))) {
                // The tile is not among the visible ones.
                for (let index of tilesOnStage.current.get(tile)) {
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
                // Delete tile from tilesOnStage
                tilesOnStage.current.delete(tile);
            }
        }

        // Change position of all sprites that are on stage
        for (let index of sprites.current.keys()) {
            // Get position of artwork in stage coordinates.
            const artwork_position = mapGlobalCoordinatesToStageCoordinates(
                spritesGlobalInfo.current.get(index).x,
                spritesGlobalInfo.current.get(index).y
            );

            // Update position of sprite if it varies from the current position by more than 1 pixel
            sprites.current.get(index).x = Math.abs(sprites.current.get(index).x - artwork_position.x) > 1 ?
                artwork_position.x : sprites.current.get(index).x;
            sprites.current.get(index).y = Math.abs(sprites.current.get(index).y - artwork_position.y) > 1 ?
                artwork_position.y : sprites.current.get(index).y;

            // Set alpha of sprite
            if (spritesGlobalInfo.current.get(index).is_in_previous_zoom_level || depth.current === 0) {
                sprites.current.get(index).alpha = 1;
            } else {
                // Set alpha proportional to the depth
                if (depth.current > 0)
                    sprites.current.get(index).alpha = (1 - Math.cos(depth.current * Math.PI / 2)) ** 3;
                else
                    sprites.current.get(index).alpha = (1 - Math.cos((1 + depth.current) * Math.PI / 2)) ** 3;
            }

            // Make sprite interactive if the values of alpha is bigger than 0.2
            sprites.current.get(index).interactive = sprites.current.get(index).alpha > 0.2;

        }

        // Fetch data for the visible tiles if it is not in the cache
        visible_tiles.map(tile => {
            //tilesCache.current.fetch(getUrlForClusterData(effective_zoom_level, tile.x, tile.y, props.selectedDataset, props.host))
            const data = tilesCache.current.get(effective_zoom_level + "-" + tile.x + "-" + tile.y);

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
            tilesOnStage.current.set(effective_zoom_level + "-" + tile.x + "-" + tile.y,
                data["clusters_representatives"]["entities"].map(entity => entity["representative"]["index"]));
        });

        // // Fetch all other tiles that are not visible. This is done to speed up transitions to other zoom levels.
        // if (effective_zoom_level < props.maxZoomLevel) {
        //     tiles.get(effective_zoom_level + 1).map(tile => {
        //         // noinspection JSIgnoredPromiseFromCall
        //         tilesCache.current.fetch(getUrlForClusterData(effective_zoom_level + 1, tile.x, tile.y, props.selectedDataset, props.host));
        //     });
        // }
        //
        // if (effective_zoom_level > 0) {
        //     tiles.get(effective_zoom_level - 1).map(tile => {
        //         // noinspection JSIgnoredPromiseFromCall
        //         tilesCache.current.fetch(getUrlForClusterData(effective_zoom_level - 1, tile.x, tile.y, props.selectedDataset, props.host));
        //     });
        // }

        // Do asserts to check that everything is correct
        console.assert(sprites.current.size === spritesGlobalInfo.current.size);
        console.assert(sprites.current.size + spritePool.current.length === 800);
        console.assert(tilesOnStage.current.size <= 14);
    }

    const updateStageThrottled = throttle(updateStage, 50);

    // Create function for making the sprite pulse once it becomes available
    function pulseIfAvailable(spriteIndex) {
        const sprite = sprites.current.get(spriteIndex);
        if (sprite) {
            // Put sprite in front
            sprite.zIndex = 30;
            // Sort children
            container.current.sortChildren();
            makeSpritePulse(sprite);
        }
    }

    // Create function for managing translation ticker
    const awaitTranslationTicker = (image) => {
        // Compute translation such that at the end of the translation the tile is perfectly centered. The translation is
        // computed in global coordinates.
        let final_effective_position_x = image.x - effectiveWidth.current / 2;
        let final_effective_position_y = image.y - effectiveHeight.current / 2;

        // Make sure the final position is within the limits of the embedding space
        final_effective_position_x = Math.max(Math.min(final_effective_position_x, maxX.current - effectiveWidth.current), minX.current);
        final_effective_position_y = Math.max(Math.min(final_effective_position_y, maxY.current - effectiveHeight.current), minY.current);

        // Define steps
        let step_x = (final_effective_position_x - effectivePosition.current.x) / initial_transition_step;
        let step_y = (final_effective_position_y - effectivePosition.current.y) / initial_transition_step;

        // If both steps are 0, then we do not need to do anything
        if (step_x <= 0.0001 && step_y <= 0.0001) {
            return Promise.resolve();
        }

        // Define variable for transition steps
        let transition_steps = initial_transition_step;
        // If the biggest step size is smaller than 0.005, halve the number of transition steps.
        if (Math.max(Math.abs(step_x), Math.abs(step_y)) < 0.005) {
            transition_steps = Math.ceil(initial_transition_step / 2);
            step_x = (final_effective_position_x - effectivePosition.current.x) / transition_steps;
            step_y = (final_effective_position_y - effectivePosition.current.y) / transition_steps;
        }

        return new Promise((resolve) => {
            const translation_ticker = new PIXI.Ticker();
            // Define counter for number of steps
            let counter = 0;

            translation_ticker.add(() => {
                // Check if position is equal to the target position.
                if ((effectivePosition.current.x === final_effective_position_x
                        && effectivePosition.current.y === final_effective_position_y)
                    || counter === transition_steps) {
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
                    // Increment counter
                    counter++;
                    // Update stage
                    updateStageThrottled();
                }
            });

            translation_ticker.start();
        });
    }

    // Create function for managing zoom ticker
    const awaitZoomTicker = (tile, image) => {
        return new Promise((resolve) => {
            const zoom_ticker = new PIXI.Ticker();

            zoom_ticker.add(() => {
                if (zoomLevel.current === tile[0] && depth.current === 0) {
                    // Stop ticker
                    console.log("Zoom ticker stopped");
                    zoom_ticker.stop();
                    resolve();
                } else {
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
                    updateStageThrottled();
                }
            });
            zoom_ticker.start();
        });
    }

    // Create function for handling click on image or search
    const moveToImage = async (tile, image) => {
        // Make container not interactive.
        container.current.interactive = false;
        container.current.interactiveChildren = false;

        // 1. Transition to the new location in the embedding space without changing the zoom level.

        // Wait for first translation ticker to finish
        await awaitTranslationTicker(image);

        // Wait for zoom ticker to finish
        await awaitZoomTicker(tile, image);

        // Wait for second translation ticker to finish
        await awaitTranslationTicker(image);

        // Make container interactive again
        container.current.interactive = true;
        container.current.interactiveChildren = true;

        // 2. Pulse the sprite of the image that was clicked on.
        setTimeout(() => {
            pulseIfAvailable(image.index);
        }, 10);
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
            // updateStage();
            updateStageThrottled();
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

    // Handle pinch start. Only reset previous scale.
    const handlePinchStart = () => {
        previousScale.current = 1;
    };

    // Create handler for pinch. The handler of pinch does the exact same thing as the handler for mouse wheel, but the
    // delta is computed differently.
    const handlePinch = (event) => {
        // Get scale
        let scale = event.scale;
        // Delta is the difference between the current scale and the previous scale
        const delta = scale - previousScale.current;
        // Update previous scale
        previousScale.current = scale;
        // Handle zoom
        handleZoom(delta, event.center);
    }

    // Create handler for mouse wheel. We change the zoom level only if the user scrolls until a certain value of change in
    // depth is reached. This is to avoid changing the zoom level too often. We use a transition which depends on the percentage
    // of the change in depth in order to make the transition smoother. When the new zoom level is reached, we update
    // everything on the stage.
    const handleMouseWheel = (event) => {
        // Define delta
        let delta = -event.deltaY / 1000;
        // Get mouse position with respect to container
        const position = event.data.getLocalPosition(container.current);
        if (Math.abs(delta) > 0.01) {
            // Create zoom ticker to complete the transition by delta in steps of 0.002
            const zoom_ticker = new PIXI.Ticker();
            let current_delta = 0;
            zoom_ticker.add(() => {
                if (Math.abs(current_delta) >= Math.abs(delta)) {
                    zoom_ticker.stop();
                } else {
                    handleZoom(Math.sign(delta) * 0.0035, position);
                    current_delta += Math.sign(delta) * 0.0035;
                }
            });
            zoom_ticker.start();
        } else {
            // Handle zoom
            handleZoom(delta, position);
        }
    }

    const handleZoom = (delta, mousePosition) => {
        // Deal with border cases
        if (zoomLevel.current === props.maxZoomLevel && depth.current + delta > 0) {
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

        // Get sprite under mouse
        const global_coordinates_sprite_under_mouse = getGlobalCoordinatesOfSpriteUnderMouse(mousePosition);

        // Fix zoom on top left corner of the sprite under the mouse
        let global_mouse_position;
        if (global_coordinates_sprite_under_mouse == null)
            global_mouse_position = mapStageCoordinatesToGlobalCoordinates(mousePosition.x, mousePosition.y);
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
            zoomLevel.current = Math.min(Math.max(zoomLevel.current, 0), props.maxZoomLevel);
            // Reset depth
            depth.current = 0;
        }

        // Update stage
        // updateStage();
        updateStageThrottled();
    }


    return (
        <></>
    );
}


export default ClustersMap;