import * as React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import ProgressiveImage from './ProgressiveImage';
import './carousel.css';

export default function MainImageCard({placeholderSrc, src, width, maxWidth, cursor, objectFit, text}) {
    return (
        <Card sx={
            {
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
                borderRadius: '10px',
                maxWidth: maxWidth,
                border: "2px solid",
                borderColor: "rgb(59 59 62 / 1)",
                backgroundColor: "rgb(49 49 52 / 1)",
                marginLeft: "2%",
                marginRight: "2%"
            }
        } className="h-image pointer-events-auto">
            <CardContent sx={{height: '20%', width: '28%'}}>
                <Typography variant="h1" className="font-carousel" sx={{
                    marginTop: "3%",
                    backgroundColor: "transparent",
                    fontStyle: 'italic',
                    fontFamily: 'Roboto Slab, serif',
                    color: 'white',
                    lineHeight: '1.1'
                }}>
                    {text}
                </Typography>
            </CardContent>
            <ProgressiveImage
                placeholderSrc={placeholderSrc}
                src={src}
                width={width}
                maxWidth="68%"
                cursor={cursor}
                objectFit={objectFit}
            />
        </Card>
    );
}