// Component for showing the nearest neighbors of an image on click or on search.

import React, {useEffect, useState} from 'react';
import Carousel from 'react-multi-carousel';
import ImageCard from "./ImageCard";
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
        items: 2
    },
    tablet: {
        breakpoint: {
            max: 1024,
            min: 464
        },
        items: 3
    }
};

function fetchNeighbors(index, k, host, dataset) {
    // The function takes in an index of an image, and fetches the nearest neighbors of the image from the server.
    // Then it populates the state images with the fetched images.
    const url = `${host}/api/neighbors?index=${index}&k=${k}&collection=${dataset}`;
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


function fetchCaption(images, i, host, dataset) {
    // The function takes in a list of images, and fetches the captions of the images from the server.
    // Then it populates the state images with the fetched images.
    const url = `${host}/api/caption?index=${images[i].index}&collection=${dataset}`;
    return fetch(url,
        {
            method: 'GET',
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Caption could not be retrieved from the server.' +
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
    const [captions, setCaptions] = useState([]);


    useEffect(() => {
        // Initialize captions to "Generating captions..."
        let captions = [];
        for (let i = 0; i < 10; i++) {
            captions.push("Generating captions...");
        }
        setCaptions(captions);

        // Fetch neighbors from server
        fetchNeighbors(props.clickedImageIndex, 10, props.host, props.selectedDataset)
            .then(data => {
                // Populate state images with the fetched images
                let images = [];
                for (const image of data) {
                    // noinspection JSUnresolvedVariable
                    images.push(
                        {
                            path: `${props.host}/${props.selectedDataset}/${image.path}`,
                            index: image.index,
                            author: image.author
                        }
                    );
                }
                setImages(images);
                return images
            })
            .then(images => {
                // Fetch captions from server
                for (let i = 0; i < images.length; i++) {
                    fetchCaption(images, i, props.host, props.selectedDataset)
                        .then(data => {
                            // Replace the corresponding caption with the fetched caption
                            setCaptions(prevCaptions => {
                                let newCaptions = [...prevCaptions];
                                newCaptions[i] = data.caption + ".\n" + images[i].author;
                                return newCaptions;
                            });
                        });
                }
            });
    }, [props.clickedImageIndex]);

    return (
        <Carousel
            additionalTransfrom={0}
            arrows
            autoPlaySpeed={3000}
            centerMode={false}
            className="carousel"
            containerClass="container"
            dotListClass=""
            draggable={false}
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
        >
            {images.map((image, index) => {
                return (
                    <ImageCard key={image.index} url={image.path} text={captions[index]}/>
                );
            })}
        </Carousel>
    );
}

export default NeighborsCarousel;
