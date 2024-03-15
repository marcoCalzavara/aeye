import {useEffect, useRef} from 'react';
import * as PIXI from "pixi.js";
import Hammer from "hammerjs";
import {useApp} from "@pixi/react";
import {LRUCache} from "lru-cache";
import 'tailwindcss/tailwind.css';
import {
    convertIndexToTile,
    getTilesForTranslationTicker,
    getTilesForZoomTicker,
    getTilesFromZoomLevel,
    getTilesToFetch
} from "./utilities";
import {getUrlForImage} from "../utilities";
import {KawaseBlurFilter} from "@pixi/filter-kawase-blur";

const DURATION = 2; // seconds
const SPRITEPOOLSIZE = 800;
// const BLUR_RADIUS_MIN = 0.1;
const BLUR_RADIUS_MAX = 5;
const BLUR_RADIUS_CAROUSEL = 3;
// const NUM_BLUR_RADII = 10;
// const BLUR_RADII = Array.from({length: NUM_BLUR_RADII}, (_, i) => BLUR_RADIUS_MIN + i * (BLUR_RADIUS_MAX - BLUR_RADIUS_MIN) / (NUM_BLUR_RADII - 1));
const QUALITY = 5;
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
    // Define map for knowing if a sprite is in the foreground
    const spriteIsInForeground = useRef(new Map());
    // Define sprite pool of available sprites
    const spritePool = useRef(new Array(SPRITEPOOLSIZE));
    // Define max width and height of a sprite. These values depend on the size of the viewport.
    const maxWidth = useRef(props.width / 10);
    const maxHeight = useRef(props.height / 11);
    // Define refs for height and width of the stage and of the embedding space, and also for the overflowX.
    const stageWidth = useRef(props.stageWidth);
    const stageHeight = useRef(props.stageHeight);
    const width = useRef(props.width);
    const height = useRef(props.height);
    const overflowX = useRef(Math.round(props.overflowX / 2));
    const overflowY = useRef(Math.round(props.overflowY / 2));
    // Define state for limits of embedding space. These values are initialized when the component is mounted and never change.
    const minX = useRef(0);
    const maxX = useRef(0);
    const minY = useRef(0);
    const maxY = useRef(0);
    const realMinX = useRef(0);
    const realMaxX = useRef(0);
    const realMinY = useRef(0);
    const realMaxY = useRef(0);
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
    const app = useApp();
    // Create container for the foreground
    const containerForeground = useRef(null);
    // Create container for the background
    const containerBackground = useRef(null);
    // Create container for when the other container is disabled
    const containerForCarousel = useRef(new PIXI.Container());
    // Define hammer
    const hammer = useRef(null);
    // Define state for previous scale for pinching
    const previousScale = useRef(1);
    // Create a ref that will store the current value of showCarousel
    const showCarouselRef = useRef(props.showCarousel);
    const prevShowCarouselRef = useRef(props.showCarousel);
    // Create a ref that will store the current value of the clicked search bar
    const searchBarIsClickedRef = useRef(props.searchBarIsClicked);
    const touchStartPositionSprite = useRef({x: 0, y: 0});
    const touchPrevTime = useRef(0);
    const touchPrevPos = useRef({x: 0, y: 0});
    const touchVelocities = useRef([]);
    const countOfPinching = useRef(0);
    // Define ref for momentum translation ticker
    const momentum_translation_ticker = useRef(null);
    // Define ref for total movement for activation of the momentum translation ticker
    const totalMovement = useRef(0);
    // Define ref for first render completion
    const firstRenderCompleted = useRef(false);

    const mapGlobalCoordinatesToStageCoordinates = (global_x, global_y) => {
        // Map global coordinates to stage coordinates
        const stage_x = ((global_x - effectivePosition.current.x) * (width.current - maxWidth.current)) / effectiveWidth.current - overflowX.current;
        const stage_y = ((global_y - effectivePosition.current.y) * (height.current - maxHeight.current)) / effectiveHeight.current - overflowY.current;
        return {
            x: Math.round(stage_x),
            y: Math.round(stage_y)
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
                sprite.zIndex = 10;
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

    const moveSpriteToForeground = (index) => {
        // Remove sprite from background container
        containerBackground.current.removeChild(sprites.current.get(index));
        // Add sprite to foreground container
        containerForeground.current.addChild(sprites.current.get(index));
        // Change entry in spriteIsInForeground
        spriteIsInForeground.current.set(index, true);
    }

    const moveSpriteToBackground = (index) => {
        // Remove sprite from foreground container
        containerForeground.current.removeChild(sprites.current.get(index));
        // Add sprite to background container
        containerBackground.current.addChild(sprites.current.get(index));
        // Change entry in spriteIsInForeground
        spriteIsInForeground.current.set(index, false);
    }

    const applyBlur = () => {
        if (!searchBarIsClickedRef.current) {
            // The searchbar has not been clicked yet, activate blur filter on the foreground container,
            // keep the background container with blur filter active.
            containerForeground.current.filters[0].enabled = true;
            prevShowCarouselRef.current = showCarouselRef.current;
            return;
        }
        if (props.showCarousel) {
            // Activate blur filters for the sprites in the foreground
            for (let child of containerForeground.current.children)
                child.filters[0].enabled = true;
            // Compute the blur that the background container should have
            if (depth.current >= 0) {
                containerBackground.current.filters[0].blur = BLUR_RADIUS_MAX * (1 - Math.sin(depth.current * Math.PI / 2)) ** 3;
                // containerBackground.current.filters[0].blur = BLUR_RADII[BLUR_RADII.length - 1 - Math.floor(depth.current * (NUM_BLUR_RADII - 1))];
            } else {
                containerBackground.current.filters[0].blur = BLUR_RADIUS_MAX * (1 - Math.sin((1 + depth.current) * Math.PI / 2)) ** 3;
                // containerBackground.current.filters[0].blur = BLUR_RADII[Math.floor((1 + depth.current) * (NUM_BLUR_RADII - 1))];
            }
            // Activate the second blur filter if the blur of the first filter is lower than the blur of the second filter
            containerBackground.current.filters[0].enabled = containerBackground.current.filters[0].blur >= BLUR_RADIUS_CAROUSEL;
            containerBackground.current.filters[1].enabled = containerBackground.current.filters[0].blur < BLUR_RADIUS_CAROUSEL;
            // Make background container not interactive
            containerBackground.current.interactiveChildren = false;
        } else {
            // Deactivate blur filters for the sprites in the foreground
            if (prevShowCarouselRef.current) {
                for (let child of containerForeground.current.children)
                    child.filters[0].enabled = false;
            }
            // Change blur level of the background container
            if (depth.current >= 0) {
                if (BLUR_RADIUS_MAX * (1 - Math.sin(depth.current * Math.PI / 2)) ** 3 !== containerBackground.current.filters[0].blur)
                    containerBackground.current.filters[0].blur = BLUR_RADIUS_MAX * (1 - Math.sin(depth.current * Math.PI / 2)) ** 3;
                // containerBackground.current.filters[0].blur = BLUR_RADII[BLUR_RADII.length - 1 - Math.floor(depth.current * (NUM_BLUR_RADII - 1))];
            } else {
                if (BLUR_RADIUS_MAX * (1 - Math.sin((1 + depth.current) * Math.PI / 2)) ** 3 !== containerBackground.current.filters[0].blur)
                    containerBackground.current.filters[0].blur = BLUR_RADIUS_MAX * (1 - Math.sin((1 + depth.current) * Math.PI / 2)) ** 3;
                // containerBackground.current.filters[0].blur = BLUR_RADII[Math.floor((1 + depth.current) * (NUM_BLUR_RADII - 1))];
            }
            containerBackground.current.interactiveChildren = containerBackground.current.filters[0].blur >= (2 / 5) * BLUR_RADIUS_MAX;
        }
        prevShowCarouselRef.current = showCarouselRef.current;
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
        sprites.current.get(index).height = Math.round(maxHeight.current * scale);
        sprites.current.get(index).width = Math.round(maxHeight.current * scale * aspect_ratio);
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
            // Deactivate blur filter
            if (searchBarIsClickedRef.current && spriteIsInForeground.current.get(index) && showCarouselRef.current) {
                sprite.filters[0].enabled = false;
                sprite.zIndex = 11;
                containerForeground.current.sortChildren();
            }
        });

        sprite.on('mouseleave', () => {
            // Activate blur filter
            if (showCarouselRef.current && spriteIsInForeground.current.get(index)) {
                sprite.filters[0].enabled = true;
                sprite.zIndex = 10;
                containerForeground.current.sortChildren();
            }
        });

        sprite.on('touchstart', (event) => {
            // Get position on the screen where the touch event occurred
            touchStartPositionSprite.current = event.data.getLocalPosition(containerForeground.current);
        });

        sprite.on('touchend', (event) => {
            // Get position on the screen where the touch event occurred
            const touchEndPosition = event.data.getLocalPosition(containerForeground.current);
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

    const addSpriteToStage = (index, path, width, height, global_x, global_y, is_in_previous_zoom_level) => {
        // Get sprite from sprite pool
        let sprite = spritePool.current.pop();
        // Add sprite to sprites
        sprites.current.set(index, sprite);
        // Save global coordinates of the artwork
        spritesGlobalInfo.current.set(index, {
            x: global_x, y: global_y, width: width, height: height, path: path,
            is_in_previous_zoom_level: is_in_previous_zoom_level
        });

        // Define size of sprite
        scaleSprite(index);

        // Define blur filter for the sprite, but deactivate it. The filter is only used for the sprites in the foreground
        // when the carousel is open.
        sprite.filters = [new KawaseBlurFilter(BLUR_RADIUS_CAROUSEL, QUALITY)];
        sprite.filters[0].enabled = false;

        // Get position of artwork in stage coordinates.
        const artwork_position = mapGlobalCoordinatesToStageCoordinates(global_x, global_y);
        // Set position of sprite
        sprite.x = artwork_position.x;
        sprite.y = artwork_position.y;

        // Probably not needed, but leave it here just in case
        sprite.visible = artwork_position.x > -maxHeight.current * width / height
            && artwork_position.x <= stageWidth.current
            && artwork_position.y >= -maxHeight.current
            && artwork_position.y <= stageHeight.current;

        // Add texture to the sprite if the sprite is either in the visible area or in its immediate vicinity
        if (artwork_position.x > - 3 * maxHeight.current * width / height && artwork_position.x <= stageWidth.current + 3 * maxHeight.current * width / height
            && artwork_position.y >= - 3 * maxHeight.current && artwork_position.y <= stageHeight.current + 3 * maxHeight.current)
            sprite.texture = PIXI.Texture.from(getUrlForImage(path, selectedDataset.current, props.host));

        if (!is_in_previous_zoom_level && !(zoomLevel.current === props.maxZoomLevel && depth.current === 0)) {
            // Add sprite to background container
            containerBackground.current.addChild(sprite);
            spriteIsInForeground.current.set(index, false);
        } else {
            // Add sprite to foreground container
            containerForeground.current.addChild(sprite);
            spriteIsInForeground.current.set(index, true);
        }

        // Set sprite handlers
        setSpriteHandlers(sprite, index);
        // Make sprite interactive
        sprite.interactive = true;
        sprite.interactiveChildren = false;
        sprite.cursor = 'pointer';
    }

    const reset = () => {
        // Reset zoom level
        zoomLevel.current = 0;
        depth.current = 0;
        // Remove all children from stage
        app.stage.removeChildren();
        // Set containers to null
        containerForeground.current = null;
        containerBackground.current = null;
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

    const setPropertiesOfCarouselContainer = (container) => {
        container.interactive = true;
        container.zIndex = 1;
        // noinspection all
        container.hitArea = new PIXI.Rectangle(0, 0, stageWidth.current, stageHeight.current);
        // noinspection all
        container
            .on('mousedown', () => props.setShowCarousel(false))
            .on('touchstart', () => props.setShowCarousel(false));
    }

    const setPropertiesOfContainer = (container, zIndex, isForeground) => {
        // Define container pointer
        container.cursor = 'grab';
        // noinspection all
        container.hitArea = new PIXI.Rectangle(0, 0, stageWidth.current, stageHeight.current);
        // noinspection all
        container.filterArea = new PIXI.Rectangle(0, 0, stageWidth.current, stageHeight.current);
        container.zIndex = zIndex;
        container.sortableChildren = true;
        container.interactive = isForeground;
        container.inteactiveChildren = isForeground;
    }

    // useEffect for initialization of the component. This is called every time the selected dataset changes.
    useEffect(() => {
        // Change selected dataset
        selectedDataset.current = props.selectedDataset;
        // Reset everything at the initial state
        reset();

        // Create container for the foreground
        if (!containerForeground.current) {
            // Create container
            containerForeground.current = new PIXI.Container();
            containerForeground.current.filters = [new KawaseBlurFilter(BLUR_RADIUS_CAROUSEL, QUALITY)];
            containerForeground.current.filters[0].enabled = false;
            app.stage.addChild(containerForeground.current);
        }
        if (!containerBackground.current) {
            // Create container
            containerBackground.current = new PIXI.Container();
            // Define first filter for when the carousel is not shown
            containerBackground.current.filters = [new KawaseBlurFilter(BLUR_RADIUS_MAX, QUALITY)];
            // Define second filter for when the carousel is shown
            containerBackground.current.filters.push(new KawaseBlurFilter(BLUR_RADIUS_CAROUSEL, QUALITY));
            app.stage.addChild(containerBackground.current);
        }

        // Set properties of carousel container
        setPropertiesOfCarouselContainer(containerForCarousel.current);

        // Set properties of containers
        setPropertiesOfContainer(containerForeground.current, 3, true);
        setPropertiesOfContainer(containerBackground.current, 2, false);
        // Sort app stage
        app.stage.sortChildren();

        // Populate the sprite pool
        for (let i = 0; i < spritePool.current.length; i++)
            spritePool.current[i] = new PIXI.Sprite(PIXI.Texture.WHITE);

        // Fetch first zoom levels
        fetchFirstTiles(getUrlForFirstTiles(selectedDataset.current, props.host), null, tilesCache.current)
            .then((range) => {
                // Get cluster data for the first zoom level
                const data = tilesCache.current.get("0-0-0");

                // Update the limits of the embedding space
                realMinX.current = range["x_min"];
                realMaxX.current = range["x_max"];
                realMinY.current = range["y_min"];
                realMaxY.current = range["y_max"];

                // Update effective size of the stage
                effectiveWidth.current = realMaxX.current - realMinX.current;
                effectiveHeight.current = realMaxY.current - realMinY.current;

                // Compute overflowX, minX, and maX. We want to allow additional movement in the x direction in order to
                // make all the artworks visible. Do it for the y direction as well.
                const overflowX_embedding_space = Math.max(overflowX.current * effectiveWidth.current / width.current, 0);
                minX.current = realMinX.current - overflowX_embedding_space;
                maxX.current = realMaxX.current + overflowX_embedding_space;
                const overflowY_embedding_space = Math.max(overflowY.current * effectiveHeight.current / height.current, 0);
                minY.current = realMinY.current - overflowY_embedding_space;
                maxY.current = realMaxY.current + overflowY_embedding_space;

                // Update the effective position of the stage
                effectivePosition.current.x = realMinX.current;
                effectivePosition.current.y = realMinY.current;

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
                        true
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
                                data[i]["in_previous"]
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
            hammer.current = new Hammer(app.view);
            // Disable all gestures except pinch
            hammer.current.get('tap').set({enable: false});
            hammer.current.get('press').set({enable: false});
            hammer.current.get('rotate').set({enable: false});
            hammer.current.get('pan').set({enable: false});
            hammer.current.get('swipe').set({enable: false});
            hammer.current.get('pinch').set({enable: true});
            hammer.current.on('pinchstart', handlePinchStart);
            hammer.current.on('pinchmove', handlePinch);

            // Add all handlers to the stage
            containerForeground.current
                .on("mouseleave", handleMouseUpOrLeave)
                .on('mousedown', handleMouseDown)
                .on('mouseup', handleMouseUpOrLeave)
                .on('mousemove', handleMouseMove)
                .on('wheel', handleMouseWheel)
                .on('touchmove', handleTouchMove)
                .on('touchend', handleTouchEnd)
                .on('touchstart', handleTouchStart);

            // First render completed
            firstRenderCompleted.current = true;
        });
    }, [props.selectedDataset]);

    useEffect(() => {
        // Update ref for clicked search bar
        searchBarIsClickedRef.current = props.searchBarIsClicked;
        // Enable or disable blur filter on the foreground container
        containerForeground.current.filters[0].enabled = !props.searchBarIsClicked;
        // Blur containers
        applyBlur();
    }, [props.searchBarIsClicked]);

    useEffect(() => {
        if (!firstRenderCompleted.current) return;
        // Update ref for stage width and height and width and height of the embedding space, and also for the overflow.
        stageWidth.current = props.stageWidth;
        stageHeight.current = props.stageHeight;
        width.current = props.width;
        height.current = props.height;
        overflowX.current = Math.round(props.overflowX / 2);
        overflowY.current = Math.round(props.overflowY / 2);

        // Resize container and set hit area
        // noinspection all
        containerForeground.current.hitArea = new PIXI.Rectangle(0, 0, stageWidth.current, stageHeight.current);
        // noinspection all
        containerBackground.current.hitArea = new PIXI.Rectangle(0, 0, stageWidth.current, stageHeight.current);

        // Save current minX, maxX, minY, maxY
        const prevMinX = minX.current;
        const prevMaxX = maxX.current;
        const prevMinY = minY.current;
        const prevMaxY = maxY.current;

        // Update minX, maxX, minY, maxY
        const overflowX_embedding_space = Math.max(overflowX.current * effectiveWidth.current / width.current, 0);
        minX.current = realMinX.current - overflowX_embedding_space;
        maxX.current = realMaxX.current + overflowX_embedding_space;
        const overflowY_embedding_space = Math.max(overflowY.current * effectiveHeight.current / height.current, 0);
        minY.current = realMinY.current - overflowY_embedding_space;
        maxY.current = realMaxY.current + overflowY_embedding_space;

        // // Update effective position of the stage.
        let factor = (maxX.current - minX.current) === (prevMaxX - prevMinX) ? 1 : (maxX.current - minX.current) / (prevMaxX - prevMinX);
        effectivePosition.current.x = factor * (effectivePosition.current.x - prevMinX) + minX.current;
        factor = (maxY.current - minY.current) === (prevMaxY - prevMinY) ? 1 : (maxY.current - minY.current) / (prevMaxY - prevMinY);
        effectivePosition.current.y = factor * (effectivePosition.current.y - prevMinY) + minY.current;

        // Update max width and height of a sprite and update all sprites
        maxWidth.current = width.current / 10;
        maxHeight.current = height.current / 11;

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
        // Update stage
        updateStage();
    }, [props.width, props.height, props.overflowX, props.overflowY, props.stageWidth, props.stageHeight]);

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
        containerForeground.current.interactive = !props.showCarousel;
        containerBackground.current.interactive = !props.showCarousel;
        if (hammer.current) {
            hammer.current.get('pinch').set({enable: !props.showCarousel});
        }
        if (props.showCarousel) {
            // Add containerForCarousel to stage
            app.stage.addChild(containerForCarousel.current);
            app.stage.sortChildren();
        } else {
            // Remove containerForCarousel from stage
            app.stage.removeChild(containerForCarousel.current);
            app.stage.sortChildren();
        }

        // Set mouse down to false
        mouseDown.current = false;
        containerForeground.current.cursor = 'grab';

        // Blur the containers
        applyBlur();
    }, [props.showCarousel]);

    const removeSprite = (index) => {
        // Remove every event handler from sprite
        sprites.current.get(index).removeAllListeners();
        // Reset texture of sprite
        sprites.current.get(index).texture = PIXI.Texture.WHITE;
        // Remove filters from sprite
        sprites.current.get(index).filters = null;
        // Remove sprite from stage
        if (spriteIsInForeground.current.get(index)) {
            containerForeground.current.removeChild(sprites.current.get(index));
        } else {
            containerBackground.current.removeChild(sprites.current.get(index));
        }
        // Remove entrance from spriteIsInForeground
        spriteIsInForeground.current.delete(index);
        // Add sprite back to sprite pool
        spritePool.current.push(sprites.current.get(index));
        // Remove sprite from sprites
        sprites.current.delete(index);
        // Remove sprite from spritesGlobalInfo
        spritesGlobalInfo.current.delete(index);
    }

    const updateStage = (is_ticker = 0) => {
        // is_ticker is 0 for normal behavior, 1 for translation ticker, 2 for zoom ticker
        // Get zoom level. Obs: We keep as tiles on stage the tiles at the next zoom level. This is because these tiles
        // also contain the artworks from the current zoom level.
        const next_zoom_level = Math.min(depth.current >= 0 ? zoomLevel.current + 1 : zoomLevel.current, props.maxZoomLevel);
        const current_zoom_level = Math.max(depth.current > 0 ? zoomLevel.current : zoomLevel.current - 1, 0);

        const number_of_tiles = 2 ** next_zoom_level;
        const tile_step_x = (maxX.current - minX.current) / number_of_tiles;
        const tile_step_y = (maxY.current - minY.current) / number_of_tiles;
        const tile_step_x_for_sprites = (realMaxX.current - realMinX.current) / number_of_tiles;
        const tile_step_y_for_sprites = (realMaxY.current - realMinY.current) / number_of_tiles;

        // Get tile coordinates of the tile that contains the upper left corner of the stage.
        const tile_x = Math.min(Math.max(Math.floor((effectivePosition.current.x - minX.current) / tile_step_x), 0), number_of_tiles - 1);
        const tile_y = Math.min(Math.max(Math.floor((effectivePosition.current.y - minY.current) / tile_step_y), 0), number_of_tiles - 1);

        // Get indexes of tiles to fetch
        let indexes;
        if (is_ticker === 0) {
            indexes = getTilesToFetch(tile_x, tile_y, next_zoom_level, props.maxZoomLevel, tilesCache.current);
        } else if (is_ticker === 1) {
            // Translation ticker behavior. Fetch only tiles at the current zoom level.
            indexes = getTilesForTranslationTicker(tile_x, tile_y, next_zoom_level, tilesCache.current);
        } else if (is_ticker === 2) {
            // Zoom ticker behavior. Fetch tiles at the next zoom level.
            indexes = getTilesForZoomTicker(tile_x, tile_y, next_zoom_level, props.maxZoomLevel, tilesCache.current);
        }

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
                    const tile_x = Math.min(Math.max(Math.floor((spriteGlobalPosition.x - realMinX.current) / tile_step_x_for_sprites), 0), number_of_tiles - 1);
                    const tile_y = Math.min(Math.max(Math.floor((spriteGlobalPosition.y - realMinY.current) / tile_step_y_for_sprites), 0), number_of_tiles - 1);
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
        let count_visible = 0;
        visible_tiles.map(async tile => {
            // Stop execution if the tilesCache does not contain the tile
            if (!tilesCache.current.has(next_zoom_level + "-" + tile.x + "-" + tile.y))
                await Promise.all(unresolvedPromises.current);

            // Get data from tilesCache
            const data = tilesCache.current.get(next_zoom_level + "-" + tile.x + "-" + tile.y);

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
                    count_visible += sprites.current.get(index).visible ? 1 : 0;
                } else {
                    spritesGlobalInfo.current.get(index).is_in_previous_zoom_level = data[j]["in_previous"];

                    // Check if sprite should be moved to the foreground or background
                    if (!spritesGlobalInfo.current.get(index).is_in_previous_zoom_level && !(zoomLevel.current === props.maxZoomLevel && depth.current === 0)) {
                        // Move sprite to background
                        if (spriteIsInForeground.current.get(index))
                            moveSpriteToBackground(index);
                    } else {
                        if (!spriteIsInForeground.current.get(index))
                            moveSpriteToForeground(index);
                    }

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

                    // Set size of sprite
                    scaleSprite(index);

                    // Make sprite not visible if outside the viewing area
                    const aspect_ratio = spritesGlobalInfo.current.get(index).width / spritesGlobalInfo.current.get(index).height;
                    sprites.current.get(index).visible = sprites.current.get(index).x > -maxHeight.current * aspect_ratio
                        && sprites.current.get(index).x <= stageWidth.current
                        && sprites.current.get(index).y >= -maxHeight.current
                        && sprites.current.get(index).y <= stageHeight.current;

                    count_visible += sprites.current.get(index).visible ? 1 : 0;

                    // Add texture to the sprite if the sprite is either in the visible area or in its immediate vicinity
                    if (artwork_position.x > - 3 * maxHeight.current * aspect_ratio && artwork_position.x <= stageWidth.current + 3 * maxHeight.current * aspect_ratio
                        && artwork_position.y >= - 3 * maxHeight.current && artwork_position.y <= stageHeight.current + 3 * maxHeight.current)
                        if (sprites.current.get(index).texture === PIXI.Texture.WHITE)
                            // Change texture of sprite
                            sprites.current.get(index).texture = PIXI.Texture.from(getUrlForImage(spritesGlobalInfo.current.get(index).path,
                                selectedDataset.current, props.host)
                            );
                }
            }
            // Save artworks in tiles
            // noinspection JSUnresolvedVariable
            tilesOnStage.current.set(next_zoom_level + "-" + tile.x + "-" + tile.y,
                data.map(entity => entity["index"]));
        });

        // Log for debugging
        // console.log("Count: ", count, "Count visible: ", count_visible);

        // Apply blur
        applyBlur();

        // Do asserts to check that everything is correct
        console.assert(count === sprites.current.size);
        console.assert(containerForeground.current.children.length
            + containerBackground.current.children.length === sprites.current.size);
        console.assert(sprites.current.size === spritesGlobalInfo.current.size);
        console.assert(sprites.current.size + spritePool.current.length === SPRITEPOOLSIZE);
    }

    // const updateStageThrottled = throttle(updateStage, 50);

    const changeLimitsOfEmbeddingSpace = () => {
        // Change the effective size of the stage.
        effectiveWidth.current = (realMaxX.current - realMinX.current) / (2 ** (zoomLevel.current + depth.current));
        effectiveHeight.current = (realMaxY.current - realMinY.current) / (2 ** (zoomLevel.current + depth.current));
        // Change the limits of the embedding space
        minX.current = realMinX.current - Math.max(overflowX.current * effectiveWidth.current / width.current, 0);
        maxX.current = realMaxX.current + Math.max(overflowX.current * effectiveWidth.current / width.current, 0);
        minY.current = realMinY.current - Math.max(overflowY.current * effectiveHeight.current / height.current, 0);
        maxY.current = realMaxY.current + Math.max(overflowY.current * effectiveHeight.current / height.current, 0);
    }

    // Create function for making the sprite pulse once it becomes available
    function pulseIfAvailable(spriteIndex) {
        const sprite = sprites.current.get(spriteIndex);
        if (sprite) {
            // Put sprite in front
            sprite.zIndex = 11;
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
                    updateStage(1);
                }
            });

            translation_ticker.start();
        });
    }

    // Create function for managing zoom ticker
    const awaitZoomTicker = (tile, image) => {
        // Compute total depth that has to be added or subtracted to get to the correct zoom level.
        let total_depth = tile[0] - zoomLevel.current - depth.current;
        // Compute total number of steps
        let total_steps = Math.ceil(Math.abs(total_depth) / DEPTH_STEP);

        if (total_steps === 0) {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const zoom_ticker = new PIXI.Ticker();
            // Define counter for number of steps
            let counter = 0;

            zoom_ticker.add(() => {
                if (counter === total_steps) {
                    // Stop ticker
                    zoom_ticker.stop();
                    // Update stage
                    updateStage();
                    resolve();
                } else {
                    // Change depth by DEPTH_STEP
                    let delta;
                    if (counter !== total_steps - 1) {
                        delta = Math.sign(total_depth) * DEPTH_STEP;
                        depth.current += delta;

                        // Change zoom level if delta is bigger than or equal to 1 in absolute value
                        if (Math.abs(depth.current) >= 1) {
                            // Change zoom level
                            zoomLevel.current += Math.sign(depth.current);
                            // Change depth
                            depth.current += depth.current > 0 ? -1 : 1;
                        }
                    }
                    else {
                        // Compute delta remaining
                        delta = total_depth > 0 ? total_depth - (total_steps - 1) * DEPTH_STEP : total_depth + (total_steps - 1) * DEPTH_STEP;
                        depth.current = 0;
                        zoomLevel.current = tile[0];
                    }

                    // First, compute the new effective position and effective size of the stage.
                    // Get translation of the mouse position from the upper left corner of the stage in global coordinates
                    const translation_x = image.x - effectivePosition.current.x
                    const translation_y = image.y - effectivePosition.current.y;

                    changeLimitsOfEmbeddingSpace();

                    // Change the effective position of the stage. Make sure that it does not exceed the limits of the embedding space.
                    // The translation of the mouse is adjusted so that the mouse position in global coordinates remains the same.
                    effectivePosition.current.x = Math.max(
                        Math.min(image.x - translation_x * 2 ** (-delta), maxX.current -
                            effectiveWidth.current), minX.current);
                    effectivePosition.current.y = Math.max(
                        Math.min(image.y - translation_y * 2 ** (-delta), maxY.current -
                            effectiveHeight.current), minY.current);

                    // Update counter
                    counter++;
                    // Update stage
                    updateStage(2);
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
        containerForeground.current.interactive = false;
        containerForeground.current.interactiveChildren = false;
        containerBackground.current.interactive = false;
        containerBackground.current.interactiveChildren = false;

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
            containerForeground.current.interactive = true;
            containerForeground.current.interactiveChildren = true;
            containerBackground.current.interactive = true;
            containerBackground.current.interactiveChildren = true;
        }, DURATION * 1000 + 10);
    }

    // Create handler for mouse down
    const handleMouseDown = (event) => {
        if (!searchBarIsClickedRef.current)
            return;

        // Stop ticker
        if (momentum_translation_ticker.current !== null) {
            momentum_translation_ticker.current.stop();
            momentum_translation_ticker.current.destroy();
            momentum_translation_ticker.current = null;
        }
        // Set mouse down to true
        containerForeground.current.cursor = 'grabbing';
        mouseDown.current = true;
        // Reset velocities
        touchVelocities.current = [];
        // Reset total movement
        totalMovement.current = 0;
        // Reset start time
        touchPrevTime.current = Date.now();
        // Set mouse position
        touchPrevPos.current = event.data.getLocalPosition(containerForeground.current);
    }

    // Create handler for mouse up
    const handleMouseUpOrLeave = () => {
        if (!mouseDown.current || totalMovement.current < 2) {
            mouseDown.current = false;
            return;
        }
        // Set mouse down to false
        mouseDown.current = false;
        containerForeground.current.cursor = 'grab';

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
            // Await momentum translation
            momentumTranslation(averageVelocityX, averageVelocityY, 10);
        }
    }

    // Create handler for mouse move
    const handleMouseMove = (event) => {
        // If mouse is down, then move the stage
        if (mouseDown.current) {
            // Update velocities
            updateVelocities(event);
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
        // Stop ticker
        if (momentum_translation_ticker.current !== null) {
            momentum_translation_ticker.current.stop();
            momentum_translation_ticker.current.destroy();
            momentum_translation_ticker.current = null;
        }
        // Save touch position
        touchPrevPos.current = event.data.getLocalPosition(containerForeground.current);
        // Save touch start time
        touchPrevTime.current = Date.now();
        // Set total movement to 0
        totalMovement.current = 0;
        // Reset touch velocities
        touchVelocities.current = [];
    }

    const updateVelocities = (event) => {
        // Compute velocity
        const touchCurrPos = event.data.getLocalPosition(containerForeground.current);
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
        // Increase total movement
        totalMovement.current += Math.sqrt((touchCurrPos.x - touchPrevPos.current.x) ** 2 +
            (touchCurrPos.y - touchPrevPos.current.y) ** 2);
        // Save touch position
        touchPrevPos.current = touchCurrPos;
        // Save touch start time
        touchPrevTime.current = touchCurrTime;
    }

    // Create handler for touch move
    const handleTouchMove = (event) => {
        // Update velocities
        updateVelocities(event);
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

    const momentumTranslation = (averageVelocityX, averageVelocityY, multiplicativeFactor) => {
        const frames = 40;
        // Change multiplicative factor based on width and height of the stage
        multiplicativeFactor *= Math.max(1000 / stageWidth.current, 1);
        // Transform velocities, which are in pixels per millisecond, to velocities in the embedding space.
        averageVelocityX *= (effectiveWidth.current * multiplicativeFactor) / width.current;
        averageVelocityY *= (effectiveHeight.current * multiplicativeFactor) / height.current;

        momentum_translation_ticker.current = new PIXI.Ticker();
        // Define counter for number of steps
        let counter = 0;
        momentum_translation_ticker.current.add(() => {
            // Check if position is equal to the target position.
            if (counter === frames) {
                // Stop ticker
                if (momentum_translation_ticker.current !== null) {
                    momentum_translation_ticker.current.stop();
                    // Update stage
                    updateStage();
                }
            } else {
                effectivePosition.current.x = Math.max(
                    Math.min(effectivePosition.current.x - averageVelocityX, maxX.current - effectiveWidth.current), minX.current);
                effectivePosition.current.y = Math.max(
                    Math.min(effectivePosition.current.y - averageVelocityY, maxY.current - effectiveHeight.current), minY.current);
                // Increment counter
                counter++;
                // Decrease velocity
                averageVelocityX *= 0.97;
                averageVelocityY *= 0.97;
                // Update stage
                updateStage();
            }
        });
        momentum_translation_ticker.current.start();
    }

    const handleTouchEnd = async () => {
        if (countOfPinching.current > 0) {
            touchVelocities.current = [];
            countOfPinching.current -= 1;
            return;
        }
        if (totalMovement.current < 20)
            return;

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
            // Start momentum translation
           momentumTranslation(averageVelocityX, averageVelocityY, 6);
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
        countOfPinching.current += 1;
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
        const position = event.data.getLocalPosition(containerForeground.current);
        if (Math.abs(delta) > 0.01) {
            // Create zoom ticker to complete the transition by delta in steps of 0.002
            const zoom_ticker = new PIXI.Ticker();
            let current_delta = 0;
            zoom_ticker.add(() => {
                if (Math.abs(current_delta) >= Math.abs(delta)) {
                    zoom_ticker.stop();
                } else {
                    handleZoom(Math.sign(delta) * 0.004, position);
                    current_delta += Math.sign(delta) * 0.004;
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
            changeLimitsOfEmbeddingSpace();
            updateStage();
            // updateStageThrottled();
            return;
        } else if (zoomLevel.current === 0 && depth.current + delta < 0) {
            // Keep depth at 0
            depth.current = 0;
            changeLimitsOfEmbeddingSpace();
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
        // When |depth| < 1, we are in an intermediate state between zoom levels, but the data shown always belongs to
        // the finer grained zoom level. Hence, as soon as delta becomes bigger than 0, get the data from the next
        // zoom level. If on the other hand delta becomes smaller than 0, keep current data and start transitioning to
        // the next zoom level.
        // Observation: the position of the mouse in global coordinates must remain the same after zooming in/out.

        // First, compute the new effective position and effective size of the stage.
        // Get translation of the mouse position from the upper left corner of the stage in global coordinates
        const translation_x = global_mouse_position.x - effectivePosition.current.x
        const translation_y = global_mouse_position.y - effectivePosition.current.y;

        changeLimitsOfEmbeddingSpace();

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