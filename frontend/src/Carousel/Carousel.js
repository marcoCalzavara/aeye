// Component for showing the nearest neighbors of an image on click or on search.

import React, {useRef} from 'react';
import {useEffect, useState} from "react";
import Carousel from 'react-multi-carousel';
import ImageCard from "./ImageCard";
import {DATASET} from "../Map/Cache";
import 'react-multi-carousel/lib/styles.css';
import './carousel.css';


const responsive = {
    desktop: {
        breakpoint: {
            max: 3000,
            min: 1024
        },
        items: 3
    },
    mobile: {
        breakpoint: {
            max: 464,
            min: 0
        },
        items: 4
    },
    tablet: {
        breakpoint: {
            max: 1024,
            min: 464
        },
        items: 3
    }
};

export function fetchNeighbors(index, k, host, setImages) {
    // The function takes in an index of an image, and fetches the nearest neighbors of the image from the server.
    // Then it populates the state images with the fetched images.
    const url = `${host}/api/neighbors?index=${index}&k=${k}&collection=${DATASET}`;
    return fetch(url,
        {
            method: 'GET',
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Neighbors could not be retrieved from the server.' +
                    ' Please try again later. Status: ' + response.status + ' ' + response.statusText);
            }
            return response.json();
        })
        .catch(error => {
            // Handle any errors that occur during the fetch operation
            console.error('Error:', error);
        });
}

const NeighborsCarousel = (props) => {
    // Define state for images to show. The state consists of pairs (path, text), where path is the path to the image
    // and text is the text associated to the image.
    const [images, setImages] = useState([]);


    useEffect(() => {
        console.log(props.clickedImageIndex)
        // Fetch neighbors from server
        fetchNeighbors(props.clickedImageIndex, 10, props.host, setImages)
            .then(data => {
                // Populate state images with the fetched images
                console.log(data);
                let images = [];
                for (const image of data) {
                    const text = "The author of the artwork is " + image.author + "."; // TODO maybe add more ai generated info
                    images.push(
                        {
                            path: `${props.host}/${DATASET}/${image.path}`,
                            index: image.index,
                            text: text
                        }
                    );
                }
                setImages(images);
            });
    }, [props.clickedImageIndex]);

    useEffect(() => {
       // Scroll to the top of the carousel
        const carousel = document.getElementsByClassName('carousel')[0];
        carousel.scrollIntoView({behavior: "smooth"});
    }, [images]);

    return (
        <Carousel
            additionalTransfrom={0}
            arrows
            autoPlaySpeed={3000}
            centerMode={false}
            className="carousel height-carousel"
            containerClass="container"
            dotListClass=""
            draggable
            focusOnSelect={false}
            infinite={false}
            itemClass=""
            keyBoardControl
            minimumTouchDrag={80}
            pauseOnHover
            renderArrowsWhenDisabled={false}
            renderButtonGroupOutside={false}
            renderDotsOutside={false}
            responsive={responsive}
            rewind={false}
            rewindWithAnimation={false}
            rtl={false}
            shouldResetAutoplay
            showDots={false}
            sliderClass=""
            slidesToSlide={1}
            swipeable
        >
            {images.map((image) => {
                return (
                    <ImageCard key={image.index} url={image.path} text={image.text}/>
                );
            })}
        </Carousel>
    );
}

export default NeighborsCarousel;
