import * as React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import {TransformComponent, TransformWrapper} from "react-zoom-pan-pinch";
import { SlSizeFullscreen } from "react-icons/sl";
import './carousel.css';

// Define width and height of the image cards. Change it based on the screen size.
const card_style = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: '3%',
    marginRight: '3%',
    borderRadius: '10px',
};

export default function ImageCard({url, text, setImage, path}) {
    return (
        <Card id={url} sx={card_style} className="h-carousel cursor-grab pointer-events-auto" onPointerDown={
            () => {
                /* Set cursor to grabbing for the component */
                document.getElementById(url).classList.add("cursor-grabbing");
            }} onPointerUp={
            () => {
                /* Set cursor to grabbing for the component */
                document.getElementById(url).classList.remove("cursor-grabbing");
            }}
            onClick={
                (event) => {
                    setImage(path);
                    event.stopPropagation();
                }
            }>
            <TransformWrapper
                initialPositionX={0}
                initialPositionY={0}
                disablePadding={true}
                initialScale={1.3}
                minScale={0.5}
                maxScale={2}
            >
                <TransformComponent>
                    <CardMedia
                        component="img"
                        image={url}
                    />
                </TransformComponent>
            </TransformWrapper>
            <CardContent sx={{height: '20%', width: '100%'}}>
                <Typography variant="h1" className="font-carousel" sx={{
                    marginTop: "-2%",
                    backgroundColor: 'white',
                    fontStyle: 'italic',
                    fontWeight: 'bold',
                    fontFamily: 'Roboto Slab, serif',
                    lineHeight: '1.1'
                }}>
                    {text}
                </Typography>
            </CardContent>
        </Card>
    );
}