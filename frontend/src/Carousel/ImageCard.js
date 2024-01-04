import * as React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
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

export default function ImageCard({url, text}) {
    return (
        <Card id={url} sx={card_style} className="h-carousel cursor-grab" onPointerDown={
            () => {
                /* Set cursor to grabbing for the component */
                document.getElementById(url).classList.add("cursor-grabbing");
        }} onPointerUp={
            () => {
                /* Set cursor to grabbing for the component */
                document.getElementById(url).classList.remove("cursor-grabbing");
        }}>
            <TransformWrapper
                initialPositionX={0}
                initialPositionY={0}
                disablePadding={true}
                minScale={0.5}
                maxScale={2}
            >
                <TransformComponent>
                    <CardMedia
                        component="img"
                        image={url}
                        sx={{ height: '80%', width: '100%', objectFit: 'cover'}}
                    />
                </TransformComponent>
            </TransformWrapper>
            <CardContent sx={{ height : '20%', width: '100%' }}>
                <Typography variant="h1" className="font-carousel" sx={ {
                    backgroundColor : 'white',
                    fontStyle: 'italic',
                    fontWeight: 'bold',
                    fontFamily: 'Roboto Slab, serif',
                    textAlign: 'center',
                } }>
                    {text}
                </Typography>
            </CardContent>
        </Card>
    );
}