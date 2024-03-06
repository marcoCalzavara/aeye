import * as React from 'react';
import {useEffect} from 'react';
import ProgressiveImage from './ProgressiveImage';
import './carousel.css';
import {getMaxHeightMainImage, getResponsiveCarouselHeight} from "../utilities";
import TextArea from "./TextArea";

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
    if (image.caption !== undefined)
        text += "Caption: " + image.caption + ".   ";

    return text;
}

function getStyle(expanded, heightAndWidth) {
    const style = {
        backgroundColor: "transparent",
        fontStyle: 'italic',
        fontFamily: 'Roboto Slab, serif',
        fontSize: (heightAndWidth.height * 0.1 - 3) / (2 * 1.3) > 13 ? (heightAndWidth.height * 0.1 - 3) / (2 * 1.3) + 'px'
            : (heightAndWidth.height * 0.1 - 3) / 1.3 + 'px',
        lineHeight: '1.3',
        textAlign: 'justify',
        color: 'white',
        width: '100%',
        cursor: 'pointer',
        maxHeight: getResponsiveCarouselHeight()
    }
    if (!expanded) {
        style.height = (heightAndWidth.height * 0.1) + 'px';
    }
    return style;
}


export default function MainImageCard({image, placeholderSrc, src}) {
    const [heightAndWidth, setHeightAndWidth] = React.useState({height: 0, width: 0});
    const [expanded, setExpanded] = React.useState(false);

    useEffect(() => {
        setExpanded(false);
        const {height, width} = getHeightAndWidthOfMainImage(image.height, image.width);
        setHeightAndWidth({height: height, width: width});
    }, [image]);


    return (
        <div style={
            {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'start',
                alignItems: 'center',
                borderRadius: '10px',
                height: heightAndWidth.height,
                width: heightAndWidth.width,
                backgroundColor: "rgb(49 49 52 / 1)",
                zIndex: 100,
                pointerEvents: "auto",
            }
        } className="margin-between-images-bottom" onPointerDown={
            (event) => {
                console.log("hey")
                event.stopPropagation();
            }
        }>
            {image && image.index !== -1 &&
                <>
                    <ProgressiveImage
                        placeholderSrc={placeholderSrc}
                        src={src}
                        width={(heightAndWidth.width - MARGIN * 2) + 'px'}
                        height={(heightAndWidth.height * 0.9 - MARGIN * 2) + 'px'}
                        margin={MARGIN}
                    />
                    <div style={getStyle(expanded, heightAndWidth)}>
                        <TextArea text={generateText(image)} margin={MARGIN} expanded={expanded} setExpanded={setExpanded}/>
                    </div>
                </>}
        </div>
    );
}
