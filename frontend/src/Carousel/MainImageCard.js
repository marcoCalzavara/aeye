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
                backgroundColor: "rgb(49 49 52 / 1)"
            }
        } className="h-image pointer-events-auto">
            <Typography variant="h1" className="font-carousel" sx={{
                    backgroundColor: "transparent",
                    fontStyle: 'italic',
                    fontFamily: 'Roboto Slab, serif',
                    color: 'white',
                    lineHeight: '1.1',
                    padding: '3%',
                    width: '30%',
                    height: '100%',
                }}>
                    {text.map((t, index) => {
                        return (
                            <span key={index}>
                                {t}
                                <br/>
                                <br/>
                            </span>
                        );
                    })}
            </Typography>
            <ProgressiveImage
                placeholderSrc={placeholderSrc}
                src={src}
                width={width}
                maxWidth="70%"
                cursor={cursor}
                objectFit={objectFit}
            />
        </Card>
    );
}