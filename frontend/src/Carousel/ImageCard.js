import * as React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
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
        <Card sx={card_style} className="height-carousel">
            <CardMedia
                component="img"
                image={url}
                sx={{ height: '80%', width: '100%', objectFit: 'fill'}}
            />
            <CardContent sx={{ height : '20%', width: '100%' }}>
                <Typography variant="h1" sx={ {
                    backgroundColor : 'white',
                    fontSize : '1.7vh',
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