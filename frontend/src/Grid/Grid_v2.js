import React, {useEffect, useRef, useState} from 'react';
import {Container, Sprite, Stage, useApp, useTick} from "@pixi/react";
import * as PIXI from "pixi.js";

// In this version of the grid, the images are placed in absolute positions on the stage, and they are not
// assigned to a specific grid cell. Overlapping is then possible.

export default function Grid(props) {
    // Define state which does not trigger re-rendering
    const zoom_level = useRef(0);






    return (
        <Stage width={props.width} height={props.height} className="bg-black">

        </Stage>
    )
}
