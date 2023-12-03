import {useEffect, useRef} from 'react';
import * as PIXI from "pixi.js";
import {useApp} from "@pixi/react";
import {DATASET} from "./Cache";


const maxZoomLevel = 7;


export function fetchClusterData(zoom_level, image_x, image_y, host = "") {
    const url = `${host}/api/clusters?zoom_level=${zoom_level}&tile_x=${image_x}&tile_y=${image_y}&collection=${DATASET}_zoom_levels_clusters`;
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
    const spritesGlobalCoordinates = useRef(new Map());
    // Define sprite pool of available sprites
    const spritePool = useRef(new Array(500));
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
    // Define boolean for useEffect to make sure that it is called only once
    const firstRender = useRef(true);
    // Define state for artworks in tiles
    const artworksInTiles = useRef(new Map());

    // Define state for the app
    const app = useApp()
    // Create container for the stage
    const container = useRef(null);

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


    const addSpriteToStage = (index, path, width, height, global_x, global_y, num_of_entities) => {
        // Get sprite from sprite pool
        const sprite = spritePool.current.pop();
        // Update sprite
        sprite.texture = PIXI.Texture.from(props.host + "/" + DATASET + "/resized_images/" + path);
        // Save global coordinates of the artwork
        spritesGlobalCoordinates.current.set(index, {x: global_x, y: global_y});

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

        // TODO modify this as some images disappear too early
        // Make sprite not visible if outside the stage
        sprite.visible = artwork_position.x >= -maxWidth.current
            && artwork_position.x <= props.width
            && artwork_position.y >= -maxHeight.current
            && artwork_position.y <= props.height;

        // On click, create rectangle with the sprite inside on the right and some text on the left. Make everything unclickable,
        // such that the user has to click on the rectangle to close it. The rectangle should be at the center of the screen,
        // and it should appear smoothly on click on the sprite.
        sprite.interactive = true;
        sprite.cursor = 'pointer';
        sprite.on('click', () => {
            // Make container not interactive
            container.current.interactive = false;
            container.current.interactiveChildren = false;
            container.current.hitArea = null;
            // Create rectangle
            const increase_factor = 3.5;
            const rectangle = new PIXI.Graphics();
            rectangle.beginFill("rgb(39,39,42)");
            rectangle.drawRoundedRect(0, 0, sprite.width * increase_factor + props.width / 6 + 40,
                sprite.height * increase_factor + 40, 7);
            rectangle.endFill();
            // Place it at the center of the screen
            rectangle.x = props.width / 2 - sprite.width * increase_factor / 2 - props.width / 12 - 20;
            rectangle.y = props.height / 2 - sprite.height * increase_factor / 2;
            // Set mode and cursor type
            rectangle.interactive = true;
            rectangle.cursor = 'pointer';
            // Define function for closing the rectangle
            rectangle.on('pointerdown', () => {
                app.stage.removeChild(rectangle);
                container.current.interactive = true;
                container.current.interactiveChildren = true;
                container.current.hitArea = new PIXI.Rectangle(0, 0, props.width, props.height);
            });
            // Add sprite to rectangle
            const sprite_inside = new PIXI.Sprite();
            sprite_inside.texture = PIXI.Texture.from(props.host + "/" + DATASET + "/" + path);
            sprite_inside.width = sprite.width * increase_factor;
            sprite_inside.height = sprite.height * increase_factor;
            sprite_inside.x = props.width / 6 + 20;
            sprite_inside.y = 20;
            rectangle.addChild(sprite_inside);
            // Extract author from path. The path has the form index-Name_separated_by_underscores.jpg. Remove jpg and initial and
            // trailing spaces.
            const author = path.split("-")[1].split(".")[0].replace(/_/g, " ").trim();
            // Create text and add it to rectangle
            let str = "The author of the artwork is " + author + ".\n\n" + "The artwork is " + width + " pixels wide and " +
                height + " pixels high.\n\n";
            if (num_of_entities !== 0)
                str += "The artwork is part of a cluster of " + num_of_entities + " artworks.";
            else
                str += "The artwork is not part of any cluster.";
            const text = new PIXI.Text(str,{
                fontFamily: 'Arial', fontSize: 14, fill: 0xffffff, align: 'center',
                wordWrap: true, wordWrapWidth: props.width / 6 - 20, _align: "left"
            });
            text.x = 20;
            text.y = 20;
            rectangle.addChild(text);
            app.stage.addChild(rectangle);
        });

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

    // Create useEffect for initialization of the component. This is called only once when the component is mounted.
    useEffect(() => {
        if (!firstRender.current) {
            console.log("ClustersMap useEffect called more than once");
            return;
        }
        firstRender.current = false;

        container.current = new PIXI.Container();
        app.stage.addChild(container.current);

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
        fetchClusterData(zoomLevel.current, 0, 0, props.host)
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
                        data["clusters_representatives"]["entities"][i]["number_of_entities"]
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
    }, []);

    const updateStage = () => {
        // Get tile coordinates of the visible tiles
        const number_of_tiles = 2 ** zoomLevel.current;
        const tile_step_x = (maxX.current - minX.current) / number_of_tiles;
        const tile_step_y = (maxY.current - minY.current) / number_of_tiles;
        // Get all tiles that are visible. We can have at most 4 tiles that are visible.
        const visible_tiles = [];
        // Get tile coordinates of the tile that contains the upper left corner of the stage
        const tile_x = Math.min(Math.floor((effectivePosition.current.x - minX.current) / tile_step_x), number_of_tiles - 1);
        const tile_y = Math.min(Math.floor((effectivePosition.current.y - minY.current) / tile_step_y), number_of_tiles - 1);
        visible_tiles.push({x: tile_x, y: tile_y});
        // Get all neighboring tiles if possible. This means tiles (tile_x - 1, tile_y), (tile_x, tile_y - 1),
        // (tile_x - 1, tile_y - 1), (tile_x + 1, tile_y), (tile_x, tile_y + 1), (tile_x + 1, tile_y + 1),
        // (tile_x - 1, tile_y + 1), (tile_x + 1, tile_y - 1).
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
        if (tile_y > 0) {
            visible_tiles.push({x: tile_x, y: tile_y - 1});
        }
        if (tile_y < number_of_tiles - 1) {
            visible_tiles.push({x: tile_x, y: tile_y + 1});
        }

        // Remove tiles and sprites of tiles that are not visible
        for (let tile of artworksInTiles.current.keys()) {
            if (!(zoomLevel.current === parseInt(tile.split("-")[0])) || !visible_tiles.some(visible_tile =>
                visible_tile.x === parseInt(tile.split("-")[1]) && visible_tile.y === parseInt(tile.split("-")[2]))) {
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
                        // Remove sprite from spritesGlobalCoordinates
                        spritesGlobalCoordinates.current.delete(index);
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
                spritesGlobalCoordinates.current.get(index).x,
                spritesGlobalCoordinates.current.get(index).y
            );
            // Make sprite not visible if outside the stage
            sprites.current.get(index).visible = artwork_position.x > -maxWidth.current
                && artwork_position.x <= props.width
                && artwork_position.y >= -maxHeight.current
                && artwork_position.y <= props.height;

            // Update position of sprite
            sprites.current.get(index).x = artwork_position.x;
            sprites.current.get(index).y = artwork_position.y;
        }

        // Fetch data for the visible tiles
        visible_tiles.map(tile => {
            // If tile is in previousTileCoordinates, then we do not need to fetch data for it.
            if (!artworksInTiles.current.has(zoomLevel.current + "-" + tile.x + "-" + tile.y)) {
                // The tile is not in previousTileCoordinates. We need to fetch data for it.
                fetchClusterData(zoomLevel.current, tile.x, tile.y, props.host)
                    .then(data => {
                        // Loop over artworks in tile and add them to the stage.
                        // noinspection JSUnresolvedVariable
                        for (let j = 0; j < data["clusters_representatives"]["entities"].length; j++) {
                            // Check if the artwork is already on stage. If it is, change its position. If it is not, add it to the stage.
                            if (!sprites.current.has(data["clusters_representatives"]["entities"][j]["representative"]["index"])) {
                                // Add sprite to stage
                                addSpriteToStage(
                                    data["clusters_representatives"]["entities"][j]["representative"]["index"],
                                    data["clusters_representatives"]["entities"][j]["representative"]["path"],
                                    data["clusters_representatives"]["entities"][j]["representative"]["width"],
                                    data["clusters_representatives"]["entities"][j]["representative"]["height"],
                                    data["clusters_representatives"]["entities"][j]["representative"]["low_dimensional_embedding_x"],
                                    data["clusters_representatives"]["entities"][j]["representative"]["low_dimensional_embedding_y"],
                                    data["clusters_representatives"]["entities"][j]["number_of_entities"]
                                );
                            }
                        }
                        // Save artworks in tiles
                        // noinspection JSUnresolvedVariable
                        artworksInTiles.current.set(zoomLevel.current + "-" + tile.x + "-" + tile.y,
                            data["clusters_representatives"]["entities"].map(entity => entity["representative"]["index"]));
                    })
                    .catch(error => {
                        // Handle any errors that occur during the fetch operation
                        console.error('Error:', error);
                    });
            }
        });
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
            const mouse_x = ((- event.movementX) * effectiveWidth.current) / props.width;
            const mouse_y = ((- event.movementY) * effectiveHeight.current) / props.height;
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

    // Create handler for mouse wheel. We change the zoom level only if the user scrolls until a certain value of change in
    // depth is reached. This is to avoid changing the zoom level too often. We use a transition which depends on the percentage
    // of the change in depth in order to make the transition smoother. When the new zoom level is reached, we update
    // everything on the stage.
    const handleMouseWheel = (event) => {
        // Define delta
        const delta = event.deltaY / 200;
        // Measure change in depth
        if (zoomLevel.current === maxZoomLevel && depth.current + delta > 0) {
            // Keep depth at 0
            depth.current = 0;
            return;
        } else if (zoomLevel.current === 0 && depth.current + delta < 0) {
            // Keep depth at 0
            depth.current = 0;
            return;
        }

        depth.current += delta;

        if (Math.abs(depth.current) < 1) {
            // TODO - implement transition
        } else {
            // Invalidate everything when changing zoom level
            for (let tile of artworksInTiles.current.keys()) {
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
                        // Remove sprite from spritesGlobalCoordinates
                        spritesGlobalCoordinates.current.delete(index);
                    }
                }
                // Delete tile from artworksInTiles
                artworksInTiles.current.delete(tile);
            }
            // Change zoom level
            zoomLevel.current += Math.sign(depth.current);
            // Get global coordinates of the mouse
            const global_mouse_position = mapStageCoordinatesToGlobalCoordinates(event.clientX, event.clientY);
            // Get translation of the mouse position from the upper left corner of the stage in global coordinates
            const translation_x = global_mouse_position.x - effectivePosition.current.x
            const translation_y = global_mouse_position.y - effectivePosition.current.y;
            // Change the effective size of the stage.
            effectiveWidth.current = (maxX.current - minX.current) / (2 ** zoomLevel.current);
            effectiveHeight.current = (maxY.current - minY.current) / (2 ** zoomLevel.current);
            // Change the effective position of the stage. Make sure that it does not exceed the limits of the embedding space.
            // The translation of the mouse is adjusted so that the mouse position in global coordinates remains the same.
            effectivePosition.current.x = Math.max(
                Math.min(global_mouse_position.x - translation_x * 2 ** (-Math.sign(depth.current)), maxX.current -
                    effectiveWidth.current), minX.current);
            effectivePosition.current.y = Math.max(
                Math.min(global_mouse_position.y - translation_y * 2 ** (-Math.sign(depth.current)), maxY.current -
                    effectiveHeight.current), minY.current);
            // Reset depth
            depth.current = 0;

            // Update stage
            updateStage();
        }
    }


    return (
        <></>
    );
}


export default ClustersMap;