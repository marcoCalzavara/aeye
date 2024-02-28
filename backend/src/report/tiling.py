"""
Module to visualize tiles.
"""

import matplotlib.pyplot as plt


DIST_STEP = 0.
DEPTH_STEP = 0.5


def get_tiles_from_next_zoom_level_at_border(tile_x, tile_y, zoom_level, max_zoom_level):
    # Get additional frame of tiles at the next zoom level
    new_tiles = []
    if zoom_level + 1 <= max_zoom_level:
        if tile_x > 1:
            tile_x_next_zoom_level = (tile_x - 2) * 2 + 1
            for i in range(-1, 3):
                if 0 <= tile_y + i < 2 ** (zoom_level + 1):
                    new_tiles.append({'x': tile_x_next_zoom_level, 'y': (tile_y + i) * 2, 'zoom': zoom_level + 1})
                    new_tiles.append({'x': tile_x_next_zoom_level, 'y': (tile_y + i) * 2 + 1, 'zoom': zoom_level + 1})
            # Get corner tiles
            if tile_y > 1:
                new_tiles.append({'x': tile_x_next_zoom_level, 'y': (tile_y - 2) * 2 + 1, 'zoom': zoom_level + 1})
            if tile_y + 3 < 2 ** zoom_level:
                new_tiles.append({'x': tile_x_next_zoom_level, 'y': (tile_y + 3) * 2, 'zoom': zoom_level + 1})
        if tile_x + 4 < 2 ** zoom_level:
            tile_x_next_zoom_level = (tile_x + 4) * 2
            for i in range(-1, 3):
                if 0 <= tile_y + i < 2 ** (zoom_level + 1):
                    new_tiles.append({'x': tile_x_next_zoom_level, 'y': (tile_y + i) * 2, 'zoom': zoom_level + 1})
                    new_tiles.append({'x': tile_x_next_zoom_level, 'y': (tile_y + i) * 2 + 1, 'zoom': zoom_level + 1})
            # Get corner tiles
            if tile_y > 1:
                new_tiles.append({'x': tile_x_next_zoom_level, 'y': (tile_y - 2) * 2 + 1, 'zoom': zoom_level + 1})
            if tile_y + 3 < 2 ** zoom_level:
                new_tiles.append({'x': tile_x_next_zoom_level, 'y': (tile_y + 3) * 2, 'zoom': zoom_level + 1})
        if tile_y > 1:
            tile_y_next_zoom_level = (tile_y - 2) * 2 + 1
            for i in range(-1, 4):
                if 0 <= tile_x + i < 2 ** (zoom_level + 1):
                    new_tiles.append({'x': (tile_x + i) * 2, 'y': tile_y_next_zoom_level, 'zoom': zoom_level + 1})
                    new_tiles.append({'x': (tile_x + i) * 2 + 1, 'y': tile_y_next_zoom_level, 'zoom': zoom_level + 1})
        if tile_y + 3 < 2 ** zoom_level:
            tile_y_next_zoom_level = (tile_y + 3) * 2
            for i in range(-1, 4):
                if 0 <= tile_x + i < 2 ** (zoom_level + 1):
                    new_tiles.append({'x': (tile_x + i) * 2, 'y': tile_y_next_zoom_level, 'zoom': zoom_level + 1})
                    new_tiles.append({'x': (tile_x + i) * 2 + 1, 'y': tile_y_next_zoom_level, 'zoom': zoom_level + 1})
    return new_tiles


def get_tiles_from_next_zoom_level(tiles, zoom_level, max_zoom_level):
    new_tiles = []

    if zoom_level + 1 <= max_zoom_level:
        for tile in tiles:
            # The current tile is divided into 4 tiles at the next zoom level
            tile_x_next_zoom_level = tile['x'] * 2
            tile_y_next_zoom_level = tile['y'] * 2
            new_tiles.append({'x': tile_x_next_zoom_level, 'y': tile_y_next_zoom_level, 'zoom': zoom_level + 1})
            new_tiles.append({'x': tile_x_next_zoom_level + 1, 'y': tile_y_next_zoom_level, 'zoom': zoom_level + 1})
            new_tiles.append({'x': tile_x_next_zoom_level, 'y': tile_y_next_zoom_level + 1, 'zoom': zoom_level + 1})
            new_tiles.append({'x': tile_x_next_zoom_level + 1, 'y': tile_y_next_zoom_level + 1, 'zoom': zoom_level + 1})

    return new_tiles


def get_tiles_from_zoom_level(tile_x, tile_y, zoom_level):
    # Get the number of tiles at the current zoom level
    number_of_tiles = 2 ** zoom_level

    tiles = [{'x': tile_x, 'y': tile_y, 'zoom': zoom_level}]
    # Add tiles in same column
    if tile_y > 0:
        tiles.append({'x': tile_x, 'y': tile_y - 1, 'zoom': zoom_level})
    if tile_y < number_of_tiles - 1:
        tiles.append({'x': tile_x, 'y': tile_y + 1, 'zoom': zoom_level})
    if tile_y < number_of_tiles - 2:
        tiles.append({'x': tile_x, 'y': tile_y + 2, 'zoom': zoom_level})

    # Get all neighboring tiles. This means all tiles at a distance of 1, plus tiles at a distance of 2 on the bottom
    # and on the right.
    if tile_x > 0:
        # Go one tile to the left
        tiles.append({'x': tile_x - 1, 'y': tile_y, 'zoom': zoom_level})
        if tile_y > 0:
            tiles.append({'x': tile_x - 1, 'y': tile_y - 1, 'zoom': zoom_level})
        if tile_y < number_of_tiles - 1:
            tiles.append({'x': tile_x - 1, 'y': tile_y + 1, 'zoom': zoom_level})
        if tile_y < number_of_tiles - 2:
            tiles.append({'x': tile_x - 1, 'y': tile_y + 2, 'zoom': zoom_level})

    if tile_x < number_of_tiles - 1:
        # Go one tile to the right
        tiles.append({'x': tile_x + 1, 'y': tile_y, 'zoom': zoom_level})
        if tile_y > 0:
            tiles.append({'x': tile_x + 1, 'y': tile_y - 1, 'zoom': zoom_level})
        if tile_y < number_of_tiles - 1:
            tiles.append({'x': tile_x + 1, 'y': tile_y + 1, 'zoom': zoom_level})
        if tile_y < number_of_tiles - 2:
            tiles.append({'x': tile_x + 1, 'y': tile_y + 2, 'zoom': zoom_level})

    if tile_x < number_of_tiles - 2:
        # Go two tiles to the right
        tiles.append({'x': tile_x + 2, 'y': tile_y, 'zoom': zoom_level})
        if tile_y > 0:
            tiles.append({'x': tile_x + 2, 'y': tile_y - 1, 'zoom': zoom_level})
        if tile_y < number_of_tiles - 1:
            tiles.append({'x': tile_x + 2, 'y': tile_y + 1, 'zoom': zoom_level})
        if tile_y < number_of_tiles - 2:
            tiles.append({'x': tile_x + 2, 'y': tile_y + 2, 'zoom': zoom_level})

    if tile_x < number_of_tiles - 3:
        # Go three tiles to the right
        tiles.append({'x': tile_x + 3, 'y': tile_y, 'zoom': zoom_level})
        if tile_y > 0:
            tiles.append({'x': tile_x + 3, 'y': tile_y - 1, 'zoom': zoom_level})
        if tile_y < number_of_tiles - 1:
            tiles.append({'x': tile_x + 3, 'y': tile_y + 1, 'zoom': zoom_level})
        if tile_y < number_of_tiles - 2:
            tiles.append({'x': tile_x + 3, 'y': tile_y + 2, 'zoom': zoom_level})

    return tiles


def get_tiles(tile_x, tile_y, zoom_level, max_zoom_level):
    # At the current zoom level, consider a 4x4 grid of tiles around the effective window. Then, fetch the same
    # region at the next zoom level and the next zoom level after that.
    tiles = get_tiles_from_zoom_level(tile_x, tile_y, zoom_level)
    tiles_next_zoom_level = get_tiles_from_next_zoom_level(tiles, zoom_level, max_zoom_level)
    tiles_at_border = get_tiles_from_next_zoom_level_at_border(tile_x, tile_y, zoom_level, max_zoom_level)
    tiles_next_zoom_level.extend(tiles_at_border)
    tiles_next_next_zoom_level = get_tiles_from_next_zoom_level(tiles_next_zoom_level, zoom_level + 1, max_zoom_level)
    # Add everything to tiles
    tiles.extend(tiles_next_zoom_level)
    tiles.extend(tiles_next_next_zoom_level)
    # Return the list of tiles
    return tiles


def plot_tiles(tiles):
    """
    Function to plot tiles as 3D rectangles.

    Args:
    tiles (list of tuples): Each tuple contains 3D coordinates in the form (x, y, z, dx, dy, dz).
    """

    # Create a new figure and add a 3D subplot
    fig = plt.figure(figsize=(15, 15))
    ax = fig.add_subplot(111, projection='3d')

    # Define the color and transparency of the rectangles
    color = (0, 0, 1, 0.1)
    edge_color = (1, 1, 1, 1)
    slightly_stronger_color = (0, 0, 1, 0.15)
    stronger_color = (0, 0, 1, 0.2)

    # Find the limits at depth DEPTH_STEP
    min_x_1 = min([tile[0] for tile in tiles if tile[2] == DEPTH_STEP])
    max_x_1 = max([tile[0] for tile in tiles if tile[2] == DEPTH_STEP])
    min_y_1 = min([tile[1] for tile in tiles if tile[2] == DEPTH_STEP])
    max_y_1 = max([tile[1] for tile in tiles if tile[2] == DEPTH_STEP])

    # Find the minimum and maximum values for x and y at depth 2 * DEPTH_STEP
    min_x = min([tile[0] for tile in tiles if tile[2] == 2 * DEPTH_STEP])
    min_y = min([tile[1] for tile in tiles if tile[2] == 2 * DEPTH_STEP])

    # Find the minimum and maximum values for x and y at depth 0
    min_x_2 = min([tile[0] for tile in tiles if tile[2] == 0])
    max_x_2 = max([tile[0] for tile in tiles if tile[2] == 0])
    min_y_2 = min([tile[1] for tile in tiles if tile[2] == 0])
    max_y_2 = max([tile[1] for tile in tiles if tile[2] == 0])

    # Draw each rectangle
    for tile in tiles:
        x, y, z, dx, dy, dz = tile
        if (z == DEPTH_STEP and x == 2 and y == 2) or (z == DEPTH_STEP * 2 and x == min_x and y == min_y):
            # Draw the rectangle at the highest zoom level
            ax.bar3d(x, y, z, dx - DIST_STEP, dy - DIST_STEP, -DEPTH_STEP, color=slightly_stronger_color,
                     edgecolor=edge_color)
        elif (z == DEPTH_STEP and (x == min_x_1 or x == max_x_1 or y == min_y_1 or y == max_y_1)) or \
                (z == 0 * 2 and (x == min_x_2 or x == max_x_2 or y == min_y_2 or y == max_y_2)) or \
                (z == 0 and (x == min_x_2 + 1 or x == max_x_2 - 1 or y == min_y_2 + 1 or y == max_y_2 - 1)):
            # Draw the rectangles at the border of the highest zoom level
            ax.bar3d(x, y, z, dx - DIST_STEP, dy - DIST_STEP, dz, color=stronger_color, edgecolor=edge_color)
        else:
            ax.bar3d(x, y, z, dx - DIST_STEP, dy - DIST_STEP, dz, color=color, edgecolor=edge_color)

    ax.grid(False)
    ax.axis('off')

    # Save the plot
    plt.savefig('tiles.png')


if __name__ == "__main__":
    # Get tiles
    max_zoom_level = 7
    tiles = get_tiles(15, 18, 5, max_zoom_level)
    # Check that there are no duplicates
    assert len(tiles) == len(set([(tile['x'], tile['y'], tile['zoom']) for tile in tiles]))

    # Define list of tiles to plot
    tiles_for_plot = []

    # Find the minimum x and y values at the highest zoom level
    min_tile_x_max_zoom_level = min([tile['x'] for tile in tiles if tile['zoom'] == max_zoom_level])
    min_tile_y_max_zoom_level = min([tile['y'] for tile in tiles if tile['zoom'] == max_zoom_level])
    for tile in tiles:
        if tile['zoom'] == max_zoom_level:
            tiles_for_plot.append((tile['x'] - min_tile_x_max_zoom_level,
                                   tile['y'] - min_tile_y_max_zoom_level, 0, 1, 1, 0))

    for tile in tiles:
        if tile['zoom'] == max_zoom_level - 1:
            # Find tile at next zoom level
            tile_x_next_zoom_level = tile['x'] * 2
            tile_y_next_zoom_level = tile['y'] * 2
            for tile_next_zoom_level in tiles:
                if (tile_next_zoom_level['zoom'] == max_zoom_level
                        and tile_next_zoom_level['x'] == tile_x_next_zoom_level
                        and tile_next_zoom_level['y'] == tile_y_next_zoom_level):
                    # Place the tile over the 4 tiles it generates at the next zoom level
                    tiles_for_plot.append((tile_x_next_zoom_level - min_tile_x_max_zoom_level,
                                           tile_y_next_zoom_level - min_tile_y_max_zoom_level,
                                           DEPTH_STEP, 2, 2, 0))
                    break

    for tile in tiles:
        if tile['zoom'] == max_zoom_level - 2:
            # Find tile at next zoom level
            tile_x_next_zoom_level = tile['x'] * 4
            tile_y_next_zoom_level = tile['y'] * 4
            for tile_next_zoom_level in tiles:
                if (tile_next_zoom_level['zoom'] == max_zoom_level
                        and tile_next_zoom_level['x'] == tile_x_next_zoom_level
                        and tile_next_zoom_level['y'] == tile_y_next_zoom_level):
                    # Place the tile over the 4 tiles it generates at the next zoom level
                    tiles_for_plot.append((tile_x_next_zoom_level - min_tile_x_max_zoom_level,
                                           tile_y_next_zoom_level - min_tile_y_max_zoom_level,
                                           1, 4, 4, 0))
                    break

    # Plot tiles
    plot_tiles(tiles_for_plot)
