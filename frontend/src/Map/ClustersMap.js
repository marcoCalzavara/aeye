import {useEffect, useRef} from 'react';
import * as PIXI from "pixi.js";
import {KawaseBlurFilter} from "@pixi/filter-kawase-blur";
import Hammer from "hammerjs";
import {useApp} from "@pixi/react";
import {LRUCache} from "lru-cache";
import 'tailwindcss/tailwind.css';
import {convertIndexToTile, getTilesFromZoomLevel, getTilesToFetch} from "./utilities";
import {getUrlForImage} from "../utilities";

const DURATION = 2; // seconds
const SPRITEPOOLSIZE = 800;
const BLURSTRENGTH = 1;
const BLURSTRENGTHMAX = 1;
// const NUMOFBLURSTRENGTHS = 10;
// const BLURSTRENGTHS = Array.from({length: NUMOFBLURSTRENGTHS}, (_, i) => i * BLURSTRENGTHMAX / (NUMOFBLURSTRENGTHS - 1));
const QUALITY = 2;
// const DEPTH_ALPHA_FLICKERING = 0.2
// Define constant for transition steps and depth steps
const INITIAL_TRANSITION_STEPS = 100;
const DEPTH_STEP = 0.02;
const NUM_OF_VELOCITIES = 10;

function getUrlForFirstTiles(dataset, host = "") {
    return `${host}/api/first-tiles?collection=${dataset}_zoom_levels_clusters`;
}

export function fetchTiles(indexes, tilesCache, pendingTiles, dataset, host) {
    // Create url
    const url = `${host}/api/tiles?indexes=${indexes.join(",")}&collection=${dataset}_zoom_levels_clusters`;
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
        .then(data => {
            // Save data in the cache. Use the triple of zoom level, tile x and tile y as key.
            for (let tile of data) {
                // Get tile from index
                const zoom_plus_tile = convertIndexToTile(tile["index"]);
                tilesCache.set(zoom_plus_tile.zoom + "-" + zoom_plus_tile.x + "-" + zoom_plus_tile.y, tile["data"]);
                // Remove index from pending tiles
                pendingTiles.delete(tile["index"]);
            }
        })
        .catch(error => {
            // Handle any errors that occur during the fetch operation
            console.error('Error:', error);
        });
}

/**
 * The function fetches the first few zoom levels in one unique batch at the beginning of the execution of the application.
 * @param url
 * @param signal
 * @param tilesCache The tiles cache is used to fetch the tiles. The tiles cache is an LRU cache.
 * @returns {Promise<unknown>}
 */
export function fetchFirstTiles(url, signal, tilesCache) {
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
            let range;
            for (let tile of data) {
                // Convert index to tile
                const zoom_plus_tile = convertIndexToTile(tile["index"]);
                tilesCache.set(zoom_plus_tile.zoom + "-" + zoom_plus_tile.x + "-" + zoom_plus_tile.y, tile["data"]);
                if (tile["index"] === 0) {
                    range = tile["range"];
                }
            }
            return range;
        })
        .catch(error => {
            // Handle any errors that occur during the fetch operation
            console.error('Error:', error);
        });

}

/* function throttle(func, limit) {
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
} */


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
    // Define state for the selected dataset
    const selectedDataset = useRef(props.selectedDataset);
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
    const spritePool = useRef(new Array(SPRITEPOOLSIZE));
    // Define max width and height of a sprite. These values depend on the size of the viewport.
    const maxWidth = useRef(props.stageWidth / 10);
    const maxHeight = useRef(props.stageHeight / 10);
    // Define refs for height and width of the stage and of the embedding space, and also for the overflowX.
    const stageWidth = useRef(props.stageWidth);
    const stageHeight = useRef(props.stageHeight);
    const width = useRef(props.width);
    const height = useRef(props.height);
    const overflowX = useRef(Math.round(props.overflowX / 2));
    // Define state for limits of embedding space. These values are initialized when the component is mounted and never change.
    const minX = useRef(0);
    const maxX = useRef(0);
    const minY = useRef(0);
    const maxY = useRef(0);
    const realMinX = useRef(0);
    const realMaxX = useRef(0);
    // Define boolean for mouse down
    const mouseDown = useRef(false);
    // Define state for tiles which are currently on stage
    const tilesOnStage = useRef(new Map());
    // Define least recently used cache for tiles. Use fetchTileData to fetch tiles.
    const tilesCache = useRef(new LRUCache({
        max: 15000,
        updateAgeOnHas: true,
        updateAgeOnGet: true
    }));
    // Define array of unresolved promises for fetching tiles
    const unresolvedPromises = useRef([]);
    // Define set for pending tiles
    const pendingTiles = useRef(new Set());
    // Define state for the app1
    const app = useApp()
    // Create container for the stage
    const container = useRef(null);
    // Create container for when the other container is disabled
    const containerForCarousel = useRef(new PIXI.Container());
    // Define hammer
    const hammer = useRef(null);
    // Define state for previous scale for pinching
    const previousScale = useRef(1);
    // Create a ref that will store the current value of showCarousel
    const showCarouselRef = useRef(props.showCarousel);
    // Create a ref that will store the current value of the clicked search bar
    const searchBarIsClickedRef = useRef(props.searchBarIsClicked);
    // const graphics = useRef(new PIXI.Graphics());
    const touchStartPositionSprite = useRef({x: 0, y: 0});
    const touchPrevTime = useRef(0);
    const touchPrevPos = useRef({x: 0, y: 0});
    const touchVelocities = useRef([]);
    const isPinching = useRef(false);
    console.log("Stage width: ", stageWidth.current, "Stage height: ", stageHeight.current);

    const mapGlobalCoordinatesToStageCoordinates = (global_x, global_y) => {
        // Map global coordinates to stage coordinates
        const stage_x = ((global_x - effectivePosition.current.x) * (width.current - maxWidth.current)) / effectiveWidth.current - overflowX.current;
        const stage_y = ((global_y - effectivePosition.current.y) * (height.current - maxHeight.current)) / effectiveHeight.current;
        return {
            x: stage_x,
            y: stage_y
        }
    }

    const mapStageCoordinatesToGlobalCoordinates = (stage_x, stage_y) => {
        // Map stage coordinates to global coordinates
        const global_x = (stage_x * effectiveWidth.current) / stageWidth.current;
        const global_y = (stage_y * effectiveHeight.current) / stageHeight.current;
        return {
            x: global_x + effectivePosition.current.x,
            y: global_y + effectivePosition.current.y
        }
    }

    const makeSpritePulse = (sprite) => {
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
                const scaleFactor = 1 + 0.5 * Math.abs(Math.sin(elapsed * Math.PI / (DURATION / 2)));

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

    const openCarousel = (index) => {
        props.setClickedImageIndex(index);
        props.setShowCarousel(true);
    }

    const blurSprite = (sprite, blur) => {
        // Set blur strength proportional to the depth
        if (!blur) {
            sprite.filters[0].blur = 0;
            sprite.filters[0].enabled = false;
            sprite.alpha = 1;
            sprite.zIndex = 10;
        } else {
            // Set blur strength proportional to the depth. If showCarousel is true, then leave the blur strength as it is.
            if (depth.current >= 0) {
                sprite.filters[0].blur = BLURSTRENGTHMAX * (1 - Math.sin(depth.current * Math.PI / 2)) ** 3;
                // sprite.filters[0].blur = BLURSTRENGTHS[BLURSTRENGTHS.length - 1 - Math.floor(depth.current * (NUMOFBLURSTRENGTHS - 1))];
            } else {
                sprite.filters[0].blur = BLURSTRENGTHMAX * (1 - Math.sin((1 + depth.current) * Math.PI / 2)) ** 3;
                // sprite.filters[0].blur = BLURSTRENGTHS[Math.floor((1 + depth.current) * (NUMOFBLURSTRENGTHS - 1))];
            }

            if (!props.showCarousel) {
                sprite.filters[0].enabled = true;
                sprite.zIndex = 5;
            }
            //
            // // Modify the alpha of the sprite. Unless in zoom level 0, the alpha goes rapidly to 1 from 0 around a
            // // depth of 0. This is done to avoid the flickering of the sprites when they all of a sudden become visible.
            // if (zoomLevel.current === 0 || Math.floor(zoomLevel.current + depth.current) === 0) {
            //     sprite.alpha = 1;
            // }
            // else {
            //     if (depth.current >= 0) {
            //         if (depth.current < DEPTH_ALPHA_FLICKERING / 2)
            //             sprite.alpha = 0;
            //         else if (DEPTH_ALPHA_FLICKERING / 2 <= depth.current < (5 / 2) * DEPTH_ALPHA_FLICKERING)
            //             sprite.alpha = (1 / Math.log(11)) * Math.log((5 / DEPTH_ALPHA_FLICKERING) * (depth.current - DEPTH_ALPHA_FLICKERING / 2) + 1);
            //         else
            //             sprite.alpha = 1;
            //     }
            //     else {
            //         sprite.alpha = 1;
            //     }
            // }
        }
        // Make sprite interactive if the blur is less than 2/5 of the maximum blur strength, else make it not interactive.
        sprite.interactive = sprite.filters[0].blur < (2 / 5) * BLURSTRENGTHMAX;
        sprite.cursor = sprite.interactive ? 'pointer' : 'default';
    }

    const scaleSprite = (index) => {
        // Get scale
        let scale = 1;
        if (!spritesGlobalInfo.current.get(index).is_in_previous_zoom_level && !(zoomLevel.current === props.maxZoomLevel && depth.current === 0)) {
            if (depth.current >= 0) {
                scale = 1 / (2 ** (1 - depth.current));
            } else {
                scale = 2 ** (depth.current);
            }
        }
        // Update size of sprite
        const width = spritesGlobalInfo.current.get(index).width;
        const height = spritesGlobalInfo.current.get(index).height;
        const aspect_ratio = width / height;
        sprites.current.get(index).height = maxHeight.current * scale;
        sprites.current.get(index).width = maxHeight.current * scale * aspect_ratio;
    }

    const setSpriteHandlers = (sprite, index) => {
        // Remove all listeners
        sprite.removeAllListeners();

        sprite.on('mousedown', () => {
            props.prevClickedImageIndex.current = props.clickedImageIndex;
            props.setClickedImageIndex(index);
            props.setShowCarousel(true);
        });

        sprite.on('mouseenter', () => {
            // Deactivate second blur filter, but activate first blur filter
            if (searchBarIsClickedRef.current) {
                sprite.filters[0].enabled = sprite.filters[0].blur !== 0;
                sprite.filters[1].enabled = false;
            }
        });

        sprite.on('mouseleave', () => {
            // Activate second blur filter, but deactivate first blur filter
            if (showCarouselRef.current) {
                sprite.filters[0].enabled = false;
                sprite.filters[1].enabled = true;
            }
        });

        sprite.on('touchstart', (event) => {
            // Get position on the screen where the touch event occurred
            touchStartPositionSprite.current = event.data.getLocalPosition(container.current);
        });

        sprite.on('touchend', (event) => {
            // Get position on the screen where the touch event occurred
            const touchEndPosition = event.data.getLocalPosition(container.current);
            // Calculate the distance between the start and end position of the touch event
            const distance = Math.sqrt((touchEndPosition.x - touchStartPositionSprite.current.x) ** 2 +
                (touchEndPosition.y - touchStartPositionSprite.current.y) ** 2);
            // If the distance is less than 2, then open the carousel
            if (distance < 2) {
                props.prevClickedImageIndex.current = props.clickedImageIndex;
                props.setClickedImageIndex(index);
                props.setShowCarousel(true);
            }
            touchStartPositionSprite.current = {x: 0, y: 0};
        });
    }

    const addSpriteToStage = (index, path, width, height, global_x, global_y, is_in_previous_zoom_level, blur = false) => {
        // Get sprite from sprite pool
        const sprite = spritePool.current.pop();
        // Add sprite to sprites
        sprites.current.set(index, sprite);
        // Save global coordinates of the artwork
        spritesGlobalInfo.current.set(index, {
            x: global_x, y: global_y, width: width, height: height, path: path,
            is_in_previous_zoom_level: is_in_previous_zoom_level
        });

        // Define size of sprite
        scaleSprite(index);

        // Create a gray texture for the sprite
        let graphics = new PIXI.Graphics();
        graphics.beginFill(0x404040);
        graphics.drawRect(0, 0, sprite.width, sprite.height);
        graphics.endFill();

        // First, set gray texture, then set actual texture.
        // noinspection all
        sprite.texture = app.renderer.generateTexture(graphics);
        // Set main texture
        sprite.texture = PIXI.Texture.from(getUrlForImage(path, selectedDataset.current, props.host));
        // Set z-index of sprite to 10
        sprite.zIndex = 10;

        // Add text to sprite with the index of the artwork
        // sprite.removeChildren();
        // const text = new PIXI.Text(index, {fontFamily: 'Arial', fontSize: 30, fill: 0xff0000, align: 'center'});
        // text.x = 10;
        // text.y = 10;
        // sprite.addChild(text);

        // Get position of artwork in stage coordinates.
        const artwork_position = mapGlobalCoordinatesToStageCoordinates(global_x, global_y);
        // Set position of sprite
        sprite.x = artwork_position.x;
        sprite.y = artwork_position.y;

        // Create blur filters for sprite. The first one is for depth, the second one is for the carousel and for the
        // search bar.
        sprite.filters = [new KawaseBlurFilter(0, QUALITY, true), new KawaseBlurFilter(BLURSTRENGTH, QUALITY, true)];
        sprite.filters[0].enabled = false;
        sprite.filters[1].enabled = blur;

        // Set blur strength proportional to the depth
        blurSprite(sprite, !is_in_previous_zoom_level && !(zoomLevel.current === props.maxZoomLevel && depth.current === 0));

        // Set sprite handlers
        setSpriteHandlers(sprite, index);

        // Add sprite to stage
        container.current.addChild(sprite);
    }

    const reset = () => {
        // Reset zoom level
        zoomLevel.current = 0;
        depth.current = 0;
        // Remove all children from stage
        app.stage.removeChildren();
        // Add graphics to stage
        // graphics.current.clear();
        // graphics.current.removeChildren();
        // app.stage.addChild(graphics.current);
        // Set container to null
        container.current = null;
        // Reset sprites
        sprites.current.clear();
        // Recreate sprite pool
        spritePool.current = new Array(SPRITEPOOLSIZE);
        // Reset sprites global info
        spritesGlobalInfo.current.clear();
        // Reset tiles on stage
        tilesOnStage.current.clear();
        // Clear tiles cache
        tilesCache.current.clear();
        // Make sure spritePool contains SPRITEPOOLSIZE sprites
        console.assert(spritePool.current.length === SPRITEPOOLSIZE);
    }

    // useEffect for initialization of the component. This is called every time the selected dataset changes.
    useEffect(() => {
        // Change selected dataset
        selectedDataset.current = props.selectedDataset;
        // Reset everything at the initial state
        reset();

        // Create container for the stage
        if (!container.current) {
            // Create container
            container.current = new PIXI.Container();
            app.stage.addChild(container.current);
        }

        // Manage second container
        containerForCarousel.current.interactive = true;
        containerForCarousel.current.zIndex = 1;
        // noinspection all
        containerForCarousel.current.hitArea = new PIXI.Rectangle(0, 0, stageWidth.current, stageHeight.current);
        // Define event handlers for the second container
        // noinspection all
        containerForCarousel.current
            .on('mousedown', () => props.setShowCarousel(false))
            .on('touchstart', () => props.setShowCarousel(false));

        // Define container pointer
        container.current.cursor = 'grab';

        // Add handlers to stage
        // noinspection all
        container.current.hitArea = new PIXI.Rectangle(0, 0, stageWidth.current, stageHeight.current);
        container.current.zIndex = 2;
        container.current.sortableChildren = true;
        container.current.interactive = true;
        container.current.inteactiveChildren = true;

        // Populate the sprite pool
        for (let i = 0; i < spritePool.current.length; i++) {
            spritePool.current[i] = new PIXI.Sprite();
        }

        // Fetch first zoom levels
        fetchFirstTiles(getUrlForFirstTiles(selectedDataset.current, props.host), null, tilesCache.current)
            .then((range) => {
                // Get cluster data for the first zoom level
                const data = tilesCache.current.get("0-0-0");

                // Update the limits of the embedding space
                realMinX.current = range["x_min"];
                realMaxX.current = range["x_max"];
                minY.current = range["y_min"];
                maxY.current = range["y_max"];

                // Update effective size of the stage
                effectiveWidth.current = realMaxX.current - realMinX.current;
                effectiveHeight.current = maxY.current - minY.current;

                // Compute overflowX, minX, and maX. We want to allow additional movement in the x direction in order to
                // make all the artworks visible.
                const overflowX_embedding_space = Math.max(overflowX.current * effectiveWidth.current / width.current, 0);
                minX.current = realMinX.current - overflowX_embedding_space;
                maxX.current = realMaxX.current + overflowX_embedding_space;

                // Update the effective position of the stage
                effectivePosition.current.x = realMinX.current;
                effectivePosition.current.y = minY.current;

                // Loop over artworks in tile and add them to the stage. Take the sprites from the sprite pool.
                // noinspection JSUnresolvedVariable
                for (let i = 0; i < data.length; i++) {
                    // Add sprite to stage
                    addSpriteToStage(
                        data[i]["index"],
                        data[i]["path"],
                        data[i]["width"],
                        data[i]["height"],
                        data[i]["x"],
                        data[i]["y"],
                        true,
                        !props.searchBarIsClicked
                    );
                }
                // noinspection JSUnresolvedVariable
                tilesOnStage.current.set("0-0-0",
                    data.map(entity => entity["index"]));

                // Add artworks from the second zoom level to the stage
                const tile_indexes = ["1-0-0", "1-0-1", "1-1-0", "1-1-1"];
                for (let tile_index of tile_indexes) {
                    const data = tilesCache.current.get(tile_index);
                    // noinspection JSUnresolvedVariable
                    for (let i = 0; i < data.length; i++) {
                        // Add sprite to stage
                        if (!sprites.current.has(data[i]["index"])) {
                            addSpriteToStage(
                                data[i]["index"],
                                data[i]["path"],
                                data[i]["width"],
                                data[i]["height"],
                                data[i]["x"],
                                data[i]["y"],
                                data[i]["in_previous"],
                                !props.searchBarIsClicked
                            );
                        }
                    }
                    // noinspection JSUnresolvedVariable
                    tilesOnStage.current.set(tile_index,
                        data.map(entity => entity["index"]));
                }
            }).then(() => {
            props.setInitialLoadingDone(true);
            // Create hammer. Bind it to the gesture area.
            // noinspection all
            hammer.current = new Hammer(container.current);
            // Disable all gestures except pinch
            hammer.current.get('tap').set({enable: false});
            hammer.current.get('press').set({enable: false});
            hammer.current.get('rotate').set({enable: false});
            hammer.current.get('pan').set({enable: false});
            hammer.current.get('swipe').set({enable: false});
            hammer.current.get('pinch').set({enable: true});
            hammer.current.on('pinchstart', handlePinchStart);
            hammer.current.on('pinch', handlePinch);

            // Add all handlers to the stage
            container.current
                .on('mousedown', handleMouseDown)
                .on('mouseup', handleMouseUp)
                .on('mousemove', handleMouseMove)
                .on('wheel', handleMouseWheel)
                .on('touchmove', handleTouchMove)
                .on('touchend', handleTouchEnd)
                .on('touchstart', handleTouchStart);

        });
    }, [props.selectedDataset]);

    useEffect(() => {
        // Update ref for clicked search bar
        searchBarIsClickedRef.current = props.searchBarIsClicked;
        // Deactivate blur filter from all sprites
        for (let child of container.current.children) {
            if (!props.showCarousel) {
                // Enable blur for depth and disable blur for search bar
                child.filters[0].enabled = child.filters[0].blur !== 0;
                child.filters[1].enabled = false;
            }
        }
    }, [props.searchBarIsClicked]);

    useEffect(() => {
        // Update ref for stage width and height and width and height of the embedding space, and also for the overflowX.
        stageWidth.current = props.stageWidth;
        stageHeight.current = props.stageHeight;
        width.current = props.width;
        height.current = props.height;
        overflowX.current = Math.round(props.overflowX / 2);

        // Resize container and set hit area
        // noinspection all
        container.current.hitArea = new PIXI.Rectangle(0, 0, stageWidth.current, stageHeight.current);

        // Save current minX and maxX
        const prevMinX = minX.current;
        const prevMaxX = maxX.current;
        // Update minX and maxX
        const overflowX_embedding_space = Math.max(overflowX.current * effectiveWidth.current / width.current, 0);
        minX.current = realMinX.current - overflowX_embedding_space;
        maxX.current = realMaxX.current + overflowX_embedding_space;

        // // Update effective position of the stage.
        const factor = (maxX.current - minX.current) === (prevMaxX - prevMinX) ? 1 : (maxX.current - minX.current) / (prevMaxX - prevMinX);
        effectivePosition.current.x = factor * (effectivePosition.current.x - prevMinX) + minX.current;

        // Update max width and height of a sprite and update all sprites
        maxWidth.current = stageWidth.current / 10;
        maxHeight.current = stageHeight.current / 10;

        for (let index of sprites.current.keys()) {
            // Update size of sprite
            scaleSprite(index);
            // Get position of artwork in stage coordinates.
            const artwork_position = mapGlobalCoordinatesToStageCoordinates(
                spritesGlobalInfo.current.get(index).x,
                spritesGlobalInfo.current.get(index).y
            );
            // Set position of sprite
            sprites.current.get(index).x = artwork_position.x;
            sprites.current.get(index).y = artwork_position.y;
        }
    }, [props.width, props.height, props.overflowX, props.stageWidth, props.stageHeight]);

    useEffect(() => {
        // This effect is called when the search data changes.
        if (Object.keys(props.searchData).length !== 0) {
            // noinspection JSIgnoredPromiseFromCall
            moveToImage(props.searchData.tile, props.searchData.image);
        }
    }, [props.searchData]);


    useEffect(() => {
        // Update ref for showCarousel
        showCarouselRef.current = props.showCarousel;
        // Block movement of the stage if the carousel is shown
        container.current.interactive = !props.showCarousel;
        if (hammer.current) {
            hammer.current.get('pinch').set({enable: !props.showCarousel});
        }
        if (props.showCarousel) {
            // Add containerForCarousel to stage
            app.stage.addChild(containerForCarousel.current);
            app.stage.sortChildren();
        }
        else
            // Remove containerForCarousel from stage
            app.stage.removeChild(containerForCarousel.current);

        // Deactivate blur filter from all sprites
        // Set mouse down to false
        mouseDown.current = false;
        container.current.cursor = 'grab';
        // Loop over all sprites and make them blurry if the carousel is shown, else make them not blurry.
        for (let child of container.current.children) {
            if (props.showCarousel) {
                // Activate second blur filter, deactivate first blur filter
                child.filters[0].enabled = false;
                child.filters[1].enabled = true;
            } else {
                // Deactivate second blur filter, activate first blur filter
                child.filters[0].enabled = child.filters[0].blur !== 0;
                child.filters[1].enabled = false;
            }
        }
    }, [props.showCarousel]);

    const removeSprite = (index) => {
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

    const updateStage = () => {
        const time = performance.now();
        // Get zoom level. Obs: We keep as tiles on stage the tiles at the next zoom level. This is because these tiles
        // also contain the artworks from the current zoom level.
        const next_zoom_level = Math.min(depth.current >= 0 ? zoomLevel.current + 1 : zoomLevel.current, props.maxZoomLevel);
        const current_zoom_level = Math.max(depth.current > 0 ? zoomLevel.current : zoomLevel.current - 1, 0);

        const number_of_tiles = 2 ** next_zoom_level;
        const tile_step_x = (maxX.current - minX.current) / number_of_tiles;
        const tile_step_y = (maxY.current - minY.current) / number_of_tiles;
        const tile_step_x_for_sprites = (realMaxX.current - realMinX.current) / number_of_tiles;

        // Get tile coordinates of the tile that contains the upper left corner of the stage.
        const tile_x = Math.min(Math.floor((effectivePosition.current.x - minX.current) / tile_step_x), number_of_tiles - 1);
        const tile_y = Math.min(Math.floor((effectivePosition.current.y - minY.current) / tile_step_y), number_of_tiles - 1);

        // Get indexes of tiles to fetch
        let indexes = getTilesToFetch(tile_x, tile_y, next_zoom_level, props.maxZoomLevel, tilesCache.current);
        // Filter out the indexes that are in the cache or in the pending tiles
        let tile;
        indexes = indexes.filter(index => {
            tile = convertIndexToTile(index);
            return !tilesCache.current.has(tile.zoom + "-" + tile.x + "-" + tile.y) &&
                !pendingTiles.current.has(index);
        });
        // Add the indexes to the pending tiles
        indexes.map(index => {
            if (!tilesCache.current.has(index)) {
                pendingTiles.current.add(index);
            }
        });

        // Create promise with null
        if (indexes.length > 0) {
            console.log("There are tiles to fetch.");
            unresolvedPromises.current.push(fetchTiles(indexes, tilesCache.current, pendingTiles.current, selectedDataset.current, props.host));
        }
        // Get visible tiles
        const visible_tiles = getTilesFromZoomLevel(tile_x, tile_y, next_zoom_level);

        // Remove tiles and sprites of tiles that are not visible
        for (let tile of tilesOnStage.current.keys()) {
            // If the tile is from the current zoom level, delete the entry from tilesOnStage but do not delete all
            // the sprites. This is because some of the sprites might still be visible.
            if (current_zoom_level === parseInt(tile.split("-")[0])) {
                for (let index of tilesOnStage.current.get(tile)) {
                    // Check the tile the sprite is in. If the sprite is not among the tiles in visible_tiles, then
                    // remove it, else set is_in_current_zoom_level to true.
                    if (!spritesGlobalInfo.current.has(index)) {
                        continue;
                    }
                    const spriteGlobalPosition = spritesGlobalInfo.current.get(index);
                    const tile_x = Math.min(Math.floor((spriteGlobalPosition.x - realMinX.current) / tile_step_x_for_sprites), number_of_tiles - 1);
                    const tile_y = Math.min(Math.floor((spriteGlobalPosition.y - minY.current) / tile_step_y), number_of_tiles - 1);
                    if (!visible_tiles.some(visible_tile =>
                        visible_tile.x === tile_x && visible_tile.y === tile_y)) {
                        // Remove sprite from stage
                        removeSprite(index);
                    }
                }
                // Delete tile from tilesOnStage
                tilesOnStage.current.delete(tile);
            } else if (!(next_zoom_level === parseInt(tile.split("-")[0])) || !visible_tiles.some(visible_tile =>
                visible_tile.x === parseInt(tile.split("-")[1]) && visible_tile.y === parseInt(tile.split("-")[2]))) {
                // The tile is not among the visible ones.
                for (let index of tilesOnStage.current.get(tile)) {
                    if (sprites.current.has(index)) {
                        // Remove sprite from stage
                        removeSprite(index)
                    }
                }
                // Delete tile from tilesOnStage
                tilesOnStage.current.delete(tile);
            }
        }

        // Define count for check that everything is correct
        let count = 0;

        // Manage the graphics
        // graphics.current.clear();
        // graphics.current.removeChildren();
        // // Draw circle at the effective position of the stage
        // const stage = mapGlobalCoordinatesToStageCoordinates(effectivePosition.current.x, effectivePosition.current.y);
        // graphics.current.lineStyle(1, 0xFFFF00, 1);
        // graphics.current.beginFill(0xFFFF00, 1);
        // graphics.current.drawCircle(stage.x, stage.y, 5);
        // graphics.current.endFill();

        visible_tiles.map(async tile => {
            // Stop execution if the tilesCache does not contain the tile
            if (!tilesCache.current.has(next_zoom_level + "-" + tile.x + "-" + tile.y)) {
                await Promise.all(unresolvedPromises.current);
            }
            // Get data from tilesCache
            const data = tilesCache.current.get(next_zoom_level + "-" + tile.x + "-" + tile.y);

            // // Find max and  min x and y of the tile
            // let x_min = 1000000000; let x_max = -1000000000; let y_min = 1000000000; let y_max = -1000000000;
            // for (let entity of data) {
            //     if (entity["x"] < x_min)
            //         x_min = entity["x"];
            //     if (entity["x"]> x_max)
            //         x_max = entity["x"];
            //     if (entity["y"] < y_min)
            //         y_min = entity["y"];
            //     if (entity["y"] > y_max)
            //         y_max = entity["y"];
            // }
            //
            // // Draw rectangle
            // const stage = mapGlobalCoordinatesToStageCoordinates(x_min, y_min);
            // const width_s = (x_max - x_min) * (width.current) / effectiveWidth.current;
            // const height_s = (y_max - y_min) * (height.current) / effectiveHeight.current;
            // graphics.current.lineStyle(1, 0xFF0000, 1);
            // graphics.current.beginFill(0x000000, 0);
            // graphics.current.drawRect(stage.x, stage.y, width_s, height_s);
            // // Draw text on the left top corner of the rectangle with the index of the tile
            // const text = new PIXI.Text(zoomLevel.current + "-" + tile.x + "-" + tile.y,
            //     {fontFamily: 'Arial', fontSize: 24, fill: 0xFF0000, align: 'center'});
            // // Position the text
            // text.x = stage.x; text.y = stage.y;
            // // Write it in the graphics
            // graphics.current.addChild(text);
            // graphics.current.endFill();

            // Loop over artworks in tile and add them to the stage.
            // noinspection JSUnresolvedVariable
            for (let j = 0; j < data.length; j++) {
                // Increment count
                count += 1;
                // Get index
                const index = data[j]["index"];
                // Check if the artwork is already on stage. If it is not, add it to the stage.
                if (!sprites.current.has(index)) {
                    // Add sprite to stage
                    addSpriteToStage(
                        index,
                        data[j]["path"],
                        data[j]["width"],
                        data[j]["height"],
                        data[j]["x"],
                        data[j]["y"],
                        data[j]["in_previous"],
                    );
                } else {
                    spritesGlobalInfo.current.get(index).is_in_previous_zoom_level = data[j]["in_previous"];
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

                    // Set strength of blur filter proportional to the depth
                    blurSprite(sprites.current.get(index), !data[j]["in_previous"] && !(zoomLevel.current === props.maxZoomLevel && depth.current === 0));
                    // Set size of sprite
                    scaleSprite(index);
                }

                // Make sprite not visible if outside the viewing area
                const aspect_ratio = spritesGlobalInfo.current.get(index).width / spritesGlobalInfo.current.get(index).height;
                sprites.current.get(index).visible = sprites.current.get(index).x > -maxHeight.current * aspect_ratio
                     && sprites.current.get(index).x <= stageWidth.current
                     && sprites.current.get(index).y >= -maxHeight.current
                     && sprites.current.get(index).y <= stageHeight.current;
            }
            // Save artworks in tiles
            // noinspection JSUnresolvedVariable
            tilesOnStage.current.set(next_zoom_level + "-" + tile.x + "-" + tile.y,
                data.map(entity => entity["index"]));
        });
        // Do asserts to check that everything is correct
        console.assert(count === sprites.current.size);
        console.assert(container.current.children.length === sprites.current.size);
        console.assert(sprites.current.size === spritesGlobalInfo.current.size);
        console.assert(sprites.current.size + spritePool.current.length === SPRITEPOOLSIZE);
        console.log("Time to update stage: ", performance.now() - time, "ms");
    }

    // const updateStageThrottled = throttle(updateStage, 50);

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
        let step_x = (final_effective_position_x - effectivePosition.current.x) / INITIAL_TRANSITION_STEPS;
        let step_y = (final_effective_position_y - effectivePosition.current.y) / INITIAL_TRANSITION_STEPS;

        // If both steps are 0, then we do not need to do anything
        if (Math.abs(step_x) <= 0.0001 && Math.abs(step_y) <= 0.0001) {
            return Promise.resolve();
        }

        // Define variable for transition steps
        let transition_steps = INITIAL_TRANSITION_STEPS;
        // If the biggest step size is smaller than 0.005, halve the number of transition steps.
        if (Math.max(Math.abs(step_x), Math.abs(step_y)) < 0.005) {
            transition_steps = Math.ceil(INITIAL_TRANSITION_STEPS / 2);
            step_x = (final_effective_position_x - effectivePosition.current.x) / transition_steps;
            step_y = (final_effective_position_y - effectivePosition.current.y) / transition_steps;
        } else if (Math.max(Math.abs(step_x), Math.abs(step_y)) > 0.01) {
            transition_steps = Math.ceil(INITIAL_TRANSITION_STEPS * 2);
            step_x = (final_effective_position_x - effectivePosition.current.x) / transition_steps;
            step_y = (final_effective_position_y - effectivePosition.current.y) / transition_steps;
        } else if (Math.max(Math.abs(step_x), Math.abs(step_y)) > 0.05) {
            transition_steps = Math.ceil(INITIAL_TRANSITION_STEPS * 4);
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
                    // Stop ticker
                    translation_ticker.stop();
                    // Update stage
                    updateStage();
                    resolve();
                } else {
                    // Check if adding the step would make us go over the target position. If so, set the position to the
                    // target position.
                    if (Math.sign(step_x) === Math.sign(final_effective_position_x - effectivePosition.current.x))
                        effectivePosition.current.x += step_x;
                    else
                        effectivePosition.current.x = final_effective_position_x;
                    if (Math.sign(step_y) === Math.sign(final_effective_position_y - effectivePosition.current.y))
                        effectivePosition.current.y += step_y;
                    else
                        effectivePosition.current.y = final_effective_position_y;
                    // Increment counter
                    counter++;
                    // Update stage
                    updateStage();
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
                    zoom_ticker.stop();
                    // Update stage
                    updateStage();
                    resolve();
                } else {
                    // Change depth by 0.05. If the depth is -1 or 1, then change zoom level by 1 and reset depth sum or
                    // subtract 1 from delta.
                    let delta;
                    if (zoomLevel.current !== tile[0]) {
                        delta = Math.sign(tile[0] - zoomLevel.current) * DEPTH_STEP;
                    } else {
                        delta = -Math.sign(depth.current) * DEPTH_STEP; // If depth is greater than 0, then we have to reduce
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
                    effectiveWidth.current = (realMaxX.current - realMinX.current) / (2 ** (zoomLevel.current + depth.current));
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

    // Create function for handling click on image or search
    const moveToImage = async (tile, image) => {
        // Close the carousel if it is open
        if (props.showCarousel) {
            props.setShowCarousel(false);
        }

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

        // 2. Pulse the sprite of the image that was clicked on.
        setTimeout(() => {
            pulseIfAvailable(image.index);
        }, 10);

        // 3. Open the carousel after the transition is finished.
        setTimeout(() => {
            openCarousel(image.index);
            // Make container interactive again
            container.current.interactive = true;
            container.current.interactiveChildren = true;
        }, DURATION * 1000 + 10);
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
            const mouse_x = ((-event.movementX) * effectiveWidth.current) / width.current;
            const mouse_y = ((-event.movementY) * effectiveHeight.current) / height.current;
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
            // updateStageThrottled();
        }
    }

    // Create handler for touch start and touch end
    const handleTouchStart = (event) => {
        // Save touch position
        touchPrevPos.current = event.data.getLocalPosition(container.current);
        // Save touch start time
        touchPrevTime.current = Date.now();
    }

    // Create handler for touch move
    const handleTouchMove = (event) => {
        // Compute velocity
        const touchCurrPos = event.data.getLocalPosition(container.current);
        const touchCurrTime = Date.now();
        if (touchVelocities.current.length > NUM_OF_VELOCITIES) {
            // Remove the least recent velocity
            touchVelocities.current.shift();
        }
        // Add the new velocity
        touchVelocities.current.push({
            x: (touchCurrPos.x - touchPrevPos.current.x) / Math.max(touchCurrTime - touchPrevTime.current, 1),
            y: (touchCurrPos.y - touchPrevPos.current.y) / Math.max(touchCurrTime - touchPrevTime.current, 1)
        });
        // Save touch position
        touchPrevPos.current = touchCurrPos;
        // Save touch start time
        touchPrevTime.current = touchCurrTime;
        // Get mouse position. Transform movement of the mouse to movement in the embedding space.
        const mouse_x = ((-event.movementX) * effectiveWidth.current) / width.current;
        const mouse_y = ((-event.movementY) * effectiveHeight.current) / height.current;
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
        // updateStageThrottled();
    }

    const momentumTranslation = (averageVelocityX, averageVelocityY) => {
        // Reduce velocities by the same amount to make sure the max velocity is 3.5
        /*const maxVelocity = 2.5 / (zoomLevel.current + 1);
        if (averageVelocityX > averageVelocityY && averageVelocityX > maxVelocity) {
            averageVelocityX = maxVelocity;
            averageVelocityY -= (averageVelocityX - maxVelocity);
        } else if (averageVelocityY > averageVelocityX && averageVelocityY > maxVelocity) {
            averageVelocityY = maxVelocity;
            averageVelocityX -= (averageVelocityY - maxVelocity);
        }*/

        const frames = 40;
        return new Promise((resolve) => {
            const momentum_translation_ticker = new PIXI.Ticker();
            // Define counter for number of steps
            let counter = 0;
            momentum_translation_ticker.add(() => {
                // Check if position is equal to the target position.
                if (counter === frames) {
                    // Stop ticker
                    momentum_translation_ticker.stop();
                    // Destroy ticker
                    momentum_translation_ticker.destroy();
                    // Update stage
                    updateStage();
                    resolve();
                } else {
                    // Move the effective position of the stage by a step equal to the average velocity times 1000 / 60
                    effectivePosition.current.x = Math.max(
                        Math.min(effectivePosition.current.x - averageVelocityX * 1 / 40, maxX.current - effectiveWidth.current), minX.current);
                    effectivePosition.current.y = Math.max(
                        Math.min(effectivePosition.current.y - averageVelocityY * 1 / 40, maxY.current - effectiveHeight.current), minY.current);
                    // Increment counter
                    counter++;
                    // Decrease velocity
                    averageVelocityX *= 0.99;
                    averageVelocityY *= 0.99;
                    // Update stage
                    updateStage();
                }
            });
            momentum_translation_ticker.start();
        });
    }

    const handleTouchEnd = async () => {
        if (isPinching.current) {
            touchVelocities.current = [];
            isPinching.current = false;
            return;
        }
        // Compute average velocity in both x and y direction
        let averageVelocityX = 0;
        let averageVelocityY = 0;
        for (let velocity of touchVelocities.current) {
            averageVelocityX += velocity.x;
            averageVelocityY += velocity.y;
        }
        let touchVelocitiesLength = touchVelocities.current.length;
        // Translate the stage with momentum if the touch velocities are not empty
        if (touchVelocitiesLength > 0) {
            averageVelocityX /= touchVelocities.current.length;
            averageVelocityY /= touchVelocities.current.length;
            // Make container not interactive.
            // container.current.interactive = false;
            // container.current.interactiveChildren = false;
            // Await momentum translation
            await momentumTranslation(averageVelocityX, averageVelocityY);
            // Make container interactive again
            // container.current.interactive = true;
            // container.current.interactiveChildren = true;
            // Empty touch velocities
            touchVelocities.current = [];
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
        isPinching.current = true;
        previousScale.current = 1;
    };

    // Create handler for pinch. The handler of pinch does the exact same thing as the handler for mouse wheel, but the
    // delta is computed differently.
    const handlePinch = (event) => {
        // Reject pinch if the scale is 0
        if (event.scale === 0)
            return;
        // Delta is the difference between the current scale and the previous scale
        const delta = event.scale - previousScale.current;
        // Update previous scale
        previousScale.current = event.scale;
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
            effectiveWidth.current = (realMaxX.current - realMinX.current) / (2 ** zoomLevel.current);
            effectiveHeight.current = (maxY.current - minY.current) / (2 ** zoomLevel.current);
            updateStage();
            // updateStageThrottled();
            return;
        } else if (zoomLevel.current === 0 && depth.current + delta < 0) {
            // Keep depth at 0
            depth.current = 0;
            effectiveWidth.current = (realMaxX.current - realMinX.current);
            effectiveHeight.current = (maxY.current - minY.current);
            updateStage();
            // updateStageThrottled();
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
        effectiveWidth.current = (realMaxX.current - realMinX.current) / (2 ** (zoomLevel.current + depth.current));
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
        updateStage();
        // updateStageThrottled();
    }


    return (
        <></>
    );
}


export default ClustersMap;