import * as React from 'react';
import './carousel.css';

// Define width and height of the image cards. Change it based on the screen size.
const card_style = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: '3%',
    marginRight: '3%',
    backgroundColor: "transparent"
};

export default function CarouselImageCard({url, setImage, image}) {
    return (
        <div id={url} style={card_style} className="h-carousel pointer-events-auto"
            onClick={
                (event) => {
                    setImage(image);
                    event.stopPropagation();
                }
            }>
            <img className="object-cover" style={
                {
                    height: '100%',
                    width: '100%',
                    cursor: "pointer",
                    borderRadius: '10px',
                    border: "2px solid",
                    borderColor: "rgb(255 255 255 / 1)",
                }
            } src={url} alt="img"/>
        </div>
    );
}