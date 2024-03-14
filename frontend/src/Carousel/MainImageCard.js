import * as React from 'react';
import {useEffect} from 'react';
import ProgressiveImage from './ProgressiveImage';
import './carousel.css';
import {getMaxHeightMainImage, getResponsiveCarouselHeight} from "../utilities";
import TextArea from "./TextArea";

const MARGIN = 10;
const LINE_HEIGHT = 1.3;

const getHeightAndWidthOfMainImage = (height, width) => {
    // Get aspect ratio of the image
    const aspectRatio = height / width;
    // Get the maximum height of the main image
    const maxHeight = getMaxHeightMainImage() * 0.9 - MARGIN * 2;
    // Get the maximum width of the main image
    const maxWidth = document.getElementById("carousel-id").offsetWidth * 0.9 - MARGIN * 2;

    console.log("maxHeight: ", maxHeight, " maxWidth: ", maxWidth);

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
    console.log("newHeight: ", newHeight, " newWidth: ", newWidth);
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
        text += "Genre: " + image.genre + ". ";

    if (image.date !== undefined)
        if (image.date !== -1) {
            text += "Date: " + image.date + ". ";
        }
    if (image.caption !== undefined)
        text += "Caption: " + image.caption;

    return text;
}

function getAdaptiveFontSize(font_min , font_max, height) {
    let font = font_min;
    let best_font = -1;
    let best_diff = 1;
    while (font <= font_max) {
        if (best_font === -1 || Math.abs((height - 3) / (font * LINE_HEIGHT) - Math.floor((height - 3) / (font * LINE_HEIGHT))) < best_diff)
            best_font = font;
        font += 0.1;
    }
    return best_font;
}

function getFontSize(height) {
    // Change behavior of font size depending on device width and height of the available space
    switch (true) {
        case document.documentElement.clientWidth <= 480:
            if (height < 12 * LINE_HEIGHT * 2)
                // Have one line of text
                return {font: Math.min(11, (height - 3) / LINE_HEIGHT), lines: 1};
            else {
                const best_font = getAdaptiveFontSize(11, 13, height);
                return {font: best_font, lines: Math.floor((height - 3) / (best_font * LINE_HEIGHT))};
            }
        case document.documentElement.clientWidth > 480 && document.documentElement.clientWidth <= 768:
            if (height < 12 * 2 * LINE_HEIGHT)
                // Have one line of text
                return {font: Math.min(11, (height - 3) / LINE_HEIGHT), lines: 1};
            else {
                const best_font = getAdaptiveFontSize(11, 13, height);
                return {font: best_font, lines: Math.floor((height - 3) / (best_font * LINE_HEIGHT))};
            }
        case document.documentElement.clientWidth > 768 && document.documentElement.clientWidth <= 1024:
            if (height < 14 * 2 * LINE_HEIGHT)
                // Have one line of text
                return {font: Math.min(13, (height - 3) / LINE_HEIGHT), lines: 1};
            else {
                const best_font = getAdaptiveFontSize(13, 15, height);
                return {font: best_font, lines: Math.floor((height - 3) / (best_font * LINE_HEIGHT))};
            }
        case document.documentElement.clientWidth > 1024 && document.documentElement.clientWidth <= 1200:
            if (height < 14 * 2 * LINE_HEIGHT)
                // Have one line of text
                return {font: Math.min(13, (height - 3) / LINE_HEIGHT), lines: 1};
            else {
                const best_font = getAdaptiveFontSize(13, 15, height);
                return {font: best_font, lines: Math.floor((height - 3) / (best_font * LINE_HEIGHT))};
            }
        case document.documentElement.clientWidth > 1200:
            if (height < 15 * 2 * LINE_HEIGHT)
                // Have one line of text
                return {font: Math.min(14, (height - 3) / LINE_HEIGHT), lines: 1};
            else {
                const best_font = getAdaptiveFontSize(14, 16, height);
                return {font: best_font, lines: Math.floor((height - 3) / (best_font * LINE_HEIGHT))};
            }
    }
}

function getStyle(expanded, heightAndWidth) {
    const style = {
        backgroundColor: "transparent",
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
    const [height, setHeight] = React.useState(window.innerHeight);

    useEffect(() => {
        setExpanded(false);
        const {height, width} = getHeightAndWidthOfMainImage(image.height, image.width);
        setHeightAndWidth({height: height, width: width});
    }, [image]);

    useEffect(() => {
        function handleResize() {
            setHeight(window.innerHeight);
        }
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);


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
        } className={height >= 500 ? "margin-between-images-bottom" : ""}
             onPointerDown={
            (event) => {
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
                        <TextArea
                            text={generateText(image)}
                            margin={MARGIN}
                            width={heightAndWidth.width}
                            fontsize={getFontSize(heightAndWidth.height * 0.1).font}
                            lines={getFontSize(heightAndWidth.height * 0.1).lines}
                            line_height={LINE_HEIGHT}
                            expanded={expanded}
                            setExpanded={setExpanded}/>
                    </div>
                </>}
        </div>
    );
}
