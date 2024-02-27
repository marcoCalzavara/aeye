import * as React from 'react';
import {useEffect} from 'react';
import Typography from '@mui/material/Typography';
import ProgressiveImage from './ProgressiveImage';
import './carousel.css';
import {getMaxHeightMainImage} from "../utilities";

const MARGIN = 10;

const getHeightAndWidthOfMainImage = (height, width) => {
    // Get aspect ratio of the image
    const aspectRatio = height / width;
    // Get the maximum height of the main image
    const maxHeight = getMaxHeightMainImage() * 0.9 - MARGIN * 2;
    // Get the maximum width of the main image
    const maxWidth = document.getElementById("carousel-id").offsetWidth * 0.9 - MARGIN * 2;

    // Get aspect ratio of maximum height and width
    const aspectRatioMax = maxHeight / maxWidth;
    let newHeight, newWidth;
    if (aspectRatio > aspectRatioMax) {
        newHeight = maxHeight;
        newWidth = newHeight / aspectRatio;
    } else {
        newWidth = maxWidth;
        newHeight = newWidth * aspectRatio;
    }
    return {height: newHeight, width: newWidth};
}

const generateText = (image) => {
    const author = image.author.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    let text = "Author: " + author + ".   ";
    if (image.title !== undefined) {
        // Capitalize first letter of each word
        const title = image.title.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        text += "Title: " + title + ".   ";
    }
    if (image.genre !== undefined)
        text += "Genre: " + image.genre + ".   ";

    if (image.date !== undefined)
        if (image.date !== -1) {
            text += "Date: " + image.date + ".   ";
        }

    return text;
}

export default function MainImageCard({image, placeholderSrc, src}) {
    const [heightAndWidth, setHeightAndWidth] = React.useState({height: 0, width: 0});

    useEffect(() => {
        const {height, width} = getHeightAndWidthOfMainImage(image.height, image.width);
        setHeightAndWidth({height: height, width: width});
    }, [image]);


    return (
        <div style={
            {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-evenly',
                borderRadius: '10px',
                height: heightAndWidth.height,
                width: heightAndWidth.width,
                border: "2px solid",
                borderColor: "rgb(59 59 62 / 1)",
                backgroundColor: "rgb(49 49 52 / 1)"
            }
        } className="margin-between-images-bottom">
            {image && image.index !== -1 &&
                <>
                    <ProgressiveImage
                        placeholderSrc={placeholderSrc}
                        src={src}
                        width={(heightAndWidth.width - MARGIN * 2) + 'px'}
                        height={(heightAndWidth.height * 0.9 - MARGIN * 2) + 'px'}
                    />
                    <Typography variant="h1" sx={{
                        backgroundColor: "transparent",
                        fontStyle: 'italic',
                        fontFamily: 'Roboto Slab, serif',
                        fontSize: `calc(min(1.3vh, 1.3vw))`,
                        color: 'white',
                        width: (heightAndWidth.width - MARGIN * 2) + 'px',
                        height: (heightAndWidth.height * 0.1 - MARGIN) + 'px'
                    }}>
                        {generateText(image)}
                    </Typography>
                </>}
        </div>
    );
}
